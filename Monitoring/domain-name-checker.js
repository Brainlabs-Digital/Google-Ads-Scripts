// ID: ed7e945f7a48e1f1d6c1455676e14b5b
/**
*
* Domain Name Checker
*
* This script will scan through your keyword and ad URLs, checking the domain
* names for anything out of place, and output any discrepancies it finds into a
* Google Sheet.
*
* Version: 1.0
* Google AdWords Script maintained on brainlabsdigital.com
*
**/

////////////////////////////////////////////////////////////////////////////////
// Options

var domainName = "brainlabsdigital.com";
// The domain you expect to be in all your keyword and ad URLs.
// Can be a whole URL (www.brainlabsdigital.com) or a partial URL
// (brainlabsdigital.com) to cover multiple subdomains.

var isWholeDomainName = true;
// If the domain name you gave is a whole URL, set this to true. Otherwise,
// leave it as false.

var targetSheetUrl = "https://docs.google.com/YOUR-SPREADSHEET-URL-HERE";
// Replace this with the URL of a blank Google Sheet; this is where the script
// will output its results

var campaignNameContains = [];
// Use this if you only want to look at some campaigns.
// For example ["Generic"] would only look at campaigns with 'generic' in the
// name, while ["Generic", "Competitor"] would only look at campaigns with
// either 'generic' or 'competitor' in the name.
// Leave as [] to include all campaigns.

var campaignNameDoesNotContain = [];
// Use this if you want to exclude some campaigns.
// For example ["Brand"] would ignore any campaigns with 'brand' in the name,
// while ["Brand", "Key Terms"] would ignore any campaigns with 'brand' or
// 'key terms' in the name.
// Leave as [] to not exclude any campaigns.

var ignorePausedCampaigns = true;
// Set this to true to only look at currently active campaigns.
// Set to false to include campaigns that had impressions but are currently paused.


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Functions

function main() {
  // Escape any special characters in the given domain name.
  prepareDomainName();
  Logger.log("Prepared domain name for checking.");

  // Fetch the URLs of keywords and ads attached to valid campaigns, filtering
  // out those with the correct domain name.
  var urlData = getUrlData();
  Logger.log("Fetched all URLs.");

  var numberOfBadUrls = Object.keys(urlData).length;

  if (numberOfBadUrls === 0) {
    Logger.log("No incorrect URLs found.");
  } else {
    // Output the bad URLs and their keywords and ads to the target sheet.
    outputToSheet(urlData);
    Logger.log("Output " + numberOfBadUrls + " incorrect URLs to sheet.");
  }

  Logger.log("Finished.");
}


// Escape any special characters in the given domain name.
function prepareDomainName() {
  domainName = domainName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};


