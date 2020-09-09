// ID: 9b05c474b4ffe66abe52091ac4a9f9fb
/**
*
* AdWords Script to check the number of entities in ad groups: reports ad
* groups with no ads, no keywords, too few ads or too many keywords.
* Optionally reports ad groups with no mobile preferred ads, and ad groups
* with broad match keywords but no negative keywords.
*
* Version: 1.1
* Updated 2017-01-05: changed 'CreativeApprovalStatus' to 'CombinedApprovalStatus'
* Google AdWords Script maintained by brainlabsdigital.com
*
*/

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Options

var spreadsheetUrl = 'https://docs.google.com/YOUR-SPREADSHEET-URL-HERE';
// The URL of the Google Doc the results will be put into.

var campaignNameDoesNotContain = [];
// Use this if you want to exclude some campaigns.
// For example ["Display"] would ignore any campaigns with 'Display' in the name,
// while ["Display","Shopping"] would ignore any campaigns with 'Display' or
// 'Shopping' in the name.
// Leave as [] to not exclude any campaigns.

var campaignNameContains = [];
// Use this if you only want to look at some campaigns.
// For example ["Brand"] would only look at campaigns with 'Brand' in the name,
// while ["Brand","Generic"] would only look at campaigns with 'Brand' or
// 'Generic' in the name.
// Leave as [] to include all campaigns.

var ignorePausedCampaigns = true;
// Set this to true to only look at currently active campaigns.
// Set to false to also include campaigns that are currently paused.

var ignorePausedKeywords = true;
// If this is true, then ad groups can be reported as empty if they have paused
// keywords.
// Set this to false to make the script count paused keywords when deciding if
// an ad group is not empty. Only ad groups with no keywords (or only removed
// keywords) will be reported as empty.

var ignorePausedAds = true;
// If this is true, then ad groups can be reported as empty if they have paused
// ads.
// Set this to false to make the script count paused ads when deciding if an ad
// group is not empty. Only ad groups with no ads (or only removed or
// disapproved ads) will be reported as empty.

var maximumKeywordsPerAdGroup = 1;
// An ad group will be reported if it has more than this number of keywords.

var minimumAdsPerAdGroup = 2;
// An ad group will be reported if it has fewer than this number of ads.

var findAdGroupsWithoutMobileAds = true;
// Set this to true to get a list of ad groups that do have ads but don't have
// any mobile preferred ads.
// If this is not wanted, set to false.

var findAdGroupsWithNoNegatives = true;
// Set this to true to get a list of ad groups which contain broad match
// keywords but have no negatives.
// If this is not wanted, set to false.


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Functions

function main() {
  var spreadsheet = checkSpreadsheet(spreadsheetUrl, 'the spreadsheet');
  var sheet = spreadsheet.getSheets()[0];
  var campaignIds = getCampaignIds();

  if (typeof maximumKeywordsPerAdGroup !== 'number') {
    throw ("Problem with maximumKeywordsPerAdGroup: the given value '" + maximumKeywordsPerAdGroup + "' does not appear to be a number.");
  }

  if (typeof minimumAdsPerAdGroup !== 'number') {
    throw ("Problem with minimumAdsPerAdGroup: the given value '" + minimumAdsPerAdGroup + "' does not appear to be a number.");
  }

  adGroupChecking(campaignIds, sheet);
  Logger.log('Finished ad group checks.');
}

// Check the spreadsheet URL has been entered, and that it works
function checkSpreadsheet(spreadsheetUrl, spreadsheetName) {
  if (spreadsheetUrl.replace(/[AEIOU]/g, 'X') == 'https://docs.google.com/YXXR-SPRXXDSHXXT-XRL-HXRX') {
    throw ('Problem with ' + spreadsheetName + " URL: make sure you've replaced the default with a valid spreadsheet URL.");
  }
  try {
    var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
    return spreadsheet;
  } catch (e) {
    throw ('Problem with ' + spreadsheetName + " URL: '" + e + "'");
  }
}

