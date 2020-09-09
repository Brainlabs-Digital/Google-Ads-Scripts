// ID: cf2b716da83072371e9306ff7208597e
/**
*
* Expanding Phrase Match Negatives
*
* This script searches for all occurrences of phrase match negatives in search
* queries resulting from typos. Outputs a report to a Google Doc spreadsheet. 
*
* Version: 1.0
* Google AdWords Script maintained on brainlabsdigital.com
*
**/


function main() {
  //////////////////////////////////////////////////////////////////////////////
  // Options 

  var phraseMatchNegative = "phrase match negative";
  // The phrase match negative that you would like to analyse

  var useCaseSensitiveSearch = false;
  // Only compare search queries where the case matches
  // e.g. If set to true: For the phrase 'Free', 'freeman' would be ignored. 

  var startDate = '2018-01-01';
  var endDate = '2018-01-31';
  // The start and end date of the date range for your search query data
  // Format is yyyy-mm-dd

  var currencySymbol = "£";
  // The currency symbol used for formatting. For example "£", "$" or "€".

  var campaignNameDoesNotContain = [];
  // Use this if you want to exclude some campaigns.
  // For example ["Display"] would ignore any campaigns with 'Display' in the name,
  // while ["Display","Shopping"] would ignore any campaigns with 'Display' or
  // 'Shopping' in the name.
  // Leave as [] to not exclude any campaigns.

  var campaignNameContains = [];
  // Use this if you only want to look at some campaigns.
  // For example ["Brand"] would only look at campaigns with 'Brand' in the name,
  // while ["Brand","Generic"] would only look at campaigns with 'Brand' or 'Generic'
  // in the name.
  // Leave as [] to include all campaigns.

  var ignorePausedCampaigns = true;
  // Set this to true to only look at currently active campaigns.
  // Set to false to include campaigns that had impressions but are currently paused.

  var ignorePausedAdGroups = true;
  // Set this to true to only look at currently active ad groups.
  // Set to false to include ad groups that had impressions but are currently paused.

  var spreadsheetUrl = "https://docs.google.com/YOUR-SPREADSHEET-URL-HERE";
  // The URL of the Google Doc the results will be put into.

  var clearSpreadsheet = true;
  // If true, data already in the spreadsheet will be overwritten.


  //////////////////////////////////////////////////////////////////////////////
  // Thresholds

  var impressionThreshold = 10;
  var clickThreshold = 0;
  var costThreshold = 0;
  var conversionThreshold = 0;
  // Suggested negatives will not be reported for your phrase match negative if their statistics
  // are lower than any of these thresholds


  //////////////////////////////////////////////////////////////////////////////  
  // The actual code starts here 

  var spreadsheet = checkSpreadsheet(spreadsheetUrl, 'the spreadsheet');
  var campaignSheet = makeSheet(spreadsheet, 'Campaign Phrase Analysis');
  var accountSheet = makeSheet(spreadsheet, 'Account Phrase Analysis');


  // Get the IDs of the campaigns to look at
  var activeCampaignIds = getCampaignIds(campaignNameDoesNotContain, campaignNameContains, ignorePausedCampaigns);

  //////////////////////////////////////////////////////////////////////////////
  // Define the statistics to download or calculate, and their formatting
  var statColumns = ["Clicks", "Impressions", "Cost", "Conversions", "ConversionValue"];
  var calculatedStats = [["CTR","Clicks","Impressions"],
                         ["CPC","Cost","Clicks"],
                         ["Conv. Rate","Conversions","Clicks"],
                         ["Cost / conv.","Cost","Conversions"],
                         ["Conv. value/cost","ConversionValue","Cost"]];
  var currencyFormat = currencySymbol + "#,##0.00";
  var formatting = ["#,##0", "#,##0", "#,##0", currencyFormat, "#,##0", currencyFormat,"0.00%",currencyFormat,"0.00%",currencyFormat,"0.00%"];

  //////////////////////////////////////////////////////////////////////////////
  // Go through the search query report, record the performance of each
  // occurrence of phrase match negative
  var dateRange = startDate.replace(/-/g, "") + "," + endDate.replace(/-/g, "");
  if(startDate == '' || endDate == ''){
    throw ("Problem with date range. Start Date and End Date cannot be blank");
  }

  if (ignorePausedAdGroups) {
    var whereAdGroupStatus = "AND AdGroupStatus = ENABLED ";
  } else {
    var whereAdGroupStatus = "AND AdGroupStatus IN ['ENABLED','PAUSED'] ";
  }

  var queryReport = AdWordsApp.report(
    "SELECT CampaignName, CampaignId, AdGroupId, AdGroupName, Query, MonthOfYear, " + statColumns.join(", ") + " " +
    "FROM SEARCH_QUERY_PERFORMANCE_REPORT " +
    "WHERE CampaignId IN [" + activeCampaignIds.join(",") + "] " + whereAdGroupStatus +
    "DURING " + dateRange);

  var suggestedNegativesByCampaign = {};
  var suggestedNegativesByAccount = {};


  phraseMatchNegative = phraseMatchNegative.trim().toLowerCase();

  var queryRows = queryReport.rows();
  if(!queryRows.hasNext()) {
    throw('The search query report has returned empty. Consider adjusting your options.') 
  }
  while (queryRows.hasNext()) {

    queryRow = queryRows.next();
    var query = queryRow["Query"];

    if(query.indexOf(phraseMatchNegative) > -1) {
      var matchedPhrase = extractSubstringContainingPhraseMatchNegative(query, phraseMatchNegative);
      if(suggestedNegativesByCampaign[matchedPhrase] == undefined) {
        suggestedNegativesByAccount[matchedPhrase] = {};
        suggestedNegativesByAccount[matchedPhrase]['Query Count'] = 1;
        suggestedNegativesByCampaign[matchedPhrase] = {};
        suggestedNegativesByCampaign[matchedPhrase][queryRow['CampaignName']] = {};
        suggestedNegativesByCampaign[matchedPhrase][queryRow['CampaignName']]['Query Count'] = 1;
        for (var s=0; s<statColumns.length; s++) {
          suggestedNegativesByCampaign[matchedPhrase][queryRow['CampaignName']][statColumns[s]] = parseFloat(queryRow[statColumns[s]]);
          suggestedNegativesByAccount[matchedPhrase][statColumns[s]] = parseFloat(queryRow[statColumns[s]]);
        }
      }else {
        if(suggestedNegativesByCampaign[matchedPhrase][queryRow['CampaignName']] == undefined) {
          suggestedNegativesByCampaign[matchedPhrase][queryRow['CampaignName']] = {};
          suggestedNegativesByCampaign[matchedPhrase][queryRow['CampaignName']]['Query Count'] = 1;
          suggestedNegativesByAccount[matchedPhrase]['Query Count'] += 1;
          for (var s=0; s<statColumns.length; s++) {
            suggestedNegativesByCampaign[matchedPhrase][queryRow['CampaignName']][statColumns[s]] = parseFloat(queryRow[statColumns[s]]);
            suggestedNegativesByAccount[matchedPhrase][statColumns[s]] += parseFloat(queryRow[statColumns[s]]);
          }
        }else {
          suggestedNegativesByCampaign[matchedPhrase][queryRow['CampaignName']]['Query Count'] += 1;
          suggestedNegativesByAccount[matchedPhrase]['Query Count'] += 1;
          for (var s=0; s<statColumns.length; s++) {
            suggestedNegativesByCampaign[matchedPhrase][queryRow['CampaignName']][statColumns[s]] += parseFloat(queryRow[statColumns[s]]);
            suggestedNegativesByAccount[matchedPhrase][statColumns[s]] += parseFloat(queryRow[statColumns[s]]);
          }
        }
      }
    } 
  }

  Logger.log("Finished analysing queries.");

  //////////////////////////////////////////////////////////////////////////////
  // Output the data into the spreadsheet

  var campaignOutputs = [];
  var campaignFormats = [];
  var accountOutputs = [];
  var accountFormats = [];

  var campaignHeaders = ['Suggested Negative', 'Campaign', 'Query Count'].concat(statColumns).concat(calculatedStats.map(function(x){return x[0];}));
  var accountHeaders = ['Suggested Negative', 'Query Count'].concat(statColumns).concat(calculatedStats.map(function(x){return x[0];}));

  campaignOutputs.push(campaignHeaders);
  accountOutputs.push(accountHeaders);
  for(var keyword in suggestedNegativesByCampaign) {
    var accountOutputRow = [keyword];
    for(var campaign in suggestedNegativesByCampaign[keyword] ) {
      var campaignOutputRow = [keyword];
      if(suggestedNegativesByCampaign[keyword][campaign]['Impressions'] < impressionThreshold) {continue;}
      if(suggestedNegativesByCampaign[keyword][campaign]['Clicks'] < clickThreshold) {continue;}
      if(suggestedNegativesByCampaign[keyword][campaign]['Cost'] < costThreshold) {continue;}
      if(suggestedNegativesByCampaign[keyword][campaign]['Conversions'] < conversionThreshold) {continue;}
      campaignOutputRow.push(campaign);
      campaignOutputRow.push(suggestedNegativesByCampaign[keyword][campaign]['Query Count']);
      for (var s=0; s<statColumns.length; s++) {
        campaignOutputRow.push(suggestedNegativesByCampaign[keyword][campaign][statColumns[s]]); 
      }
      for (var s in calculatedStats) {
        var cs = calculatedStats[s];
        if(suggestedNegativesByCampaign[keyword][campaign][cs[2]] != 0) {
          campaignOutputRow.push(suggestedNegativesByCampaign[keyword][campaign][cs[1]]/suggestedNegativesByCampaign[keyword][campaign][cs[2]])
        } else {
          campaignOutputRow.push('-'); 
        }
      }
      campaignOutputs.push(campaignOutputRow);
      campaignFormats.push(["0", "0"].concat(formatting));
    }
    if(suggestedNegativesByAccount[keyword]['Impressions'] < impressionThreshold) {continue;}
    if(suggestedNegativesByAccount[keyword]['Clicks'] < clickThreshold) {continue;}
    if(suggestedNegativesByAccount[keyword]['Cost'] < costThreshold) {continue;}
    if(suggestedNegativesByAccount[keyword]['Conversions'] < conversionThreshold) {continue;}
    accountOutputRow.push(suggestedNegativesByAccount[keyword]['Query Count']);
    for (var s=0; s<statColumns.length; s++) {
      accountOutputRow.push(suggestedNegativesByAccount[keyword][statColumns[s]]); 
    }
    for (var s in calculatedStats) {
      var cs = calculatedStats[s];
      if(suggestedNegativesByCampaign[keyword][campaign][cs[2]] != 0) {
        accountOutputRow.push(suggestedNegativesByAccount[keyword][cs[1]]/suggestedNegativesByAccount[keyword][cs[2]])
      } else {
        accountOutputRow.push('-'); 
      }
    }
    accountOutputs.push(accountOutputRow);
    accountFormats.push(["0"].concat(formatting));
  }

  var filterText = "";
  if (ignorePausedAdGroups) {
    filterText = "Active ad groups";
  } else {
    filterText = "All ad groups";
  }

  if (ignorePausedCampaigns) {
    filterText += " in active campaigns";
  } else {
    filterText += " in all campaigns";
  }

  if (campaignNameContains != "") {
    filterText += " containing '" + campaignNameContains + "'";
    if (campaignNameDoesNotContain != "") {
      filterText += " and not containing '" + campaignNameDoesNotContain + "'";
    }
  } else if (campaignNameDoesNotContain != "") {
    filterText += " not containing '" + campaignNameDoesNotContain + "'";
  }

  writeOutput(campaignOutputs, campaignFormats, campaignSheet, phraseMatchNegative, filterText, clearSpreadsheet);
  writeOutput(accountOutputs, accountFormats, accountSheet, phraseMatchNegative, filterText, clearSpreadsheet);

  Logger.log("Finished writing to spreadsheet.")

} // end main function