// This function returns an object containing the URLs and details of keywords
// and ads attached to valid campaigns.
function getUrlData() {
  var urlData = new Object();
  var expectedPattern = /./;
  var whereStatements = ["Status = 'ENABLED'",
    "AdGroupStatus = 'ENABLED'"
  ];
  if (ignorePausedCampaigns) {
    whereStatements.push("CampaignStatus IN ['ENABLED']");
  } else {
    whereStatements.push("CampaignStatus IN ['ENABLED','PAUSED']");
  }

  if (isWholeDomainName) {
    expectedPattern = new RegExp("^https?://" + domainName);
  } else {
    expectedPattern = new RegExp("^https?://([^/]*?\\.)*" + domainName);
  }
  if (campaignNameContains.length == 0) {
    campaignNameContains.push(false);
  }

  for (var i = 0; i < campaignNameDoesNotContain.length; i++) {
    whereStatements.push("CampaignName DOES_NOT_CONTAIN_IGNORE_CASE '"
      + campaignNameDoesNotContain[i].replace(/"/g, '\\\"') + "'");
  }

  for (var i = 0; i < campaignNameContains.length; i++) {
    if (campaignNameContains[i] === false) {
      var finalWhereStatements = whereStatements;
    } else {
      var finalWhereStatements = whereStatements.concat(
        ["CampaignName CONTAINS_IGNORE_CASE '" + campaignNameContains[i] + "'"]
      );
    }

    var keywordReport = AdWordsApp.report(
      "SELECT CampaignName, AdGroupName, Criteria, FinalMobileUrls, FinalUrls " +
      "FROM KEYWORDS_PERFORMANCE_REPORT " +
      "WHERE FinalUrls != '--' AND " + finalWhereStatements.join(" AND "));

    var rows = keywordReport.rows();
    while (rows.hasNext()) {
      var row = rows.next();
      var urls = jsonToArray(row['FinalMobileUrls']).concat(
        jsonToArray(row['FinalUrls'])
      );

      for (var j in urls) {
        var url = urls[j].toLowerCase();
        if (url.match(expectedPattern) === null) {
          var rowData = {
            "CampaignName": row['CampaignName'],
            "AdGroupName": row['AdGroupName'],
            "Keyword": row['Criteria']
          };
          if (!urlData.hasOwnProperty(url)) {
            urlData[url] = { "keywords": {}, "ads": {} };
          }
          urlData[url]["keywords"][row['Id']] = rowData;
        }
      }
    }

    var adReport = AdWordsApp.report(
      "SELECT CampaignName, AdGroupName, HeadlinePart1, HeadlinePart2, " +
      "CreativeFinalMobileUrls, CreativeFinalUrls " +
      "FROM AD_PERFORMANCE_REPORT " +
      "WHERE CreativeFinalUrls != '--' AND "
      + finalWhereStatements.join(" AND "));

    var rows = adReport.rows();

    while (rows.hasNext()) {
      var row = rows.next();
      var urls = jsonToArray(row['CreativeFinalMobileUrls']).concat(
        jsonToArray(row['CreativeFinalUrls'])
      );

      for (var j in urls) {
        var url = urls[j].toLowerCase();
        if (url.match(expectedPattern) === null) {
          var rowData = {
            "CampaignName": row['CampaignName'],
            "AdGroupName": row['AdGroupName'],
            "Headline": row['HeadlinePart1'] + " - "
              + row['HeadlinePart2']
          };
          if (!urlData.hasOwnProperty(url)) {
            urlData[url] = { "keywords": {}, "ads": {} };
          }
          urlData[url]["ads"][rowData['Headline']] = rowData;
        }
      }
    }

    whereStatements.push("CampaignName DOES_NOT_CONTAIN_IGNORE_CASE '"
      + campaignNameContains[i] + "'");
  }

  return urlData;
}


// This function outputs details about any invalid URLs to the given Google
// Sheet.
function outputToSheet(urlData) {
  var ss = checkSpreadsheet(targetSheetUrl, "the spreadsheet");
  var keywordsSheet = ss.getSheetByName("Results - Keywords");
  var adsSheet = ss.getSheetByName("Results - Ads");
  if (keywordsSheet == null) {
    keywordsSheet = ss.insertSheet("Results - Keywords");
  }
  if (adsSheet == null) {
    adsSheet = ss.insertSheet("Results - Ads");
  }
  keywordsSheet.clear();
  adsSheet.clear();

  var keywordsRange = [["Bad URL", "Keyword", "Ad Group", "Campaign"]];
  var adsRange = [["Bad URL", "Ad Headline", "Ad Group", "Campaign"]];
  for (var url in urlData) {
    for (var j in urlData[url]["keywords"]) {
      var data = urlData[url]["keywords"][j];
      keywordsRange.push([url,
        data["Keyword"],
        data["AdGroupName"],
        data["CampaignName"]]);
    }

    for (var j in urlData[url]["ads"]) {
      var data = urlData[url]["ads"][j];
      adsRange.push([url,
        data["Headline"],
        data["AdGroupName"],
        data["CampaignName"]]);
    }
  }

  keywordsSheet.getRange(1, 1, keywordsRange.length, 4).setValues(keywordsRange);
  adsSheet.getRange(1, 1, adsRange.length, 4).setValues(adsRange);
}


// A small helper function for processing AdWords report fields.
function jsonToArray(str) {
  return str == "--" ? [] : JSON.parse(str);
}


// Check the spreadsheet URL has been entered, and that it works
function checkSpreadsheet(spreadsheetUrl, spreadsheetName) {
  if (spreadsheetUrl.replace(/[AEIOU]/g, "X") == "https://docs.google.com/YXXR-SPRXXDSHXXT-XRL-HXRX") {
    throw ("Problem with " + spreadsheetName + " URL: make sure you've replaced the default with a valid spreadsheet URL.");
  }
  try {
    var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);

    // Checks if you can edit the spreadsheet
    var sheet = spreadsheet.getSheets()[0];
    var sheetName = sheet.getName();
    sheet.setName(sheetName);

    return spreadsheet;
  } catch (e) {
    throw ("Problem with " + spreadsheetName + " URL: '" + e + "'");
  }
}
