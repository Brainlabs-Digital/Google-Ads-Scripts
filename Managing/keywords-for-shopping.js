// ID: 4136388fb2fa654eca6539d45d76db3e
/**
 *
 * Exact Match For Shopping
 *
 * This script reads a list of exact match keywords for Shopping campaigns from a Google Doc,
 * and then excludes any search queries from those camapigns if they do not match those keywords.
 *
 * Version: 1.0
 * Google AdWords Script maintained by brainlabsdigital.com
 *
 */

function main() {
  // Put your spreadsheet's URL here:
  var spreadsheetUrl = 'https://docs.google.com/YOUR-SPREADSHEET-URL-HERE';
  // Make sure the keywords are in columns A to C in the first sheet.


  // ////////////////////////////////////////////////////////////////////////////
  var dateRange = 'YESTERDAY';
  // By default the script just looks at yesterday's search queries.

  var impressionThreshold = 0;
  // The script only looks at searches with impressions higher than this threshold.
  // Use this if you get a wide range of searches and only want to exclude the highest volume ones.

  // Read the spreadsheet
  try {
    var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
  } catch (e) {
    Logger.log("Problem with the spreadsheet URL: '" + e + "'");
    Logger.log('Make sure you have correctly copied in your own spreadsheet URL.');
    return;
  }
  var sheet = spreadsheet.getSheets()[0];
  var spreadsheetData = sheet.getDataRange().getValues();

  // Record each campaigns' keywords, and the words (of more than 4 characters) that are in the keywords
  var keywords = {};
  var words = {};
  var numberOfKeywords = 0;
  var numberOfadGroups = 0;
  for (var i = 1; i < spreadsheetData.length; i++) {
    var campaignName = spreadsheetData[i][0];
    var adGroupName = spreadsheetData[i][1];
    if (keywords[campaignName] == undefined) {
      keywords[campaignName] = [];
      words[campaignName] = {};
    }
    if (keywords[campaignName][adGroupName] == undefined) {
      keywords[campaignName][adGroupName] = [];
      words[campaignName][adGroupName] = {};
      numberOfadGroups++;
    }
    var keyword = spreadsheetData[i][2];
    keyword = keyword.toLowerCase().replace(/[^\w\s\d&]/g, ' ').replace(/ +/g, ' ').trim();
    keywords[campaignName][adGroupName].push(keyword);
    numberOfKeywords++;
    var keywordWords = keyword.split(' ');
    for (var k = 0; k < keywordWords.length; k++) {
      if (keywordWords[k].length > 4) {
        words[campaignName][adGroupName][keywordWords[k]] = true;
      }
    }
  }
  var campaignNames = Object.keys(keywords);
  Logger.log('Found ' + numberOfKeywords + ' keywords for ' + numberOfadGroups + ' ad groups in ' + campaignNames.length + ' campaign(s).');

  // Get the IDs of the ad groups named in the spreadsheet
  var adGroupIds = [];
  var campaignIds = [];
  var campaignReport = AdWordsApp.report(
    'SELECT CampaignName, AdGroupName, CampaignId, AdGroupId '
    + 'FROM   ADGROUP_PERFORMANCE_REPORT '
    + 'WHERE Impressions > 0 '
    + 'AND CampaignName IN ["' + campaignNames.join('","') + '"] '
    + 'DURING ' + dateRange
  );
  var campaignRows = campaignReport.rows();
  while (campaignRows.hasNext()) {
    var row = campaignRows.next();
    if (campaignIds.indexOf(row.CampaignId) < 0) {
      campaignIds.push(row.CampaignId);
    }
    if (keywords[row.CampaignName][row.AdGroupName] != undefined) {
      adGroupIds.push(row.AdGroupId);
    }
  } // end while

  if (adGroupIds.length == 0) {
    Logger.log('Could not find any ad groups with impressions that matched the given names.');
    return;
  }
  Logger.log('Found ' + adGroupIds.length + ' ad groups in ' + campaignIds.length + ' campaign(s) with impressions that matched the given names.');

  // Initialise the arrays for each campaign, and sorts the keywords from longest to shortest
  var negativeQueries = {}; // Contains the queries
  var exactNegatives = {}; // Contains any negatives to add with exact match
  var phraseNegatives = {}; // Contains any negatives to add with phrase match
  for (var campaignName in keywords) {
    negativeQueries[campaignName] = {};
    exactNegatives[campaignName] = {};
    phraseNegatives[campaignName] = {};
    for (var adGroupName in keywords[campaignName]) {
      negativeQueries[campaignName][adGroupName] = [];
      exactNegatives[campaignName][adGroupName] = [];
      phraseNegatives[campaignName][adGroupName] = [];
      keywords[campaignName][adGroupName].sort(function (a, b) {
        return b.length - a.length;
      });
    }
  }

  // Get the queries that don't exactly match keywords
  var report = AdWordsApp.report(
    'SELECT Query, AdGroupId, CampaignId, CampaignName, AdGroupName, Impressions '
    + 'FROM SEARCH_QUERY_PERFORMANCE_REPORT '
    + 'WHERE AdGroupId IN [' + adGroupIds.join(',') + '] '
    + 'AND Impressions > ' + impressionThreshold + ' '
    + 'DURING ' + dateRange
  );
  var rows = report.rows();
  var numberQueries = 0;
  while (rows.hasNext()) {
    var row = rows.next();
    var query = row.Query.toLowerCase().replace(/[^\w\s\d&]/g, ' ').replace(/ +/g, ' ').trim();
    var campaignName = row.CampaignName;
    var adGroupName = row.AdGroupName;
    if (keywords[campaignName][adGroupName].indexOf(query) < 0) {
      negativeQueries[campaignName][adGroupName].push(query);
      numberQueries++;
    }
  }

  // Process queries
  Logger.log('Processing ' + numberQueries + ' queries that do not match any keywords.');
  var numberExactNegatives = 0;
  var numberPotentialPhraseNegatives = 0;
  for (var campaignName in negativeQueries) {
    for (var adGroupName in negativeQueries[campaignName]) {
      for (var i = 0; i < negativeQueries[campaignName][adGroupName].length; i++) {
        var query = negativeQueries[campaignName][adGroupName][i];
        var queryDone = false;

        // If the query is contained within a keyword, it has to be an exact match negative
        if (isStringInsideKeywords(query, keywords[campaignName][adGroupName])) {
          exactNegatives[campaignName][adGroupName].push(query);
          numberExactNegatives++;
          continue;
        }

        // Check each word (that's over 4 characters) in the query - if it's not in the words array
        // then it isn't in the keywords, so it's fine to use as a phrase negative
        var queryWords = query.split(' ');
        for (var w = 0; w < queryWords.length; w++) {
          if (queryWords[w].length > 4) {
            if (words[campaignName][adGroupName][queryWords[w]] == undefined) {
              phraseNegatives[campaignName][adGroupName].push(queryWords[w]);
              queryDone = true;
              break;
            }
          }
        }

        // Check if there is a keyword inside the query. If there is, see if the part of the query before
        // or after the keyword could be used as a phrase negative.
        for (var k = 0; k < keywords[campaignName][adGroupName].length && !queryDone; k++) {
          var keyword = keywords[campaignName][adGroupName][k];
          if ((' ' + query + ' ').indexOf(' ' + keyword + ' ') > -1) {
            var queryBits = (' ' + query + ' ').split(' ' + keyword + ' ');
            queryBits[0] = queryBits[0].trim();
            queryBits[1] = queryBits[1].trim();
            if (queryBits[0].length > 0 && !isStringInsideKeywords(queryBits[0], keywords[campaignName][adGroupName])) {
              phraseNegatives[campaignName][adGroupName].push(queryBits[0]);
              queryDone = true;
              break;
            }
            if (queryBits[1].length > 0 && !isStringInsideKeywords(queryBits[1], keywords[campaignName][adGroupName])) {
              phraseNegatives[campaignName][adGroupName].push(queryBits[1]);
              queryDone = true;
              break;
            }
          }
        }

        // If nothing smaller than the full query would work, then add the full query as a negative
        if (!queryDone) {
          phraseNegatives[campaignName][adGroupName].push(query);
        }
        numberPotentialPhraseNegatives++;
      }
    }
  }
  Logger.log('Found ' + numberPotentialPhraseNegatives + ' potential phrase match negatives and ' + numberExactNegatives + ' exact match negatives.');

  // Remove any redundant phrase negatives
  Logger.log('Checking for redundant negatives.');
  var numberPhraseNegatives = 0;
  for (var campaignName in negativeQueries) {
    for (var adGroupName in negativeQueries[campaignName]) {
      // Order the phrases from shortest to longest
      phraseNegatives[campaignName][adGroupName].sort(function (a, b) {
        return a.length - b.length;
      });

      for (var i = 0; i < phraseNegatives[campaignName][adGroupName].length; i++) {
        var shorterPhrase = ' ' + phraseNegatives[campaignName][adGroupName][i] + ' ';

        // As the array is now ordered, any phrase negatives with higher indices must be longer than shorterPhrase
        for (var j = i + 1; j < phraseNegatives[campaignName][adGroupName].length; j++) {
          var longerPhrase = ' ' + phraseNegatives[campaignName][adGroupName][j] + ' ';

          // If the shorterPhrase is within the longerPhrase, then the longerPhrase is redundant
          // so it is removed from the array. This also means duplicates are removed.
          if (longerPhrase.indexOf(shorterPhrase) > -1) {
            phraseNegatives[campaignName][adGroupName].splice(j, 1);
            j--;
          }
        }
      }
      numberPhraseNegatives += phraseNegatives[campaignName][adGroupName].length;
    }
  }
  Logger.log('Going to create ' + numberPhraseNegatives + ' phrase match negatives and ' + numberExactNegatives + ' exact match negatives');

  // Iterate through the Shopping ad groups and add the negative keywords
  var groupIterator = AdWordsApp.shoppingAdGroups()
    .withIds(adGroupIds)
    .get();

  while (groupIterator.hasNext()) {
    var adGroup = groupIterator.next();
    var adGroupName = adGroup.getName();
    var campaignName = adGroup.getCampaign().getName();

    for (var i = 0; i < exactNegatives[campaignName][adGroupName].length; i++) {
      adGroup.createNegativeKeyword('[' + exactNegatives[campaignName][adGroupName][i] + ']');
    }

    for (var i = 0; i < phraseNegatives[campaignName][adGroupName].length; i++) {
      adGroup.createNegativeKeyword('"' + phraseNegatives[campaignName][adGroupName][i] + '"');
    }
  }

  Logger.log('Finished.');
} // end main function


// Check if a word is a substring of any strings in the keywords array
function isStringInsideKeywords(word, keywords) {
  for (var k = 0; k < keywords.length; k++) {
    var keyword = ' ' + keywords[k] + ' ';
    if (keyword.indexOf(' ' + word + ' ') > -1) {
      return true;
    }
  }
  return false;
}
