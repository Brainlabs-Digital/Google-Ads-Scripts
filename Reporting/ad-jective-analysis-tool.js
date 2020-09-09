// ID: 058fb23a3c9f9c64c0a09775fefc389c
/**
 *
 * Ad-jective Analysis Tool
 *
 * This script calculates the performance of user-defined phrases in the search
 * query report, and outputs a report into a Google Doc spreadsheet.
 *
 * Version: 1.0
 * Google AdWords Script maintained on brainlabsdigital.com
 *
 */

function main() {
  // ////////////////////////////////////////////////////////////////////////////
  // Options

  var startDate = '2017-05-01';
  var endDate = '2017-07-31';
  // The start and end date of the date range for your search query data
  // Format is yyyy-mm-dd
  // leave blank to look back over the last 11 months

  var currencySymbol = '£';
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

  var spreadsheetUrl = 'https://docs.google.com/YOUR-SPREADSHEET-URL-HERE';
  // The URL of the Google Doc the results will be put into.

  var adjectives = ['example one', 'example two'];
  // The adjectives to search for in the search query report

  var clearSpreadsheet = true;
  // If true, data already in the spreadsheet will be overwritten.

  var lookAtCompletePhrases = true;
  // Use this if you want to look at exact adjective phrases
  // For example if using the adjective "super"
  // When set to "true" would only look at queries such as "new super shoes"
  // When set to "false" would also allow other occurrences such as "superman shoes"


  // ////////////////////////////////////////////////////////////////////////////
  // Thresholds

  var queryCountThreshold = 0;
  var impressionThreshold = 10;
  var clickThreshold = 0;
  var costThreshold = 0;
  var conversionThreshold = 0;
  // Adjectives will not be reported for ad groups or campaigns  if their statistics
  // are lower than any of these thresholds


  // ////////////////////////////////////////////////////////////////////////////
  // Check the spreadsheet has been entered, and that it works
  var spreadsheet = checkSpreadsheet(spreadsheetUrl, 'the spreadsheet');

  // Get the IDs of the campaigns to look at
  var activeCampaignIds = getCampaignIds(campaignNameDoesNotContain, campaignNameContains, ignorePausedCampaigns);

  // ////////////////////////////////////////////////////////////////////////////
  // Define the statistics to download or calculate, and their formatting
  var statColumns = ['Clicks', 'Impressions', 'Cost', 'Conversions', 'ConversionValue'];
  var calculatedStats = [
    ['CTR', 'Clicks', 'Impressions'],
    ['CPC', 'Cost', 'Clicks'],
    ['Conv. Rate', 'Conversions', 'Clicks'],
    ['Cost / conv.', 'Cost', 'Conversions'],
    ['Conv. value/cost', 'ConversionValue', 'Cost']
  ];
  var currencyFormat = currencySymbol + '#,##0.00';
  var formatting = ['#,##0', '#,##0', '#,##0', currencyFormat, '#,##0', currencyFormat, '0.00%', currencyFormat, '0.00%', currencyFormat, '0.00%'];

  // ////////////////////////////////////////////////////////////////////////////
  // List of possible Months
  var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // ////////////////////////////////////////////////////////////////////////////
  // Adding trailing spaces to the adjectives means the adjectives are only
  // contained in searches where they appear as complete words.
  if (lookAtCompletePhrases) {
    for (var i in adjectives) {
      adjectives[i] = ' ' + adjectives[i].trim() + ' ';
    }
  }

  // ////////////////////////////////////////////////////////////////////////////
  // Go through the search query report, record the performance of each
  // adjective in each query
  var dateRange = startDate.replace(/-/g, '') + ',' + endDate.replace(/-/g, '');
  if (startDate == '' || endDate == '') {
    var now = new Date();
    var endDate = now;
    var startDate = now.setDate(now.getMonth() - 11);
    dateRange = Utilities.formatDate(startDate, 'GMT', 'yyyy-mm-dd') + ',' + Utilities.formatDate(endDate, 'GMT', 'yyyy-mm-dd');
  }

  if (ignorePausedAdGroups) {
    var whereAdGroupStatus = 'AND AdGroupStatus = ENABLED ';
  } else {
    var whereAdGroupStatus = "AND AdGroupStatus IN ['ENABLED','PAUSED'] ";
  }

  var queryReport = AdWordsApp.report(
    'SELECT CampaignName, CampaignId, AdGroupId, AdGroupName, Query, MonthOfYear, ' + statColumns.join(', ') + ' '
    + 'FROM SEARCH_QUERY_PERFORMANCE_REPORT '
    + 'WHERE CampaignId IN [' + activeCampaignIds.join(',') + '] ' + whereAdGroupStatus
    + 'DURING ' + dateRange
  );

  var campaignAdjectives = {};
  var adGroupAdjectives = {};
  var adjectiveReport = {};
  var monthlyReport = {};

  for (var i in adjectives) {
    adjectives[i] = adjectives[i].toLowerCase().trim();
  }

  var queryRows = queryReport.rows();
  while (queryRows.hasNext()) {
    var queryRow = queryRows.next();

    if (lookAtCompletePhrases) {
      var query = ' ' + queryRow.Query + ' ';
    } else {
      var query = queryRow.Query;
    }

    if (campaignAdjectives[queryRow.CampaignName] == undefined) {
      campaignAdjectives[queryRow.CampaignName] = {};
      adGroupAdjectives[queryRow.CampaignName] = {};
    }

    if (adGroupAdjectives[queryRow.CampaignName][queryRow.AdGroupName] == undefined) {
      adGroupAdjectives[queryRow.CampaignName][queryRow.AdGroupName] = {};
    }

    var stats = [];
    for (var i = 0; i < statColumns.length; i++) {
      stats[i] = parseFloat(queryRow[statColumns[i]].replace(/,/g, ''));
    }

    for (var i in adjectives) {
      if (campaignAdjectives[queryRow.CampaignName][adjectives[i]] == undefined) {
        campaignAdjectives[queryRow.CampaignName][adjectives[i]] = {};
        campaignAdjectives[queryRow.CampaignName][adjectives[i]]['Query Count'] = 0;
        for (var s = 0; s < statColumns.length; s++) {
          campaignAdjectives[queryRow.CampaignName][adjectives[i]][statColumns[s]] = 0;
        }
      }
      if (adGroupAdjectives[queryRow.CampaignName][queryRow.AdGroupName][adjectives[i]] == undefined) {
        adGroupAdjectives[queryRow.CampaignName][queryRow.AdGroupName][adjectives[i]] = {};
        adGroupAdjectives[queryRow.CampaignName][queryRow.AdGroupName][adjectives[i]]['Query Count'] = 0;
        for (var s = 0; s < statColumns.length; s++) {
          adGroupAdjectives[queryRow.CampaignName][queryRow.AdGroupName][adjectives[i]][statColumns[s]] = 0;
        }
      }
      if (adjectiveReport[adjectives[i]] == undefined) {
        adjectiveReport[adjectives[i]] = {};
        adjectiveReport[adjectives[i]]['Query Count'] = 0;
        for (var s = 0; s < statColumns.length; s++) {
          adjectiveReport[adjectives[i]][statColumns[s]] = 0;
        }
      }
      if (monthlyReport[adjectives[i]] == undefined) {
        monthlyReport[adjectives[i]] = {};
      }
    }

    for (var i in adjectives) {
      if (query.indexOf(adjectives[i]) > -1) {
        campaignAdjectives[queryRow.CampaignName][adjectives[i]]['Query Count']++;
        adGroupAdjectives[queryRow.CampaignName][queryRow.AdGroupName][adjectives[i]]['Query Count']++;
        adjectiveReport[adjectives[i]]['Query Count']++;

        if (monthlyReport[adjectives[i]][queryRow.MonthOfYear] == undefined) {
          monthlyReport[adjectives[i]][queryRow.MonthOfYear] = {};
          for (var s = 0; s < statColumns.length; s++) {
            monthlyReport[adjectives[i]][queryRow.MonthOfYear][statColumns[s]] = 0;
          }
        }

        for (var s = 0; s < statColumns.length; s++) {
          campaignAdjectives[queryRow.CampaignName][adjectives[i]][statColumns[s]] += stats[s];
          adGroupAdjectives[queryRow.CampaignName][queryRow.AdGroupName][adjectives[i]][statColumns[s]] += stats[s];
          adjectiveReport[adjectives[i]][statColumns[s]] += stats[s];
          monthlyReport[adjectives[i]][queryRow.MonthOfYear][statColumns[s]] += stats[s];
        }
      }
    }
  }

  Logger.log('Finished analysing queries.');


  // ////////////////////////////////////////////////////////////////////////////
  // Output the data into the spreadsheet

  var outputs = [];
  var formats = [];
  var chartOutput = [];

  for (var i in adjectives) {
    outputs[i] = {};
    outputs[i].campaign = [];
    outputs[i].adgroup = [];
    outputs.total = [];
    formats[i] = {};
    formats[i].campaign = [];
    formats[i].adgroup = [];
    formats.total = [];
  }

  var headers = ['Months'];
  var headers = headers.concat(adjectives.map(function (x) {
    return "'" + x;
  }));
  for (var s = 0; s < statColumns.length; s++) {
    chartOutput[s] = [];
    chartOutput[s].push(headers);
    for (var m in months) {
      var monthRow = [];
      var requireMonth = false;
      for (var i in adjectives) {
        if (monthlyReport[adjectives[i]][months[m]] !== undefined) {
          requireMonth = true;
        }
      }
      for (var i in adjectives) {
        if (requireMonth) {
          if (monthlyReport[adjectives[i]][months[m]] !== undefined) {
            if (monthlyReport[adjectives[i]][months[m]][statColumns[s]] !== undefined) {
              if (monthRow.length == 0) {
                monthRow.push(months[m]);
              }
              monthRow.push(monthlyReport[adjectives[i]][months[m]][statColumns[s]]);
            }
          } else {
            if (monthRow.length == 0) {
              monthRow.push(months[m]);
            }
            monthRow.push(0);
          }
        }
      }
      if (monthRow.length > 0) {
        chartOutput[s].push(monthRow);
      }
    }
  }

  // Create headers
  var calcStatNames = [];
  for (var s = 0; s < calculatedStats.length; s++) {
    calcStatNames.push(calculatedStats[s][0]);
  }
  var statNames = statColumns.concat(calcStatNames);
  for (var i in adjectives) {
    outputs[i].campaign.push(['Campaign', 'Phrase', 'Query Count'].concat(statNames));
    outputs[i].adgroup.push(['Campaign', 'Ad Group', 'Phrase', 'Query Count'].concat(statNames));
  }
  outputs.total.push(['Phrase', 'Query Count'].concat(statNames));

  // Organise the ad group level stats into an array for output
  for (var i in adjectives) {
    for (var campaign in adGroupAdjectives) {
      for (var adGroup in adGroupAdjectives[campaign]) {
        // skips adjectives under the thresholds
        if (adGroupAdjectives[campaign][adGroup][adjectives[i]]['Query Count'] < queryCountThreshold) {
          continue;
        }
        if (adGroupAdjectives[campaign][adGroup][adjectives[i]].Impressions < impressionThreshold) {
          continue;
        }
        if (adGroupAdjectives[campaign][adGroup][adjectives[i]].Clicks < clickThreshold) {
          continue;
        }
        if (adGroupAdjectives[campaign][adGroup][adjectives[i]].Cost < costThreshold) {
          continue;
        }
        if (adGroupAdjectives[campaign][adGroup][adjectives[i]].Conversions < conversionThreshold) {
          continue;
        }

        var printline = [campaign, adGroup, adjectives[i], adGroupAdjectives[campaign][adGroup][adjectives[i]]['Query Count']];

        for (var s = 0; s < statColumns.length; s++) {
          printline.push(adGroupAdjectives[campaign][adGroup][adjectives[i]][statColumns[s]]);
        }

        for (var s = 0; s < calculatedStats.length; s++) {
          var multiplier = calculatedStats[s][1];
          var divisor = calculatedStats[s][2];
          if (adGroupAdjectives[campaign][adGroup][adjectives[i]][divisor] > 0) {
            printline.push(adGroupAdjectives[campaign][adGroup][adjectives[i]][multiplier] / adGroupAdjectives[campaign][adGroup][adjectives[i]][divisor]);
          } else {
            printline.push('-');
          }
        }
        outputs[i].adgroup.push(printline);
        formats[i].adgroup.push(['0', '0', '0'].concat(formatting));
      }
    }
  }

  // Organise the campaign level stats into an array for output
  for (var i in adjectives) {
    for (var campaign in campaignAdjectives) {
      // skips adjectives under the thresholds
      if (campaignAdjectives[campaign][adjectives[i]]['Query Count'] < queryCountThreshold) {
        continue;
      }
      if (campaignAdjectives[campaign][adjectives[i]].Impressions < impressionThreshold) {
        continue;
      }
      if (campaignAdjectives[campaign][adjectives[i]].Clicks < clickThreshold) {
        continue;
      }
      if (campaignAdjectives[campaign][adjectives[i]].Cost < costThreshold) {
        continue;
      }
      if (campaignAdjectives[campaign][adjectives[i]].Conversions < conversionThreshold) {
        continue;
      }

      var printline = [campaign, adjectives[i], campaignAdjectives[campaign][adjectives[i]]['Query Count']];

      for (var s = 0; s < statColumns.length; s++) {
        printline.push(campaignAdjectives[campaign][adjectives[i]][statColumns[s]]);
      }

      for (var s = 0; s < calculatedStats.length; s++) {
        var multiplier = calculatedStats[s][1];
        var divisor = calculatedStats[s][2];
        if (campaignAdjectives[campaign][adjectives[i]][divisor] > 0) {
          printline.push(campaignAdjectives[campaign][adjectives[i]][multiplier] / campaignAdjectives[campaign][adjectives[i]][divisor]);
        } else {
          printline.push('-');
        }
      }
      outputs[i].campaign.push(printline);
      formats[i].campaign.push(['0', '0'].concat(formatting));
    }
  }

  // Organise the account level stats into an array for output
  for (var i in adjectives) {
    var printline = [adjectives[i], adjectiveReport[adjectives[i]]['Query Count']];

    for (var s = 0; s < statColumns.length; s++) {
      printline.push(adjectiveReport[adjectives[i]][statColumns[s]]);
    }

    for (var s = 0; s < calculatedStats.length; s++) {
      var multiplier = calculatedStats[s][1];
      var divisor = calculatedStats[s][2];
      if (adjectiveReport[adjectives[i]][divisor] > 0) {
        printline.push(adjectiveReport[adjectives[i]][multiplier] / adjectiveReport[adjectives[i]][divisor]);
      } else {
        printline.push('-');
      }
    }
    outputs.total.push(printline);
    formats.total.push(['0'].concat(formatting));
  }

  var filterText = '';
  if (ignorePausedAdGroups) {
    filterText = 'Active ad groups';
  } else {
    filterText = 'All ad groups';
  }

  if (ignorePausedCampaigns) {
    filterText += ' in active campaigns';
  } else {
    filterText += ' in all campaigns';
  }

  if (campaignNameContains != '') {
    filterText += " containing '" + campaignNameContains + "'";
    if (campaignNameDoesNotContain != '') {
      filterText += " and not containing '" + campaignNameDoesNotContain + "'";
    }
  } else if (campaignNameDoesNotContain != '') {
    filterText += " not containing '" + campaignNameDoesNotContain + "'";
  }

  // Find or create the required sheets
  var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
  var campaignAdjectiveName = [];
  var adGroupAdjectiveName = [];
  var campaignAdjectiveSheet = [];
  var adGroupAdjectiveSheet = [];
  var adjectiveReportSheet = [];

  for (var i in adjectives) {
    campaignAdjectiveName[i] = 'Campaign ' + adjectives[i] + ' Analysis';
    adGroupAdjectiveName[i] = 'Ad Group ' + adjectives[i] + ' Analysis';

    campaignAdjectiveSheet[i] = spreadsheet.getSheetByName(campaignAdjectiveName[i]);
    if (campaignAdjectiveSheet[i] == null) {
      campaignAdjectiveSheet[i] = spreadsheet.insertSheet(campaignAdjectiveName[i]);
    }

    adGroupAdjectiveSheet[i] = spreadsheet.getSheetByName(adGroupAdjectiveName[i]);
    if (adGroupAdjectiveSheet[i] == null) {
      adGroupAdjectiveSheet[i] = spreadsheet.insertSheet(adGroupAdjectiveName[i]);
    }
  }

  for (var i in adjectives) {
    writeOutput(outputs[i].campaign, formats[i].campaign, campaignAdjectiveSheet[i], adjectives[i], 'Campaign', filterText, clearSpreadsheet);
    writeOutput(outputs[i].adgroup, formats[i].adgroup, adGroupAdjectiveSheet[i], adjectives[i], 'Ad Group', filterText, clearSpreadsheet);
  }

  adjectiveReportSheet = spreadsheet.getSheetByName('Account Analysis');
  if (adjectiveReportSheet == null) {
    adjectiveReportSheet = spreadsheet.insertSheet('Account Analysis');
  }
  writeOutput(outputs.total, formats.total, adjectiveReportSheet, 'Phrases', 'Account', filterText, clearSpreadsheet);

  var monthlyAdjectiveName = 'Monthly Report';
  var monthlyAdjectiveSheet = spreadsheet.getSheetByName(monthlyAdjectiveName);
  if (monthlyAdjectiveSheet !== null) {
    spreadsheet.deleteSheet(monthlyAdjectiveSheet);
    SpreadsheetApp.flush();
    monthlyAdjectiveSheet = null;
  }
  var monthlyAdjectiveSheet = spreadsheet.insertSheet(monthlyAdjectiveName);
  SpreadsheetApp.flush();
  createCharts(chartOutput, monthlyAdjectiveSheet, statColumns);

  Logger.log('Finished writing to spreadsheet.');
} // end main function


