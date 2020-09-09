// ID: 4944d00fb3f7d1f03fb7d33e77e85e44
/**
 *
 * Associated Search Analysis
 *
 * This script takes in a list of pieces of text, and finds the words and
 * phrases that appear in the same search queries as that text. The found
 * phrases and the performance of the queries they appear in are then reported
 * in a Google Doc spreadsheet.
 *
 * Version: 1.0
 * Google AdWords Script maintained on brainlabsdigital.com
 *
 */

// ////////////////////////////////////////////////////////////////////////////
// Options

var startDate = '2017-08-01';
var endDate = '2017-08-31';
// The start and end date of the date range for your search query data
// Format is yyyy-mm-dd

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

var reportAdGroupLevel = true;
// Set this to true to report on phrases used in individual ad groups.
// Data is always shown at campaign and account level.

var spreadsheetUrl = 'https://docs.google.com/YOUR-SPREADSHEET-URL-HERE';
// The URL of the Google Doc the results will be put into.

var textOfInterest = ['example one', 'example two'];
// This is the text you are interested in
// The report will show what phrases appear in searches containing this text.
// Text should be in double quotes and comma separated, eg ["yes", "no"]

var minNGramLength = 1;
var maxNGramLength = 2;
// The word length of the phrases that appear alongside the text of interest.
// For example if minNGramLength is 1 and maxNGramLength is 3,
// phrases made of 1, 2 and 3 words will be checked.
// Change both min and max to 1 to just look at single words.

var clearSpreadsheet = true;
// Set this to true to clear any data already in the spreadsheet when the
// script is run.
// If this is set to false, then the script will instead append information to
// the bottom of the sheets. Use this if you are running the script multiple
// times on different parts of the account or looking for different text


// ////////////////////////////////////////////////////////////////////////////
// Thresholds

var queryCountThreshold = 0;
var impressionThreshold = 100;
var clickThreshold = 0;
var costThreshold = 0;
var conversionThreshold = 0;
// Words will be ignored if their statistics are lower than any of these thresholds