function makeSheet(spreadsheet, sheetName) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (sheet == undefined) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  return sheet;
}

// Check the spreadsheet URL has been entered, and that it works
function checkSpreadsheet(spreadsheetUrl, spreadsheetName) {
  if (spreadsheetUrl.replace(/[AEIOU]/g,"X") == "https://docs.google.com/YXXR-SPRXXDSHXXT-XRL-HXRX") {
    throw("Problem with " + spreadsheetName + " URL: make sure you've replaced the default with a valid spreadsheet URL.");
  }
  try {
    var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);

    // Checks if you can edit the spreadsheet
    var sheet = spreadsheet.getSheets()[0];
    var sheetName = sheet.getName();
    sheet.setName(sheetName);

    return spreadsheet;
  } catch (e) {
    throw("Problem with " + spreadsheetName + " URL: '" + e + "'");
  }
}

// Get the IDs of campaigns which match the given options
function getCampaignIds(campaignNameDoesNotContain, campaignNameContains, ignorePausedCampaigns) {
  var whereStatement = "WHERE ";
  var whereStatementsArray = [];
  var campaignIds = [];

  if (ignorePausedCampaigns) {
    whereStatement += "CampaignStatus = ENABLED ";
  } else {
    whereStatement += "CampaignStatus IN ['ENABLED','PAUSED'] ";
  }

  for (var i=0; i<campaignNameDoesNotContain.length; i++) {
    whereStatement += "AND CampaignName DOES_NOT_CONTAIN_IGNORE_CASE '" + campaignNameDoesNotContain[i].replace(/"/g,'\\\"') + "' ";
  }

  if (campaignNameContains.length == 0) {
    whereStatementsArray = [whereStatement];
  } else {
    for (var i=0; i<campaignNameContains.length; i++) {
      whereStatementsArray.push(whereStatement + 'AND CampaignName CONTAINS_IGNORE_CASE "' + campaignNameContains[i].replace(/"/g,'\\\"') + '" ');
    }
  }

  for (var i=0; i<whereStatementsArray.length; i++) {
    var campaignReport = AdWordsApp.report(
      "SELECT CampaignId " +
      "FROM   CAMPAIGN_PERFORMANCE_REPORT " +
      whereStatementsArray[i] +
      "DURING LAST_30_DAYS");

    var rows = campaignReport.rows();
    while (rows.hasNext()) {
      var row = rows.next();
      campaignIds.push(row['CampaignId']);
    }
  }

  if (campaignIds.length == 0) {
    throw("No campaigns found with the given settings.");
  }

  Logger.log(campaignIds.length + " campaigns found");
  return campaignIds;
}

function extractSubstringContainingPhraseMatchNegative(query, keyword) {
  var keywordLength = keyword.length;
  var queryLength = query.length;
  var keywordStart = query.indexOf(keyword);
  var nextSpace = query.indexOf(" ", keywordStart + keywordLength);
  nextSpace = (nextSpace > -1) ? nextSpace: queryLength;
  var reverseQuery = reverseString(query);
  var previousSpace = reverseQuery.indexOf(" ", queryLength - keywordStart - 1);
  previousSpace = (previousSpace > -1) ? queryLength - previousSpace: 0;
  return query.substring(previousSpace, nextSpace);
}

function reverseString(str) {
  var split = str.split("");
  var reverse = split.reverse();
  return reverse.join("");
}

function writeOutput(outputArray, formatArray, sheet, keyword, filterText, clearSpreadsheet) {
  if (clearSpreadsheet) {
    sheet.clear();
  }

  sheet.getRange("R1C1").setValue("Analysis of '" + keyword + "' in Search Query Report.");

  sheet.getRange("R" + (sheet.getLastRow() + 2) + "C1").setValue(filterText);

  var lastRow = sheet.getLastRow();

  if (formatArray.length == 0) {
    sheet.getRange("R" + (lastRow + 1) + "C1").setValue("No " + keyword + " found within the thresholds.");
  } else {
    sheet.getRange("R" + (lastRow + 1) + "C1:R" + (lastRow+outputArray.length) + "C" + outputArray[0].length).setValues(outputArray);
    sheet.getRange("R" + (lastRow + 2) + "C1:R" + (lastRow+outputArray.length) + "C" + formatArray[0].length).setNumberFormats(formatArray);

    var sortByColumns = [];
    sortByColumns.push({column: 2, ascending: true});
    sortByColumns.push({column: outputArray[0].indexOf("Cost") + 1, ascending: false});
    sortByColumns.push({column: outputArray[0].indexOf("Impressions") + 1, ascending: false});
    sheet.getRange("R" + (lastRow + 2) + "C1:R" + (lastRow+outputArray.length) + "C" + outputArray[0].length).sort(sortByColumns);
  }
}
