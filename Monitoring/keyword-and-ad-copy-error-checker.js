// ID: b56487c96aacf454b27b15e1fb427abe
/**
 *
 * AdWords Script for keyword and ad checking.
 * Checks keyword text for punctuation suggesting the wrong match type, checks
 * broad match keywords for missing BMM. Checks ad, sitelink and callout text
 * for text that suggests ads are out-of-date (like previous years and seasonal
 * events) and for common English spelling mistakes.
 *
 * Version: 2.1
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
// while ["Brand","Generic"] would only look at campaigns with 'Brand' or 'Generic'
// in the name.
// Leave as [] to include all campaigns.

var ignorePausedCampaigns = true;
// Set this to true to only look at currently active campaigns.
// Set to false to include campaigns that had impressions but are currently paused.

var checkKeywords = true;
// Set this to true to look at keyword text for errors like missing BMM.

var checkAdText = true;
// Set this to true to look at ad text for errors like previous years.

var checkSpelling = true;
// Set this to true to check ad text for some common spelling errors.

var checkExtensions = true;
// Set this to true to check the text of sitelinks and callouts for text and
// spelling errors (if those are enabled above).

var checkAllExtensions = false;
// Set this to true to check the text of all of your sitelinks and callouts.
// If this is false, only extensions that have had impressions with the filtered
// campaigns will be checked.

var checkAdsFor = ['2014', '2015', '2016', 'Easter', 'Christmas', 'New Year'];
// This is the text that the script will look for in ad copy.
// Feel free to add more!


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Advanced Options
var misspellingsSheetUrl = 'https://docs.google.com/spreadsheets/d/1Z2Fg_F8WhmY8Ey5Bv4Zuk8vcTW7A2EoVwMbGVz7TNms/edit#gid=0';
// This spreadsheet has the list of English spelling errors, used if checkSpelling
// is true.

var misspellingsSheetName = 'Main';
// This is the name of the sheet in the above spreadsheet


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Functions

function main() {
  var spreadsheet = checkSpreadsheet(spreadsheetUrl, 'the spreadsheet');
  var sheet = spreadsheet.getSheets()[0];
  var campaignIds = getCampaignIds();

  if (checkKeywords) {
    keywordChecking(campaignIds, sheet);
    Logger.log('Finished keyword checks.');
  }

  if (checkAdText) {
    adTextChecking(campaignIds, sheet);
    Logger.log('Finished ad text checks.');
  }

  if (checkSpelling) {
    adSpellingChecking(campaignIds, sheet);
    Logger.log('Finished common misspelling checks.');
  }
}

// Check the spreadsheet URL has been entered, and that it works
function checkSpreadsheet(spreadsheetUrl, spreadsheetName) {
  if (spreadsheetUrl.replace(/[AEIOU]/g, 'X') == 'https://docs.google.com/YXXR-SPRXXDSHXXT-XRL-HXRX') {
    throw ('Problem with ' + spreadsheetName + " URL: make sure you've replaced the default with a valid spreadsheet URL.");
  }
  try {
    var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);

    // Checks if you can edit the spreadsheet
    if (spreadsheetName == 'the spreadsheet') {
      var sheet = spreadsheet.getSheets()[0];
      var sheetName = sheet.getName();
      sheet.setName(sheetName);
    }

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
    var printArray = [];

    sheet.getRange('R' + (sheet.getLastRow() + 2) + 'C1').setValue(title);
    if (rows.length == 0) {
      sheet.appendRow(['No issues found']);
      Logger.log("Nothing to output for '" + title + "'");
      return;
    }

    sheet.appendRow(headers);

    for (var i = 0; i < rows.length; i++) {
      printArray.push(rows[i]);
    }

    var lastRow = sheet.getLastRow();
    sheet.getRange('R' + (lastRow + 1) + 'C1:R' + (lastRow + printArray.length)
      + 'C' + (printArray[0].length)).setValues(printArray);

    Logger.log('Printed ' + rows.length + " rows for '" + title + "'");
  } catch (e) {
    Logger.log("Printing rows '" + title + "' failed: " + e);
  }
}

function keywordChecking(campaignIds, sheet) {
  try {
    var broadMissingPlusses = [];
    var nonBroadWithPlusses = [];
    var nonExactWithBrackets = [];
    var nonPhraseWithQuotes = [];

    var keywordMatchReport = AdWordsApp.report(
      'SELECT CampaignName, AdGroupName, Criteria, KeywordMatchType '
      + 'FROM   KEYWORDS_PERFORMANCE_REPORT '
      + 'WHERE AdGroupStatus = ENABLED AND Status = ENABLED AND IsNegative = FALSE '
      + 'AND CampaignId IN [' + campaignIds.join(',') + '] '
      + 'DURING LAST_30_DAYS'
    );

    var keywordMatchRows = keywordMatchReport.rows();

    while (keywordMatchRows.hasNext()) {
      var keywordMatchRow = keywordMatchRows.next();

      if (keywordMatchRow.KeywordMatchType.toLowerCase() === 'broad') {
        if (keywordMatchRow.Criteria.indexOf('+') < 0) {
          // if the broad KW is entirely missing +s
          broadMissingPlusses.push([keywordMatchRow.CampaignName, keywordMatchRow.AdGroupName, "'" + keywordMatchRow.Criteria, keywordMatchRow.KeywordMatchType]);
        } else {
          var words = keywordMatchRow.Criteria.split(' ');
          var missingPlus = false;
          for (var j = 0; j < words.length; j++) {
            if (words[j].substr(0, 1) != '+') {
              missingPlus = true;
              break;
            }
          }
          if (missingPlus) {
            broadMissingPlusses.push([keywordMatchRow.CampaignName, keywordMatchRow.AdGroupName, "'" + keywordMatchRow.Criteria, keywordMatchRow.KeywordMatchType]);
          }
        }
      } else {
        // If the keyword is not broad
        if (keywordMatchRow.Criteria.indexOf('+') > -1) {
          nonBroadWithPlusses.push([keywordMatchRow.CampaignName, keywordMatchRow.AdGroupName, "'" + keywordMatchRow.Criteria, keywordMatchRow.KeywordMatchType]);
        }
      }

      if (keywordMatchRow.KeywordMatchType.toLowerCase() != 'exact') {
        if (keywordMatchRow.Criteria.indexOf('[') > -1 || keywordMatchRow.Criteria.indexOf(']') > -1) {
          nonExactWithBrackets.push([keywordMatchRow.CampaignName, keywordMatchRow.AdGroupName, "'" + keywordMatchRow.Criteria, keywordMatchRow.KeywordMatchType]);
        }
      }

      if (keywordMatchRow.KeywordMatchType.toLowerCase() != 'phrase') {
        if (keywordMatchRow.Criteria.indexOf('"') > -1) {
          nonPhraseWithQuotes.push([keywordMatchRow.CampaignName, keywordMatchRow.AdGroupName, "'" + keywordMatchRow.Criteria, keywordMatchRow.KeywordMatchType]);
        }
      }
    } // end while

    var headers = ['Campaign', 'Ad Group', 'Keyword', 'Match'];

    printRows(sheet, 'Broad Match Keywords Missing +s', headers, broadMissingPlusses);
    printRows(sheet, 'Non-Broad Match Keywords With +s', headers, nonBroadWithPlusses);
    printRows(sheet, 'Non-Exact Match Keywords With [ or ]', headers, nonExactWithBrackets);
    printRows(sheet, 'Non-Phrase Match Keywords With "s', headers, nonPhraseWithQuotes);
  } catch (e) {
    Logger.log('Keyword checking failed: ' + e);
  }
} // end function keywordChecking


function adTextChecking(campaignIds, sheet) {
  try {
    //
    var adLines = ['Headline', 'Description1', 'Description2', 'DisplayUrl'];
    var adsWithBadText = [];
    var etaLines = ['HeadlinePart1', 'HeadlinePart2', 'Description', 'Path1', 'Path2'];
    var etasWithBadText = [];
    var patterns = [];
    var charactersToEscape = ['\\', '/', '.', '?', '+', '*', '^', '$', '[', ']', '(', ')', '{', '}'];
    for (var k = 0; k < checkAdsFor.length; k++) {
      var cleanedText = checkAdsFor[k].toLowerCase();
      for (var i = 0; i < charactersToEscape.length; i++) {
        cleanedText = cleanedText.replace(charactersToEscape[i], '\\' + charactersToEscape[i]);
      }
      patterns.push(RegExp('(^|\\W)' + cleanedText + '($|\\W)'));
    }

    var adTextReport = AdWordsApp.report(
      'SELECT CampaignName, AdGroupName, Headline, HeadlinePart1, HeadlinePart2, Description, Description1, Description2, DisplayUrl, Path1, Path2, AdType '
      + 'FROM   AD_PERFORMANCE_REPORT '
      + 'WHERE AdGroupStatus = ENABLED AND Status = ENABLED '
      + 'AND AdType IN [TEXT_AD, EXPANDED_TEXT_AD] AND CombinedApprovalStatus != DISAPPROVED '
      + 'AND CampaignId IN [' + campaignIds.join(',') + '] '
      + 'DURING LAST_30_DAYS'
    );

    var rows = adTextReport.rows();

    while (rows.hasNext()) {
      var row = rows.next();

      if (row.AdType == 'Text ad') {
        var textFound = checkAd(row, adLines, patterns);

        if (textFound.length > 0) {
          adsWithBadText.push([row.CampaignName, row.AdGroupName, row.Headline,
          row.Description1, row.Description2, row.DisplayUrl,
          textFound.join(', ')
          ]);
        }
      } else {
        var textFound = checkAd(row, etaLines, patterns);

        if (textFound.length > 0) {
          etasWithBadText.push([row.CampaignName, row.AdGroupName, row.HeadlinePart1,
          row.HeadlinePart2, row.Description, row.Path1, row.Path2,
          textFound.join(', ')
          ]);
        }
      }
    } // end while

    var headers = ['Campaign', 'Ad Group', 'Headline', 'Description 1', 'Description 2',
      'Display Url', 'Problematic Text'
    ];
    var etaHeaders = ['Campaign', 'Ad Group', 'Headline 1', 'Headline 2', 'Description',
      'Path 1', 'Path 2', 'Problematic Text'
    ];
    printRows(sheet, 'Ad Copy With Problematic Text', headers, adsWithBadText);
    printRows(sheet, 'ETA Ad Copy With Problematic Text', etaHeaders, etasWithBadText);

    if (checkExtensions) {
      var calloutLines = ['1'];
      var sitelinkLines = ['1', '3', '4', '5'];
      var calloutsWithBadText = [];
      var sitelinksWithBadText = [];

      var extReport = AdWordsApp.report(
        'SELECT AttributeValues, PlaceholderType '
        + 'FROM PLACEHOLDER_FEED_ITEM_REPORT '
        + 'WHERE PlaceholderType IN [1, 17] '
        + 'AND Status = ENABLED '
        + (checkAllExtensions ? '' : 'AND CampaignId IN [' + campaignIds.join(',') + '] ')
        + 'DURING LAST_30_DAYS'
      );

      var rows = extReport.rows();
      while (rows.hasNext()) {
        var row = rows.next();
        var values = JSON.parse(row.AttributeValues);

        if (row.PlaceholderType == 17) {
          var textFound = checkAd(values, calloutLines, patterns);

          if (textFound.length > 0) {
            calloutsWithBadText.push([values['1'], textFound.join(', ')]);
          }
        } else {
          var textFound = checkAd(values, sitelinkLines, patterns);

          if (textFound.length > 0) {
            sitelinksWithBadText.push([values['1'], removeUndefined(values['3']), removeUndefined(values['4']),
            values['5'], textFound.join(', ')
            ]);
          }
        }
      } // end while

      var sitelinkHeaders = ['Sitelink', 'Description 1', 'Description 2', 'Sitelink URL', 'Problematic Text'];
      var calloutHeaders = ['Callout', 'Problematic Text'];
      printRows(sheet, 'Sitelinks With Problematic Text', sitelinkHeaders, sitelinksWithBadText);
      printRows(sheet, 'Callouts With Problematic Text', calloutHeaders, calloutsWithBadText);
    }
  } catch (e) {
    Logger.log('Ad text checking failed: ' + e);
  }
} // function adTextChecking


function checkAd(ad, adLines, patterns) {
  var adCopy = '';

  for (var j = 0; j < adLines.length; j++) {
    adCopy += ' ' + ad[adLines[j]];
  }
  adCopy = adCopy.toLowerCase();
  var textFound = [];

  for (var k = 0; k < checkAdsFor.length; k++) {
    if (adCopy.match(patterns[k])) {
      textFound.push(checkAdsFor[k]);
    }
  }

  return textFound;
}


function removeUndefined(str) {
  return (str == undefined ? 'None' : str);
}


function adSpellingChecking(campaignIds, sheet) {
  try {
    var misspellingsSpreadsheet = checkSpreadsheet(misspellingsSheetUrl, 'the misspelling spreadsheet');
    var misspellingsSheet = misspellingsSpreadsheet.getSheetByName(misspellingsSheetName);
    var misspellings = misspellingsSheet.getRange(2, 1, misspellingsSheet.getLastRow() - 1, 2).getValues();

    for (var k = 0; k < misspellings.length; k++) {
      misspellings[k][0] = ' ' + misspellings[k][0] + ' ';
    }

    var adLines = ['Headline', 'Description1', 'Description2', 'DisplayUrl'];
    var etaLines = ['HeadlinePart1', 'HeadlinePart2', 'Description', 'Path1', 'Path2'];
    var adsWithBadText = [];
    var etasWithBadText = [];

    var adTextReport = AdWordsApp.report(
      'SELECT CampaignName, AdGroupName, Headline, HeadlinePart1, HeadlinePart2, Description, Description1, Description2, DisplayUrl, Path1, Path2, AdType '
      + 'FROM   AD_PERFORMANCE_REPORT '
      + 'WHERE AdGroupStatus = ENABLED AND Status = ENABLED '
      + 'AND AdType IN [TEXT_AD, EXPANDED_TEXT_AD] AND CombinedApprovalStatus != DISAPPROVED '
      + 'AND CampaignId IN [' + campaignIds.join(',') + '] '
      + 'DURING LAST_30_DAYS'
    );

    var rows = adTextReport.rows();
    while (rows.hasNext()) {
      var row = rows.next();

      if (row.AdType == 'TEXT_AD') {
        var [textFound, didYouMean] = spellCheck(row, adLines, misspellings);

        if (textFound.length > 0) {
          adsWithBadText.push([row.CampaignName, row.AdGroupName, row.Headline,
          row.Description1, row.Description2, row.DisplayUrl,
          textFound.join(', '), didYouMean.join(', ')
          ]);
        }
      } else {
        var [textFound, didYouMean] = spellCheck(row, etaLines, misspellings);

        if (textFound.length > 0) {
          etasWithBadText.push([row.CampaignName, row.AdGroupName, row.HeadlinePart1,
          row.HeadlinePart2, row.Description, row.Path1, row.Path2,
          textFound.join(', '), didYouMean.join(', ')
          ]);
        }
      }
    } // end while

    if (checkExtensions) {
      var calloutLines = ['1'];
      var sitelinkLines = ['1', '3', '4', '5'];
      var calloutsWithBadText = [];
      var sitelinksWithBadText = [];

      var extReport = AdWordsApp.report(
        'SELECT AttributeValues, PlaceholderType '
        + 'FROM PLACEHOLDER_FEED_ITEM_REPORT '
        + 'WHERE PlaceholderType IN [1, 17] '
        + 'AND Status = ENABLED '
        + (checkAllExtensions ? '' : 'AND CampaignId IN [' + campaignIds.join(',') + '] ')
        + 'DURING LAST_30_DAYS'
      );

      var rows = extReport.rows();

      while (rows.hasNext()) {
        var row = rows.next();
        var values = JSON.parse(row.AttributeValues);

        if (row.PlaceholderType == 17) {
          var [textFound, didYouMean] = spellCheck(values, calloutLines, misspellings);

          if (textFound.length > 0) {
            calloutsWithBadText.push([values['1'], textFound.join(', '), didYouMean.join(', ')]);
          }
        } else {
          var [textFound, didYouMean] = spellCheck(values, sitelinkLines, misspellings);

          if (textFound.length > 0) {
            sitelinksWithBadText.push([values['1'], removeUndefined(values['3']), removeUndefined(values['4']),
            values['5'], textFound.join(', '), didYouMean.join(', ')
            ]);
          }
        }
      } // end while
    }

    var headers = ['Campaign', 'Ad Group', 'Headline', 'Description 1', 'Description 2',
      'Display Url', 'Possible Misspelling', 'Possible Corrections'
    ];
    var etaHeaders = ['Campaign', 'Ad Group', 'Headline 1', 'Headline 2', 'Description',
      'Path 1', 'Path 2', 'Possible Misspelling', 'Possible Corrections'
    ];
    var sitelinkHeaders = ['Sitelink', 'Description 1', 'Description 2', 'Possible Misspelling', 'Possible Corrections'];
    var calloutHeaders = ['Callout', 'Possible Misspelling', 'Possible Corrections'];
    printRows(sheet, 'Ad Copy With Possible Misspellings', headers, adsWithBadText);
    printRows(sheet, 'ETA Ad Copy With Possible Misspellings', etaHeaders, etasWithBadText);
    if (checkExtensions) {
      printRows(sheet, 'Sitelinks With Possible Misspellings', sitelinkHeaders, sitelinksWithBadText);
      printRows(sheet, 'Callouts With Possible Misspellings', calloutHeaders, calloutsWithBadText);
    }
  } catch (e) {
    Logger.log('Ad spell checking failed: ' + e);
  }
} // function adSpellingChecking


function spellCheck(row, adLines, misspellings) {
  var adCopy = ' ';
  for (var j = 0; j < adLines.length; j++) {
    adCopy += ' ' + row[adLines[j]];
  }
  adCopy += ' ';
  adCopy = adCopy.toLowerCase();
  adCopy = adCopy.replace(/(_|[^\w\-'0-9])/g, ' ');
  var textFound = [];
  var didYouMean = [];

  for (var k = 0; k < misspellings.length; k++) {
    if (adCopy.indexOf(misspellings[k][0]) > -1) {
      textFound.push(misspellings[k][0].trim());
      didYouMean.push(misspellings[k][1]);
    }
  }

  return [textFound, didYouMean];
}