// ////////////////////////////////////////////////////////////////////////////
function main() {
  // Check the spreadsheet has been entered, and that it works
  var spreadsheet = checkSpreadsheet(spreadsheetUrl, 'the spreadsheet');

  // Get the IDs of the campaigns to look at
  var activeCampaignIds = getCampaignIds();

  var textOfInterestTreated = [];
  for (var i = 0; i < textOfInterest.length; i++) {
    textOfInterestTreated[i] = ' ' + textOfInterest[i].trim().toLowerCase() + ' ';
  }

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
  // Initialise objects to hold the data
  var campaignNGrams = {};
  var adGroupNGrams = {};
  var totalNGrams = [];
  initialiseContainer(totalNGrams, minNGramLength, maxNGramLength, textOfInterest);

  // ////////////////////////////////////////////////////////////////////////////
  // Go through the search query report, remove searches already excluded by negatives
  // record the performance of each word in each remaining query

  var whereAdGroupStatus = '';
  if (ignorePausedAdGroups) {
    var whereAdGroupStatus = 'AND AdGroupStatus = ENABLED ';
  } else {
    whereAdGroupStatus += "AND AdGroupStatus IN ['ENABLED','PAUSED'] ";
  }
  var dateRange = startDate.replace(/-/g, '') + ',' + endDate.replace(/-/g, '');

  var queryReport = AdWordsApp.report(
    'SELECT CampaignName, CampaignId, AdGroupId, AdGroupName, Query, ' + statColumns.join(', ') + ' '
    + 'FROM SEARCH_QUERY_PERFORMANCE_REPORT '
    + 'WHERE CampaignId IN [' + activeCampaignIds.join(',') + '] ' + whereAdGroupStatus
    + 'DURING ' + dateRange
  );

  var queryRows = queryReport.rows();
  while (queryRows.hasNext()) {
    var queryRow = queryRows.next();

    var query = ' ' + queryRow.Query + ' ';
    var includedWords = [];
    var includedWordsSpaced = [];
    for (var i = 0; i < textOfInterest.length; i++) {
      if (query.indexOf(textOfInterestTreated[i]) > -1) {
        includedWords.push(textOfInterest[i]);
        includedWordsSpaced.push(textOfInterestTreated[i]);
      }
    }

    if (includedWords.length == 0) {
      continue;
    }

    var currentWords = queryRow.Query.split(' ');

    if (campaignNGrams[queryRow.CampaignName] == undefined) {
      campaignNGrams[queryRow.CampaignName] = [];
      initialiseContainer(campaignNGrams[queryRow.CampaignName], minNGramLength, maxNGramLength, textOfInterest);
      adGroupNGrams[queryRow.CampaignName] = {};
    }

    if (reportAdGroupLevel && adGroupNGrams[queryRow.CampaignName][queryRow.AdGroupName] == undefined) {
      adGroupNGrams[queryRow.CampaignName][queryRow.AdGroupName] = [];
      initialiseContainer(adGroupNGrams[queryRow.CampaignName][queryRow.AdGroupName], minNGramLength, maxNGramLength, textOfInterest);
    }

    var stats = [];
    for (var i = 0; i < statColumns.length; i++) {
      stats[i] = parseFloat(queryRow[statColumns[i]].replace(/,/g, ''));
    }

    // Splits the query into n-grams and records the stats for each
    for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
      if (n > currentWords.length) {
        break;
      }

      var doneNGrams = [];

      for (var w = 0; w < currentWords.length - n + 1; w++) {
        var currentNGramRaw = currentWords.slice(w, w + n).join(' ');
        var currentNGramSpaced = ' ' + currentNGramRaw + ' ';
        var currentNGram = '="' + currentNGramRaw + '"';
        if (doneNGrams.indexOf(currentNGram) > -1) {
          continue;
        }
        doneNGrams.push(currentNGram);

        for (var q = 0; q < includedWords.length; q++) {
          if (currentNGramSpaced == includedWordsSpaced[q] || includedWordsSpaced[q].indexOf(currentNGramSpaced) > -1) {
            continue;
          }

          if (campaignNGrams[queryRow.CampaignName][n][includedWords[q]][currentNGram] == undefined) {
            campaignNGrams[queryRow.CampaignName][n][includedWords[q]][currentNGram] = {};
            initialiseDataObject(campaignNGrams[queryRow.CampaignName][n][includedWords[q]][currentNGram], statColumns);
          }

          if (totalNGrams[n][includedWords[q]][currentNGram] == undefined) {
            totalNGrams[n][includedWords[q]][currentNGram] = {};
            initialiseDataObject(totalNGrams[n][includedWords[q]][currentNGram], statColumns);
          }

          campaignNGrams[queryRow.CampaignName][n][includedWords[q]][currentNGram]['Query Count']++;
          totalNGrams[n][includedWords[q]][currentNGram]['Query Count']++;

          for (var i = 0; i < statColumns.length; i++) {
            campaignNGrams[queryRow.CampaignName][n][includedWords[q]][currentNGram][statColumns[i]] += stats[i];
            totalNGrams[n][includedWords[q]][currentNGram][statColumns[i]] += stats[i];
          }

          if (reportAdGroupLevel) {
            if (adGroupNGrams[queryRow.CampaignName][queryRow.AdGroupName][n][includedWords[q]][currentNGram] == undefined) {
              adGroupNGrams[queryRow.CampaignName][queryRow.AdGroupName][n][includedWords[q]][currentNGram] = {};
              initialiseDataObject(adGroupNGrams[queryRow.CampaignName][queryRow.AdGroupName][n][includedWords[q]][currentNGram], statColumns);
            }
            adGroupNGrams[queryRow.CampaignName][queryRow.AdGroupName][n][includedWords[q]][currentNGram]['Query Count']++;
            for (var i = 0; i < statColumns.length; i++) {
              adGroupNGrams[queryRow.CampaignName][queryRow.AdGroupName][n][includedWords[q]][currentNGram][statColumns[i]] += stats[i];
            }
          }
        }
      }
    }
  }

  Logger.log('Finished analysing queries.');


  // ////////////////////////////////////////////////////////////////////////////
  // Output the data into the spreadsheet

  var outputs = [];
  var formats = [];

  for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
    outputs[n] = {};
    outputs[n].campaign = [];
    outputs[n].adgroup = [];
    outputs[n].total = [];
    formats[n] = {};
    formats[n].campaign = [];
    formats[n].adgroup = [];
    formats[n].total = [];
  }

  // Create headers
  var calcStatNames = [];
  for (var s = 0; s < calculatedStats.length; s++) {
    calcStatNames.push(calculatedStats[s][0]);
  }
  var statNames = statColumns.concat(calcStatNames);
  for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
    outputs[n].campaign.push(['Word of Interest', 'Campaign', 'Phrase', 'Query Count'].concat(statNames));
    outputs[n].total.push(['Word of Interest', 'Phrase', 'Query Count'].concat(statNames));
  }

  // Organise the ad group level stats into an array for output
  if (reportAdGroupLevel) {
    var adGroupLineFormatting = [0, 0, 0, 0].concat(formatting);
    for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
      outputs[n].adgroup.push(['Word of Interest', 'Campaign', 'Ad Group', 'Phrase', 'Query Count'].concat(statNames));
      for (var campaign in adGroupNGrams) {
        for (var adGroup in adGroupNGrams[campaign]) {
          for (var wordOfInterest in adGroupNGrams[campaign][adGroup][n]) {
            for (var nGram in adGroupNGrams[campaign][adGroup][n][wordOfInterest]) {
              var dataObject = adGroupNGrams[campaign][adGroup][n][wordOfInterest][nGram];
              var printlineStart = [wordOfInterest, campaign, adGroup, nGram];
              addToOutput(dataObject, printlineStart, outputs[n].adgroup, formats[n].adgroup, adGroupLineFormatting, statColumns, calculatedStats);
            }
          }
        }
      }
    }
  }

  // Organise the campaign level stats into an array for output
  var campaignLineFormatting = [0, 0, 0].concat(formatting);
  for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
    for (var campaign in campaignNGrams) {
      for (var wordOfInterest in campaignNGrams[campaign][n]) {
        for (var nGram in campaignNGrams[campaign][n][wordOfInterest]) {
          var dataObject = campaignNGrams[campaign][n][wordOfInterest][nGram];
          var printlineStart = [wordOfInterest, campaign, nGram];
          addToOutput(dataObject, printlineStart, outputs[n].campaign, formats[n].campaign, campaignLineFormatting, statColumns, calculatedStats);
        }
      }
    }
  }

  // Organise the account level stats into an array for output
  var totalLineFormatting = [0, 0].concat(formatting);
  for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
    for (var wordOfInterest in totalNGrams[n]) {
      for (var nGram in totalNGrams[n][wordOfInterest]) {
        var dataObject = totalNGrams[n][wordOfInterest][nGram];
        var printlineStart = [wordOfInterest, nGram];
        addToOutput(dataObject, printlineStart, outputs[n].total, formats[n].total, totalLineFormatting, statColumns, calculatedStats);
      }
    }
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
  var campaignNGramName = [];
  var adGroupNGramName = [];
  var totalNGramName = [];
  var campaignNGramSheet = [];
  var adGroupNGramSheet = [];
  var totalNGramSheet = [];

  for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
    if (n == 1) {
      campaignNGramName[n] = 'Campaign Word Analysis';
      adGroupNGramName[n] = 'Ad Group Word Analysis';
      totalNGramName[n] = 'Account Word Analysis';
    } else {
      campaignNGramName[n] = 'Campaign ' + n + '-Gram Analysis';
      adGroupNGramName[n] = 'Ad Group ' + n + '-Gram Analysis';
      totalNGramName[n] = 'Account ' + n + '-Gram Analysis';
    }

    campaignNGramSheet[n] = spreadsheet.getSheetByName(campaignNGramName[n]);
    if (campaignNGramSheet[n] == null) {
      campaignNGramSheet[n] = spreadsheet.insertSheet(campaignNGramName[n]);
    }

    if (reportAdGroupLevel) {
      adGroupNGramSheet[n] = spreadsheet.getSheetByName(adGroupNGramName[n]);
      if (adGroupNGramSheet[n] == null) {
        adGroupNGramSheet[n] = spreadsheet.insertSheet(adGroupNGramName[n]);
      }
    }

    totalNGramSheet[n] = spreadsheet.getSheetByName(totalNGramName[n]);
    if (totalNGramSheet[n] == null) {
      totalNGramSheet[n] = spreadsheet.insertSheet(totalNGramName[n]);
    }
  }

  // Write the output arrays to the spreadsheet
  for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
    var nGramName = n + '-Grams';
    if (n == 1) {
      nGramName = 'Words';
    }

    writeOutput(outputs[n].campaign, formats[n].campaign, campaignNGramSheet[n], nGramName, 'Campaign', filterText, clearSpreadsheet);
    writeOutput(outputs[n].total, formats[n].total, totalNGramSheet[n], nGramName, 'Account', filterText, clearSpreadsheet);

    if (reportAdGroupLevel) {
      writeOutput(outputs[n].adgroup, formats[n].adgroup, adGroupNGramSheet[n], nGramName, 'Ad Group', filterText, clearSpreadsheet);
    }
  }

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