// Check the spreadsheet URL has been entered, and that it works
function checkSpreadsheet(spreadsheetUrl, spreadsheetName) {
  if (spreadsheetUrl.replace(/[AEIOU]/g, 'X') == 'https://docs.google.com/YXXR-SPRXXDSHXXT-XRL-HXRX') {
    throw ('Problem with ' + spreadsheetName + " URL: make sure you've replaced the default with a valid spreadsheet URL.");
  }
  try {
    var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);

    // Checks if you can edit the spreadsheet
    var sheet = spreadsheet.getSheets()[0];
    var sheetName = sheet.getName();
    sheet.setName(sheetName);

    return spreadsheet;
  } catch (e) {
    throw ('Problem with ' + spreadsheetName + " URL: '" + e + "'");
  }
}


// Get the IDs of campaigns which match the given options
function getCampaignIds(campaignNameDoesNotContain, campaignNameContains, ignorePausedCampaigns) {
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
    var campaignReport = AdWordsApp.report(
      'SELECT CampaignId '
      + 'FROM   CAMPAIGN_PERFORMANCE_REPORT '
      + whereStatementsArray[i]
      + 'DURING LAST_30_DAYS'
    );

    var rows = campaignReport.rows();
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


function writeOutput(outputArray, formatArray, sheet, AdjectiveName, levelName, filterText, clearSpreadsheet) {
  for (var i = 0; i < 5; i++) {
    try {
      if (clearSpreadsheet) {
        sheet.clear();
      }

      sheet.getRange('R1C1').setValue('Analysis of ' + AdjectiveName + ' in Search Query Report, By ' + levelName);

      sheet.getRange('R' + (sheet.getLastRow() + 2) + 'C1').setValue(filterText);

      var lastRow = sheet.getLastRow();

      if (formatArray.length == 0) {
        sheet.getRange('R' + (lastRow + 1) + 'C1').setValue('No ' + AdjectiveName.toLowerCase() + ' found within the thresholds.');
      } else {
        sheet.getRange('R' + (lastRow + 1) + 'C1:R' + (lastRow + outputArray.length) + 'C' + outputArray[0].length).setValues(outputArray);
        sheet.getRange('R' + (lastRow + 2) + 'C1:R' + (lastRow + outputArray.length) + 'C' + formatArray[0].length).setNumberFormats(formatArray);

        var sortByColumns = [];
        if (outputArray[0][0] == 'Campaign' || outputArray[0][0] == 'Word count') {
          sortByColumns.push({
            column: 1,
            ascending: true
          });
        }
        if (outputArray[0][1] == 'Ad Group') {
          sortByColumns.push({
            column: 2,
            ascending: true
          });
        }
        sortByColumns.push({
          column: outputArray[0].indexOf('Cost') + 1,
          ascending: false
        });
        sortByColumns.push({
          column: outputArray[0].indexOf('Impressions') + 1,
          ascending: false
        });
        sheet.getRange('R' + (lastRow + 2) + 'C1:R' + (lastRow + outputArray.length) + 'C' + outputArray[0].length).sort(sortByColumns);
      }

      break;
    } catch (e) {
      if (e == 'Exception: This action would increase the number of cells in the worksheet above the limit of 2000000 cells.') {
        Logger.log('Could not output ' + levelName + ' level ' + AdjectiveName.toLowerCase() + ": '" + e + "'");
        try {
          sheet.getRange('R' + (sheet.getLastRow() + 2) + 'C1').setValue('Not enough space to write the data - try again in an empty spreadsheet');
        } catch (e2) {
          Logger.log("Error writing 'not enough space' message: " + e2);
        }
        break;
      }

      if (i == 4) {
        Logger.log('Could not output ' + levelName + ' level ' + AdjectiveName.toLowerCase() + ": '" + e + "'");
      }
    }
  }
}


function createCharts(outputArray, sheet, statColumns) {
  for (var s in statColumns) {
    var titleRangeString = 'R' + (20 * s + 1) + 'C1';
    var tableTitleRange = sheet.getRange(titleRangeString);

    tableTitleRange.setValue('Raw Data For Metric: ' + statColumns[s]);

    var tableRangeString = 'R' + (20 * s + 3) + 'C1:R' + (20 * s + outputArray[s].length + 2) + 'C' + (outputArray[s][0].length);
    var range = sheet.getRange(tableRangeString);
    range.setValues(outputArray[s]);

    var chartBuilder = sheet.newChart();
    chartBuilder.addRange(range)
      .setChartType(Charts.ChartType.COLUMN)
      .setOption('title', 'Monthly Comparison Of Adjective Performance For Metric: ' + statColumns[s])
      .setPosition((20 * s + 1), outputArray[s][0].length + 2, 1, 1);

    sheet.insertChart(chartBuilder.build());
  }
}
