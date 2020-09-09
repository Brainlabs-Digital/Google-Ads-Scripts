// ID: 5f9336ded924837ec558ece788376d09
/**
 *
 * Ad Rotate Analysis
 *
 * This script finds the best ad in each ad group (subject to thresholds) and
 * calculates the performance you could have got if the impressions that went to
 * losing ads went to the winning ads instead.
 *
 * Version: 1.1
 * Updated 2016-10-11: removed 'ConvertedClicks'
 * Updated 2017-01-05: changed 'CreativeApprovalStatus' to 'CombinedApprovalStatus'
 * Google AdWords Script maintained on brainlabsdigital.com
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
// while ["Brand","Generic"] would only look at campaigns with 'Brand' or 'Generic'
// in the name.
// Leave as [] to include all campaigns.

var ignorePausedCampaigns = true;
// Set this to true to only look at currently active campaigns.
// Set to false to also include campaigns that are currently paused.

var ignorePausedAdGroups = true;
// Set this to true to only look at currently active ad groups.
// Set to false to also include ad groups that are currently paused.

var conversionMetrics = ['Conversions'];
// The spreadsheet will report clicks, impressions and cost and this conversion metric(s).
// Allowed fields: "Conversions", "ConversionValue"
// If you'd like more than one separate witha comma, eg ["Conversions", "ConversionValue"]

// These settings are to set which metric determines an ad is the best in its group
var winningMetricName = 'CTR'; // The name used in the output spreadsheet
var winningMetricMultiplier = 'Clicks';
var winningMetricDivisor = 'Impressions';
// The metric will be calculated by dividing winningMetricMultiplier by winningMetricDivisor
// eg to compare conversions per impression, winningMetricMultiplier is "Conversions"
// and winningMetricDivisor is "Impressions".
// winningMetricMultiplier and winningMetricDivisor can be any of "Impressions", "Clicks",
// "Cost", "Conversions", "ConversionValue"

var impressionThreshold = 1000;
var clickThreshold = 0;
// This is used to weed out low traffic ad groups - only ads with this many
// impressions and clicks are considered

var dateRange = '20160101, 20160630';
// This is the date range for the ad's performance.
// Don't set it too short or there won't be enough traffic!
// Possible values: "LAST_30_DAYS", "LAST_MONTH", "THIS_MONTH"
// or custom date ranges formatted "yyyymmdd, yyyymmdd"

var currencySymbol = '£';
// Used for formatting currencies in the output spreadsheet.


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Functions

function main() {
  // Check the spreadsheet URL works
  var spreadsheet = checkSpreadsheet(spreadsheetUrl, 'the spreadsheet');

  // Make all of the required sheets
  var sheetNames = ['Overview', 'All Device Ads', 'Mobile Preferred Ads'];
  var sheets = {};
  for (var i = 0; i < sheetNames.length; i++) {
    sheets[sheetNames[i]] = spreadsheet.getSheetByName(sheetNames[i]);
    if (sheets[sheetNames[i]] === null) {
      sheets[sheetNames[i]] = spreadsheet.insertSheet(sheetNames[i], i);
    } else {
      sheets[sheetNames[i]].clear();
    }
  }

  // Get the campaign IDs (based on campaignNameDoesNotContain, campaignNameContains and ignorePausedCampaigns)
  var campaignIds = getCampaignIds();

  // Check all the required metrics are listed, and make sure they are trimmed and correctly capitalised
  var allowedFields = ['Conversions', 'ConversionValue', 'Impressions', 'Clicks', 'Cost'];
  var metricsToReport = ['Impressions', 'Clicks', 'Cost'].concat(conversionMetrics);
  var metrics = checkFieldNames(allowedFields, metricsToReport);
  winningMetricMultiplier = checkFieldNames(allowedFields, [winningMetricMultiplier])[0];
  winningMetricDivisor = checkFieldNames(allowedFields, [winningMetricDivisor])[0];
  if (metrics.indexOf(winningMetricMultiplier) == -1) {
    metrics.push(winningMetricMultiplier);
  }
  if (metrics.indexOf(winningMetricDivisor) == -1) {
    metrics.push(winningMetricDivisor);
  }

  // Run the analysis
  rotateAnalysis(campaignIds, sheets, metrics);

  Logger.log('Finished rotate analysis.');
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


// Verify that all field names are valid, and return a list of them with the
// correct capitalisation
function checkFieldNames(allowedFields, givenFields) {
  var allowedFieldsLowerCase = allowedFields.map(function (str) {
    return str.toLowerCase();
  });
  var wantedFields = [];
  var unrecognisedFields = [];
  for (var i = 0; i < givenFields.length; i++) {
    var fieldIndex = allowedFieldsLowerCase.indexOf(givenFields[i].toLowerCase().replace(' ', '').trim());
    if (fieldIndex === -1) {
      unrecognisedFields.push(fields[i]);
    } else {
      wantedFields.push(allowedFields[fieldIndex]);
    }
  }

  if (unrecognisedFields.length > 0) {
    throw unrecognisedFields.length + " field(s) not recognised: '" + unrecognisedFields.join("', '")
    + "'. Please choose from '" + allowedFields.join("', '") + "'.";
  }

  return wantedFields;
}


// This returns an array of formats corresponding to the given array of metrics
// to use when formatting a Google Sheet
function getFormats(metrics) {
  // Note: while these formats use , to separate thousands and . as a decimal marker,
  // the way they are shown in the Google Sheet depends on the Sheet's locale setting.
  var metricFormats = {};
  metricFormats.Conversions = '#,###,##0';
  metricFormats.ConversionValue = currencySymbol + '#,###,##0.00';
  metricFormats.Impressions = '#,###,##0';
  metricFormats.Clicks = '#,###,##0';
  metricFormats.Cost = currencySymbol + '#,###,##0.00';

  var formats = [];
  for (var i = 0; i < metrics.length; i++) {
    if (metricFormats[metrics[i]] == undefined) {
      formats.push('#,###,##0');
    } else {
      formats.push(metricFormats[metrics[i]]);
    }
  }

  return formats;
}


// Prints an array of rows into the spreadsheet
// and formats them all according to formatRow
function printFormattedRows(sheet, rows, formatRow) {
  try {
    if (rows.length == 0) {
      Logger.log('Nothing to output in ' + sheet.getName());
      return;
    }

    var lastRow = sheet.getLastRow();
    sheet.getRange('R' + (lastRow + 1) + 'C1:R' + (lastRow + rows.length)
      + 'C' + (rows[0].length)).setValues(rows);
    sheet.getRange('R' + (lastRow + 1) + 'C1:R' + (lastRow + rows.length)
      + 'C' + (rows[0].length)).clearFormat();
    Logger.log('Printed ' + rows.length + ' rows in ' + sheet.getName());

    if (formatRow.length > 0) {
      var formatRows = [];
      for (var i = 0; i < rows.length; i++) {
        formatRows.push(formatRow);
      }
      sheet.getRange('R' + (lastRow + 1) + 'C1:R' + (lastRow + formatRows.length)
        + 'C' + (formatRows[0].length)).setNumberFormats(formatRows);
    }
  } catch (e) {
    Logger.log('Printing rows in ' + sheet.getName() + ' failed: ' + e);

    if (e == 'Exception: This action would increase the number of cells in the worksheet above the limit of 2000000 cells.') {
      try {
        sheet.appendRow(['Not enough space to write the data.']);
      } catch (e2) {
        Logger.log("Error writing 'not enough space' message: " + e2);
      }
    }
  }
}


// Prints an array of rows into the spreadsheet
// with the given title, headers and format
function printRowsWithTitle(sheet, title, headers, rows, formatRow) {
  try {
    sheet.getRange('R' + (sheet.getLastRow() + 2) + 'C1').setValue(title);
    sheet.getRange('R' + sheet.getLastRow() + 'C1').clearFormat();
    sheet.getRange('R' + sheet.getLastRow() + 'C1').setFontWeight('bold');

    if (rows.length == 0) {
      sheet.appendRow(['No data']);
      sheet.getRange('R' + sheet.getLastRow() + 'C1').clearFormat();
      Logger.log("Nothing to output for '" + title + "'");
      return;
    }

    if (headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange('R' + sheet.getLastRow() + 'C1:R' + sheet.getLastRow() + 'C' + headers.length).clearFormat();
      sheet.getRange('R' + sheet.getLastRow() + 'C1:R' + sheet.getLastRow() + 'C' + headers.length).setFontStyle('italic');
    }

    printFormattedRows(sheet, rows, formatRow);
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


// Goes through each ad group to perform the rotation analysis
function rotateAnalysis(campaignIds, sheets, metrics) {
  // First we find the ad groups which have multiple ads with enough impressions.
  // We need to consider mobile preferred ads separately to desktop ones
  var groupsWithImpressions = {};
  var groupsWithMultipleAds = {};
  var groupsWithMobileImpressions = {};
  var groupsWithMultipleMobileAds = {};
  if (ignorePausedAdGroups) {
    var groupStatus = 'AND AdGroupStatus = ENABLED ';
  } else {
    var groupStatus = "AND AdGroupStatus IN ['ENABLED','PAUSED'] ";
  }

  var adGroupReport = AdWordsApp.report(
    'SELECT CampaignName, AdGroupId, AdGroupName, DevicePreference '
    + 'FROM   AD_PERFORMANCE_REPORT '
    + 'WHERE CampaignId IN [' + campaignIds.join(',') + '] ' + groupStatus
    + 'AND Status = ENABLED AND Impressions >= ' + impressionThreshold + ' '
    + 'AND Clicks >= ' + clickThreshold + ' '
    + 'AND CombinedApprovalStatus != DISAPPROVED '
    + 'DURING ' + dateRange
  );
  var rows = adGroupReport.rows();
  while (rows.hasNext()) {
    var row = rows.next();
    if (row.DevicePreference != '30001') { // This is not mobile preferred ads
      if (groupsWithImpressions[row.AdGroupId] == undefined) {
        // This happens if it is the first time an ad group has appeared in the report
        groupsWithImpressions[row.AdGroupId] = true;
      } else if (groupsWithMultipleAds[row.AdGroupId] == undefined) {
        // This happens the second time an ad group appears in the report
        groupsWithMultipleAds[row.AdGroupId] = true;
      }
    } else { // These are mobile preferred ads.
      // They are treated separately, as mobiles will perform differently to other devices
      if (groupsWithMobileImpressions[row.AdGroupId] == undefined) {
        groupsWithMobileImpressions[row.AdGroupId] = true;
      } else if (groupsWithMultipleMobileAds[row.AdGroupId] == undefined) {
        groupsWithMultipleMobileAds[row.AdGroupId] = true;
      }
    }
  }

  if (Object.keys(groupsWithMultipleAds).length == 0 && Object.keys(groupsWithMultipleMobileAds).length == 0) {
    Logger.log('No ad groups with more than 1 ad above the impression threshold of ' + impressionThreshold + ' in the given date range.');
    return;
  }

  Logger.log('Found ' + Object.keys(groupsWithMultipleAds).length + ' ad groups with multiple all device ads, and '
    + Object.keys(groupsWithMultipleMobileAds).length + ' ad groups with multiple mobile preferred ads');

  // Now we go through the all device ads which have multiple ads over the impression threshold
  // and record the stats for all ads
  var headers = ['Campaign', 'Ad Group', 'Number of Ads', 'Winning Ad', 'Winning Ad ID', 'Winning '
    + winningMetricName
  ].concat(metrics.map(function (a) {
    return 'Actual ' + a.replace(/([A-Z])/g, ' $&').trim();
  }), ['Actual ' + winningMetricName],
    metrics.map(function (a) {
      return 'Possible ' + a.replace(/([A-Z])/g, ' $&').trim();
    }));

  sheets['All Device Ads'].appendRow(headers);
  sheets['All Device Ads'].getRange('R' + sheets['All Device Ads'].getLastRow() + 'C1:R' + sheets['All Device Ads'].getLastRow() + 'C' + headers.length).setFontWeight('bold');
  var metricFormats = getFormats(metrics);
  var formatRow = ['#,###,##0', '#,###,##0', '#,###,##0', '#,###,##0', '#', '#,##0.00%'].concat(metricFormats, ['#,##0.00%'], metricFormats);

  var initialisedArray = []; // This will be copied whenever we need an array to store metrics in
  for (var i = 0; i < metrics.length; i++) {
    initialisedArray[i] = 0;
  }
  var allDeviceTotals = {};
  allDeviceTotals.Actual = initialisedArray.slice();
  allDeviceTotals.Possible = initialisedArray.slice();

  var devicePreference = '!= "30001"';
  var allAdGroupIds = Object.keys(groupsWithMultipleAds);

  // We get the data in batches of ad groups, so we don't run out of memory
  // and because reports can only take 10,000 IDs at once.
  var batchSize = 10000;
  for (var i = 0; i < allAdGroupIds.length; i += batchSize) {
    // This function outputs the ad group level data, and returns a running total
    // of the stats and possible stats
    allDeviceTotals = calculateAdGroupPotential(sheets['All Device Ads'], allAdGroupIds.slice(i, i + batchSize), metrics, formatRow, devicePreference, allDeviceTotals);
  }

  // Sort the new rows in the spreadsheet
  if (sheets['All Device Ads'].getLastRow() > 1) {
    sheets['All Device Ads'].getRange(2, 1, sheets['All Device Ads'].getLastRow() - 1, headers.length).sort({
      column: 7,
      ascending: false
    });
  }

  // Do the same for mobile preferred ads
  sheets['Mobile Preferred Ads'].appendRow(headers);
  sheets['Mobile Preferred Ads'].getRange('R' + sheets['Mobile Preferred Ads'].getLastRow() + 'C1:R' + sheets['Mobile Preferred Ads'].getLastRow() + 'C' + headers.length).setFontWeight('bold');
  var mobilePreferredTotals = {};
  mobilePreferredTotals.Actual = initialisedArray.slice();
  mobilePreferredTotals.Possible = initialisedArray.slice();
  var devicePreference = '= "30001"';
  var allAdGroupIds = Object.keys(groupsWithMultipleMobileAds);
  for (var i = 0; i < allAdGroupIds.length; i += batchSize) {
    mobilePreferredTotals = calculateAdGroupPotential(sheets['Mobile Preferred Ads'], allAdGroupIds.slice(i, i + batchSize), metrics, formatRow, devicePreference, mobilePreferredTotals);
  }
  if (sheets['Mobile Preferred Ads'].getLastRow() > 1) {
    sheets['Mobile Preferred Ads'].getRange(2, 1, sheets['Mobile Preferred Ads'].getLastRow() - 1, headers.length).sort({
      column: 7,
      ascending: false
    });
  }

  // Total the data
  var total = {
    Actual: [],
    Possible: [],
    Difference: [],
    Percent: []
  };
  for (var i = 0; i < metrics.length; i++) {
    total.Actual[i] = allDeviceTotals.Actual[i] + mobilePreferredTotals.Actual[i];
    total.Possible[i] = allDeviceTotals.Possible[i] + mobilePreferredTotals.Possible[i];
  }

  // Calculate the average winning metric
  var data = [allDeviceTotals.Actual, allDeviceTotals.Possible, mobilePreferredTotals.Actual, mobilePreferredTotals.Possible, total.Actual, total.Possible];
  var multiplierIndex = metrics.indexOf(winningMetricMultiplier);
  var divisorIndex = metrics.indexOf(winningMetricDivisor);
  for (var i = 0; i < data.length; i++) {
    if (data[i][divisorIndex] != 0) {
      data[i].push(data[i][multiplierIndex] / data[i][divisorIndex]);
    } else {
      data[i].push('-');
    }
  }

  // Calculate differences between actual and possible, and output an overview
  sheets.Overview.appendRow(['Ad Rotate Analysis']);
  sheets.Overview.getRange('R1C1').setFontWeight('bold');
  var headers = [''].concat(metrics.map(function (a) {
    return a.replace(/([A-Z])/g, ' $&').trim();
  }), [winningMetricName]);
  var rowNames = ['Actual', 'Possible', 'Difference', 'Percent'];
  var formatRow = ['#,###,##0'].concat(metricFormats, ['#,##0.00%']);

  allDeviceTotals.Difference = [];
  allDeviceTotals.Percent = [];
  mobilePreferredTotals.Difference = [];
  mobilePreferredTotals.Percent = [];
  var data = [total, allDeviceTotals, mobilePreferredTotals];
  var dataNames = ['Total', 'All Device Ads', 'Mobile Preferred Ads'];
  for (var j = 0; j < data.length; j++) {
    for (var i = 0; i < metrics.length + 1; i++) {
      if (data[j].Possible[i] == '-' || data[j].Actual[i] == '-') {
        data[j].Difference[i] = '-';
        data[j].Percent[i] = '-';
      } else {
        data[j].Difference[i] = data[j].Possible[i] - data[j].Actual[i];
        if (data[j].Actual[i] != 0) {
          data[j].Percent[i] = (data[j].Difference[i] / data[j].Actual[i]);
        } else {
          data[j].Percent[i] = '-';
        }
      }
    }

    var totalRows = [];
    for (var r = 0; r < rowNames.length; r++) {
      totalRows.push([rowNames[r]].concat(data[j][rowNames[r]]));
    }
    printRowsWithTitle(sheets.Overview, dataNames[j], headers, totalRows, formatRow);
    sheets.Overview.getRange('R' + sheets.Overview.getLastRow() + 'C1:R' + sheets.Overview.getLastRow()
      + 'C' + (headers.length)).setNumberFormat('#,###,##0.00%'); // Format the percent line as percentages
  }
}


// This goes thorugh the given ad groups, finds their stats and possible stats and
// writes them to the spreadsheet. It also uses the runningTotals object to keep a
// running total of the stats for the Overview sheet.
function calculateAdGroupPotential(sheet, adGroupIds, metrics, formatRow, devicePreference, runningTotals) {
  var initialisedArray = []; // This will be copied whenever we need an array to store metrics in
  for (var i = 0; i < metrics.length; i++) {
    initialisedArray[i] = 0;
  }

  var groupData = {};
  var impressionIndex = metrics.indexOf('Impressions');
  var multiplierIndex = metrics.indexOf(winningMetricMultiplier);
  var divisorIndex = metrics.indexOf(winningMetricDivisor);
  var adReport = AdWordsApp.report(
    'SELECT CampaignName, AdGroupId, AdGroupName, Id, Headline, Description1, Description2, ' + metrics.join(', ') + ' '
    + 'FROM   AD_PERFORMANCE_REPORT '
    + 'WHERE  Status = ENABLED AND Impressions >= ' + impressionThreshold + ' '
    + 'AND Clicks >= ' + clickThreshold + ' '
    + 'AND CombinedApprovalStatus != DISAPPROVED '
    + 'AND AdGroupId IN [' + adGroupIds.join(',') + '] '
    + 'AND DevicePreference ' + devicePreference + ' '
    + 'DURING ' + dateRange
  );

  var rows = adReport.rows();
  while (rows.hasNext()) {
    var row = rows.next();

    if (groupData[row.AdGroupId] == undefined) {
      // If this is the first time we've come across this ad group,
      // record its details
      groupData[row.AdGroupId] = {};
      groupData[row.AdGroupId].Names = [row.CampaignName, row.AdGroupName];
      groupData[row.AdGroupId].Ads = [];
      groupData[row.AdGroupId].Total = initialisedArray.slice();
    }

    var adStats = [];
    for (var i = 0; i < metrics.length; i++) {
      var metric = parseFloat(row[metrics[i]].replace(/,/g, ''));
      adStats[i] = metric;
      groupData[row.AdGroupId].Total[i] += metric;
    }

    var adDetails = [row.Headline, row.Description1, row.Description2];

    if (adStats[divisorIndex] != 0) {
      var winningMetric = adStats[multiplierIndex] / adStats[divisorIndex];
    } else {
      var winningMetric = 0;
    }

    groupData[row.AdGroupId].Ads.push([winningMetric, adStats, adDetails, row.Id]);
  }

  var outputRows = []; // This will be written to a spreadsheet at the end of the function.

  // Go through the ad groups, find the best ad
  for (var j = 0; j < adGroupIds.length; j++) {
    var groupPotential = initialisedArray.slice();
    // This will be the stats you could have got if the impressions went to the best ad
    // rather than the other ads

    var adsToCompare = groupData[adGroupIds[j]].Ads; // This is the list of ads

    // Order the ads from best to worst
    adsToCompare.sort(function (a, b) {
      return b[0] - a[0];
    });

    if (adsToCompare[0][0] == 0) {
      // This means the best ad's winning metric has a value of 0.
      // So we skip this ad group.
      continue;
    }

    if (adsToCompare[0][0] == adsToCompare[1][0]) {
      // This means there are at least 2 ads tied for highest winning metric value
      // rather than a single winner. The best stats are the average of the stats
      // of these ads
      var bestStats = adsToCompare[0][1];
      var notBestAdsIndex = null;
      for (var a = 1; a < adsToCompare.length; a++) {
        if (adsToCompare[0][0] == adsToCompare[a][0]) {
          for (var i = 0; i < metrics.length; i++) {
            bestStats[i] += adsToCompare[a][1][i];
          }
        } else {
          notBestAdsIndex = a;
          break;
        }
      }
      if (notBestAdsIndex == null) { // All ads were tied, so no ads lost
        continue;
      }
      var groupPotential = bestStats.slice();
      for (var n = notBestAdsIndex; n < adsToCompare.length; n++) {
        for (var i = 0; i < metrics.length; i++) {
          groupPotential[i] += adsToCompare[n][1][impressionIndex] * bestStats[i] / bestStats[impressionIndex];
        }
      }
    } else {
      // There's one ad which is the best.
      var bestStats = adsToCompare[0][1];
      for (var n = 0; n < adsToCompare.length; n++) {
        for (var i = 0; i < metrics.length; i++) {
          groupPotential[i] += adsToCompare[n][1][impressionIndex] * bestStats[i] / bestStats[impressionIndex];
        }
      }
    }

    // Update the running totals
    for (var i = 0; i < metrics.length; i++) {
      runningTotals.Possible[i] += groupPotential[i];
      runningTotals.Actual[i] += groupData[adGroupIds[j]].Total[i];
    }

    // Make a row for the output spreadsheet
    var line = groupData[adGroupIds[j]].Names.concat([adsToCompare.length, adsToCompare[0][2].join(' / '), adsToCompare[0][3], adsToCompare[0][0]], groupData[adGroupIds[j]].Total);
    if (groupData[adGroupIds[j]].Total[divisorIndex] != 0) {
      var avgWinningMetric = groupData[adGroupIds[j]].Total[multiplierIndex] / groupData[adGroupIds[j]].Total[divisorIndex];
    } else {
      var avgWinningMetric = 0;
    }
    line.push(avgWinningMetric);
    line = line.concat(groupPotential);
    outputRows.push(line);
  }

  // Output the ad groups' data
  printFormattedRows(sheet, outputRows, formatRow);

  return runningTotals;
}