function initialiseContainer(containerObject, minNGramLength, maxNGramLength, textOfInterest) {
  for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
    containerObject[n] = {};
    for (var i = 0; i < textOfInterest.length; i++) {
      containerObject[n][textOfInterest[i]] = {};
    }
  }
}

function initialiseDataObject(dataObject, statColumns) {
  dataObject['Query Count'] = 0;
  for (var i = 0; i < statColumns.length; i++) {
    dataObject[statColumns[i]] = 0;
  }
}

function addToOutput(dataObject, printlineStart, output, format, formatting, statColumns, calculatedStats) {
  // skips nGrams under the thresholds
  if (dataObject['Query Count'] < queryCountThreshold) {
    return;
  }
  if (dataObject.Impressions < impressionThreshold) {
    return;
  }
  if (dataObject.Clicks < clickThreshold) {
    return;
  }
  if (dataObject.Cost < costThreshold) {
    return;
  }
  if (dataObject.Conversions < conversionThreshold) {
    return;
  }

  var printline = printlineStart.slice();
  printline.push(dataObject['Query Count']);

  for (var s = 0; s < statColumns.length; s++) {
    printline.push(dataObject[statColumns[s]]);
  }

  for (var s = 0; s < calculatedStats.length; s++) {
    var multiplier = calculatedStats[s][1];
    var divisor = calculatedStats[s][2];
    if (dataObject[divisor] > 0) {
      printline.push(dataObject[multiplier] / dataObject[divisor]);
    } else {
      printline.push('-');
    }
  }
  output.push(printline);
  format.push(formatting);
}