// Get the IDs of campaigns which match the given options
function getCampaignIds() {
  var whereStatement = 'WHERE ';
  var whereStatementsArray = [];
  var campaignIds = [];

  if (ignorePausedCampaigns) {
    whereStatement += 'CampaignStatus = ENABLED ';
  } else {
    whereStatement += "CampaignStatus IN ['ENABLED','PAUSED'] ";
  }

  for (var i = 0; i < campaignNameDoesNotContain.length; i++) {
    whereStatement += "AND CampaignName DOES_NOT_CONTAIN_IGNORE_CASE '" + campaignNameDoesNotContain[i].replace(/"/g, '\\\"') + "' ";
  }

  if (campaignNameContains.length == 0) {
    whereStatementsArray = [whereStatement];
  } else {
    for (var i = 0; i < campaignNameContains.length; i++) {
      whereStatementsArray.push(whereStatement + 'AND CampaignName CONTAINS_IGNORE_CASE "' + campaignNameContains[i].replace(/"/g, '\\\"') + '" ');
    }
  }

  for (var i = 0; i < whereStatementsArray.length; i++) {
    var adTextReport = AdWordsApp.report(
      'SELECT CampaignId '
      + 'FROM   CAMPAIGN_PERFORMANCE_REPORT '
      + whereStatementsArray[i]
      + 'DURING LAST_30_DAYS'
    );

    var rows = adTextReport.rows();
    while (rows.hasNext()) {
      var row = rows.next();
      campaignIds.push(row.CampaignId);
    }
  }

  if (campaignIds.length == 0) {
    throw ('No campaigns found with the given settings.');
  }

  Logger.log(campaignIds.length + ' campaigns found');
  return campaignIds;
}

// Prints an array of rows into the spreadsheet
function printRows(sheet, title, headers, rows) {
  try {
    sheet.getRange('R' + (sheet.getLastRow() + 2) + 'C1').setValue(title);
    sheet.getRange('R' + sheet.getLastRow() + 'C1').clearFormat();
    sheet.getRange('R' + sheet.getLastRow() + 'C1').setFontWeight('bold');

    if (rows.length == 0) {
      sheet.appendRow(['No issues found']);
      sheet.getRange('R' + sheet.getLastRow() + 'C1').clearFormat();
      Logger.log("Nothing to output for '" + title + "'");
      return;
    }

    if (headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange('R' + sheet.getLastRow() + 'C1:R' + sheet.getLastRow() + 'C' + headers.length).clearFormat();
      sheet.getRange('R' + sheet.getLastRow() + 'C1:R' + sheet.getLastRow() + 'C' + headers.length).setFontStyle('italic');
    }

    var lastRow = sheet.getLastRow();
    sheet.getRange('R' + (lastRow + 1) + 'C1:R' + (lastRow + rows.length)
    + 'C' + (rows[0].length)).setValues(rows);
    sheet.getRange('R' + (lastRow + 1) + 'C1:R' + (lastRow + rows.length)
    + 'C' + (rows[0].length)).clearFormat();
    sheet.getRange('R' + (lastRow + 1) + 'C1:R' + (lastRow + rows.length)
    + 'C' + (rows[0].length)).setNumberFormat('#,###,##0');

    Logger.log('Printed ' + rows.length + " rows for '" + title + "'");
  } catch (e) {
    Logger.log("Printing rows '" + title + "' failed: " + e);

    if (e == 'Exception: This action would increase the number of cells in the worksheet above the limit of 2000000 cells.') {
      try {
        sheet.appendRow(['Not enough space to write the data.']);
      } catch (e2) {
        Logger.log("Error writing 'not enough space' message: " + e2);
      }
    }
  }
}

// Returns an array mapping the ad group ID to the number of entities found in the ad group.
// reportType and extraWhereStatements are used to specify the type of entity.
// campaignIds specifies which campaigns to look in.
function getNumberOfEntitiesPerAdGroup(reportType, extraWhereStatements, campaignIds) {
  var numberOfEntities = {};

  var report = AdWordsApp.report(
    'SELECT AdGroupId '
    + 'FROM   ' + reportType + ' '
    + 'WHERE AdGroupStatus = ENABLED '
    + extraWhereStatements
    + 'AND CampaignId IN [' + campaignIds.join(',') + '] '
    + 'DURING LAST_30_DAYS'
  );

  var rows = report.rows();

  while (rows.hasNext()) {
    var row = rows.next();
    if (numberOfEntities[row.AdGroupId] == undefined) {
      numberOfEntities[row.AdGroupId] = 1;
    } else {
      numberOfEntities[row.AdGroupId]++;
    }
  }

  return numberOfEntities;
}

// Finds ad groups without the right number of ads or keywords,
// and outputs these to a spreadsheet
function adGroupChecking(campaignIds, sheet) {
  // Get the arrays mapping ad group IDs to the number of ads and
  // keywords those groups contain
  if (ignorePausedAds) {
    var adStatus = 'AND Status = ENABLED ';
  } else {
    var adStatus = 'AND Status IN [ENABLED,PAUSED] ';
  }
  var numberOfAds = getNumberOfEntitiesPerAdGroup('AD_PERFORMANCE_REPORT', adStatus + 'AND CombinedApprovalStatus != DISAPPROVED ', campaignIds);
  Logger.log('Found ad groups with ads.');

  if (ignorePausedKeywords) {
    var keywordStatus = 'AND Status = ENABLED ';
  } else {
    var keywordStatus = 'AND Status IN [ENABLED,PAUSED] ';
  }
  var numberOfKeywords = getNumberOfEntitiesPerAdGroup('KEYWORDS_PERFORMANCE_REPORT', keywordStatus + 'AND ApprovalStatus != DISAPPROVED AND IsNegative = FALSE ', campaignIds);
  Logger.log('Found ad groups with keywords.');

  if (findAdGroupsWithoutMobileAds) {
    // DevicePreference = 30001 means the ads are mobile preferred
    var numberOfMobileAds = getNumberOfEntitiesPerAdGroup('AD_PERFORMANCE_REPORT', adStatus + 'AND CombinedApprovalStatus != DISAPPROVED AND DevicePreference = 30001 ', campaignIds);
    Logger.log('Found ad groups with mobile ads.');
  }

  if (findAdGroupsWithNoNegatives) {
    // First get the number of broad match keywords in each ad group,
    // and the number of ad group level negatives
    var numberOfBroadKeywords = getNumberOfEntitiesPerAdGroup('KEYWORDS_PERFORMANCE_REPORT', keywordStatus + 'AND ApprovalStatus != DISAPPROVED AND IsNegative = FALSE AND KeywordMatchType = BROAD ', campaignIds);
    var numberOfGroupNegatives = getNumberOfEntitiesPerAdGroup('KEYWORDS_PERFORMANCE_REPORT', 'AND Status = ENABLED AND IsNegative = TRUE ', campaignIds);

    // Get the number of campaign level negatives in each campaign
    var numberOfCampaignNegatives = {};
    var report = AdWordsApp.report(
      'SELECT CampaignId '
      + 'FROM   CAMPAIGN_NEGATIVE_KEYWORDS_PERFORMANCE_REPORT '
      + 'WHERE  IsNegative = TRUE '
      + 'AND CampaignId IN [' + campaignIds.join(',') + ']'
    );
    var rows = report.rows();
    while (rows.hasNext()) {
      var row = rows.next();
      if (numberOfCampaignNegatives[row.CampaignId] == undefined) {
        numberOfCampaignNegatives[row.CampaignId] = 1;
      } else {
        numberOfCampaignNegatives[row.CampaignId]++;
      }
    }

    // Get the number of negatives in each shared set
    var numberOfNegativesInSharedSets = {};
    var sharedSetReport = AdWordsApp.report(
      'SELECT Name, MemberCount '
      + 'FROM   SHARED_SET_REPORT '
      + 'WHERE Status = ENABLED AND Type = NEGATIVE_KEYWORDS '
      + 'AND ReferenceCount != 0 AND MemberCount != 0'
    );
    var rows = sharedSetReport.rows();
    while (rows.hasNext()) {
      var row = rows.next();
      numberOfNegativesInSharedSets[row.Name] = parseInt(row.MemberCount, 10);
    }

    // Add the number of negatives from a shared set to the number recorded
    // for each campaign the shared set is used by.
    var campaignSharedSetReport = AdWordsApp.report(
      'SELECT CampaignId, SharedSetName '
      + 'FROM   CAMPAIGN_SHARED_SET_REPORT '
      + 'WHERE Status = ENABLED AND SharedSetType = NEGATIVE_KEYWORDS '
      + 'AND CampaignId IN [' + campaignIds.join(',') + ']'
    );
    var rows = campaignSharedSetReport.rows();
    while (rows.hasNext()) {
      var row = rows.next();
      if (numberOfNegativesInSharedSets[row.SharedSetName] != undefined && numberOfNegativesInSharedSets[row.SharedSetName] > 0) {
        if (numberOfCampaignNegatives[row.CampaignId] == undefined) {
          numberOfCampaignNegatives[row.CampaignId] = numberOfNegativesInSharedSets[row.SharedSetName];
        } else {
          numberOfCampaignNegatives[row.CampaignId] += numberOfNegativesInSharedSets[row.SharedSetName];
        }
      }
    }
    Logger.log('Found ad groups and campaigns with negatives.');
  }

  // These record the rows to be written to the spreadsheet.
  var adGroupsWithoutKeywords = [];
  var adGroupsWithTooManyKeywords = [];
  var adGroupsWithoutAds = [];
  var adGroupsWithTooFewAds = [];
  var adGroupsWithoutMobileAds = [];
  var adGroupsWithoutNegatives = [];

  // Go through each ad group, and check the number of entities
  // If the number of entities is undefined, then there are 0 of those
  // entities within the ad group.
  var adGroupReport = AdWordsApp.report(
    'SELECT AdGroupId, CampaignId, CampaignName, AdGroupName '
    + 'FROM   ADGROUP_PERFORMANCE_REPORT '
    + 'WHERE AdGroupStatus = ENABLED '
    + 'AND CampaignId IN [' + campaignIds.join(',') + '] '
    + 'DURING LAST_30_DAYS'
  );
  var rows = adGroupReport.rows();
  while (rows.hasNext()) {
    var row = rows.next();

    if (numberOfKeywords[row.AdGroupId] == undefined) {
      adGroupsWithoutKeywords.push([row.CampaignName, row.AdGroupName]);
    } else if (numberOfKeywords[row.AdGroupId] > maximumKeywordsPerAdGroup) {
      adGroupsWithTooManyKeywords.push([row.CampaignName, row.AdGroupName, numberOfKeywords[row.AdGroupId]]);
    }

    if (numberOfAds[row.AdGroupId] == undefined) {
      adGroupsWithoutAds.push([row.CampaignName, row.AdGroupName]);
    } else if (numberOfAds[row.AdGroupId] < minimumAdsPerAdGroup) {
      adGroupsWithTooFewAds.push([row.CampaignName, row.AdGroupName, numberOfAds[row.AdGroupId]]);
    }

    if (findAdGroupsWithoutMobileAds && numberOfAds[row.AdGroupId] != undefined && numberOfMobileAds[row.AdGroupId] == undefined) {
      adGroupsWithoutMobileAds.push([row.CampaignName, row.AdGroupName]);
    }

    if (findAdGroupsWithNoNegatives
        && numberOfBroadKeywords[row.AdGroupId] != undefined
        && numberOfGroupNegatives[row.AdGroupId] == undefined
        && numberOfCampaignNegatives[row.CampaignId] == undefined
    ) {
      adGroupsWithoutNegatives.push([row.CampaignName, row.AdGroupName, numberOfBroadKeywords[row.AdGroupId]]);
    }
  }

  // Create a summary, with the number of ad groups found.
  var summary = [];
  summary.push(['Ad Groups With No Keywords', adGroupsWithoutKeywords.length]);
  summary.push(['Ad Groups With No Ads', adGroupsWithoutAds.length]);
  summary.push(['Ad Groups With More Than ' + maximumKeywordsPerAdGroup + ' Keywords', adGroupsWithTooManyKeywords.length]);
  summary.push(['Ad Groups With Fewer Than ' + minimumAdsPerAdGroup + ' Ads', adGroupsWithTooFewAds.length]);
  if (findAdGroupsWithoutMobileAds) {
    summary.push(['Ad Groups With No Mobile Preferred Ads', adGroupsWithoutMobileAds.length]);
  }
  if (findAdGroupsWithNoNegatives) {
    summary.push(['Ad Groups With Broad Keywords But No Negatives', adGroupsWithoutNegatives.length]);
  }
  printRows(sheet, 'Summary', [], summary);


  // Output the ad group names
  var headers = ['Campaign', 'Ad Group'];
  printRows(sheet, 'Ad Groups With No Keywords', headers, adGroupsWithoutKeywords);
  printRows(sheet, 'Ad Groups With No Ads', headers, adGroupsWithoutAds);

  var headers = ['Campaign', 'Ad Group', 'Number of Keywords'];
  printRows(sheet, 'Ad Groups With More Than ' + maximumKeywordsPerAdGroup + ' Keywords', headers, adGroupsWithTooManyKeywords);

  var headers = ['Campaign', 'Ad Group', 'Number of Ads'];
  printRows(sheet, 'Ad Groups With Fewer Than ' + minimumAdsPerAdGroup + ' Ads', headers, adGroupsWithTooFewAds);

  if (findAdGroupsWithoutMobileAds) {
    var headers = ['Campaign', 'Ad Group'];
    printRows(sheet, 'Ad Groups With No Mobile Preferred Ads', headers, adGroupsWithoutMobileAds);
  }

  if (findAdGroupsWithNoNegatives) {
    var headers = ['Campaign', 'Ad Group', 'Number of Broad Keywords'];
    printRows(sheet, 'Ad Groups With Broad Keywords But No Negatives', headers, adGroupsWithoutNegatives);
  }
}