function writeOutput(outputArray, formatArray, sheet, nGramName, levelName, filterText, clearSpreadsheet) {
  for (var i = 0; i < 5; i++) {
    try {
      if (clearSpreadsheet) {
        sheet.clear();
      }

      sheet.getRange('R1C1').setValue('Analysis of ' + nGramName + ' in Search Query Report, By ' + levelName);
      sheet.getRange('R' + (sheet.getLastRow() + 2) + 'C1').setValue(filterText);

      var lastRow = sheet.getLastRow();

      if (formatArray.length == 0) {
        sheet.getRange('R' + (lastRow + 1) + 'C1').setValue('No ' + nGramName.toLowerCase() + ' found within the thresholds.');
      } else {
        sheet.getRange('R' + (lastRow + 1) + 'C1:R' + (lastRow + outputArray.length) + 'C' + outputArray[0].length).setValues(outputArray);
        sheet.getRange('R' + (lastRow + 2) + 'C1:R' + (lastRow + outputArray.length) + 'C' + formatArray[0].length).setNumberFormats(formatArray);

        var sortByColumns = [];
        if (outputArray[0][1] == 'Campaign') {
          sortByColumns.push({
            column: 2,
            ascending: true
          });
        }
        if (outputArray[0][2] == 'Ad Group') {
          sortByColumns.push({
            column: 3,
            ascending: true
          });
        }
        sortByColumns.push({
          column: 1,
          ascending: true
        });
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
        Logger.log('Could not output ' + levelName + ' level ' + nGramName.toLowerCase() + ": '" + e + "'");
        try {
          sheet.getRange('R' + (sheet.getLastRow() + 2) + 'C1').setValue('Not enough space to write the data - try again in an empty spreadsheet');
        } catch (e2) {
          Logger.log("Error writing 'not enough space' message: " + e2);
        }
        break;
      }

      if (i == 4) {
        Logger.log('Could not output ' + levelName + ' level ' + nGramName.toLowerCase() + ": '" + e + "'");
      }
    }
  }
}
