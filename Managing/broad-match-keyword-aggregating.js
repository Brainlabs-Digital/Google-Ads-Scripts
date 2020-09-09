// ID: 87ea3268e7e6db5e86bc4671c61e65be
/**
*
* Broad-match keyword aggregator script
* This script will group equivalent broad match keywords and label based on performence
*
* Version: 1.1
* Updated 2016-10-11: replaced 'ConvertedClicks' with 'Conversions'
* Google AdWords Script maintained by brainlabsdigital.com
*
*/

function main() {
  var ACCOUNT_WIDE = false;
  // Defines whether the script looks at campaign-level or account-level broad match duplicate keywords

  var METRIC = 'AverageCpc';
  // Select the metric which will determine which duplicate keyword will be kept, choose from "Ctr", "QualityScore", "Impressions", "Conversions", "AverageCpc"

  var CAMPAIGN_INCLUDE_FILTER = []; // e.g var CAMPAIGN_INCLUDE_FILTER = ["hey", "jude"];
  // Campaign filter which will include any campaign with any of the included strings in the campaign name. Case insensitive matching

  var CAMPAIGN_EXCLUDE_FILTER = []; // e.g var CAMPAIGN_EXCLUDE_FILTER = ["hey", "jude"];
  // Campaign filter which will exclude any campaign with any of the included strings in the campaign name. Case insensitive matching

  var DATE_RANGE = 'LAST_30_DAYS';
  // Choose one from TODAY, YESTERDAY, LAST_7_DAYS, THIS_WEEK_SUN_TODAY, THIS_WEEK_MON_TODAY, LAST_WEEK, LAST_14_DAYS, LAST_30_DAYS, LAST_BUSINESS_WEEK, LAST_WEEK_SUN_SAT, THIS_MONTH

  var KEEP_LABEL = 'DuplicateBroadKeyword_Enable';
  // Label one keyword from each duplicate group

  var PAUSE_LABEL = 'DuplicateBroadKeyword_Pause';
  // Label all keywords which don't have the best statistic from selected


  labelDuplicates(ACCOUNT_WIDE, CAMPAIGN_INCLUDE_FILTER, CAMPAIGN_EXCLUDE_FILTER, DATE_RANGE, METRIC, KEEP_LABEL, PAUSE_LABEL);
}

function labelDuplicates(ACCOUNT_WIDE, CAMPAIGN_INCLUDE_FILTER, CAMPAIGN_EXCLUDE_FILTER, DATE_RANGE, METRIC, KEEP_LABEL, PAUSE_LABEL) {
  // Create labels
  AdWordsApp.createLabel(KEEP_LABEL);
  AdWordsApp.createLabel(PAUSE_LABEL);

  // Metric data-validation
  var allowedMetrics = ['Ctr', 'QualityScore', 'Impressions', 'Conversions', 'AverageCpc'];
  var allowedMetrics_lowerCase = allowedMetrics.map(function (str) { return str.toLowerCase(); });
  var metricIndex = allowedMetrics_lowerCase.indexOf(METRIC.toLowerCase());
  if (metricIndex === -1) {
    var error = "Metric '" + METRIC + "' not recognised, please set to one from '" + allowedMetrics.join("', '") + "'.";
    Logger.log(error);
    throw error;
  }
  var METRIC = allowedMetrics[metricIndex];


  // Generate list of included campaigns
  var includeCampaignIds = [];
  var campaignIncludes = CAMPAIGN_INCLUDE_FILTER.map(function (str) { return str.toLowerCase(); });
  var campaignIterator = AdWordsApp.campaigns()
    .withCondition('CampaignStatus = ENABLED')
    .get();
  while (campaignIterator.hasNext()) {
    var campaign = campaignIterator.next();
    var campaignId = campaign.getId();
    var campaignName = campaign.getName();
    var campaignNameLower = campaignName.toLowerCase();
    var flag = false;
    for (var i = 0; i < campaignIncludes.length; i++) {
      if (campaignNameLower.indexOf(campaignIncludes[i]) !== -1) {
        flag = true;
        break;
      }
    }
    if (flag) {
      includeCampaignIds.push(campaignId);
    }
  }

  // Construct AWQL report query
  var selectQuery = 'SELECT CampaignName, CampaignId, Id, AdGroupId, Criteria, ' + METRIC + ' ';
  var fromQuery = 'FROM KEYWORDS_PERFORMANCE_REPORT ';
  var whereQuery = 'WHERE KeywordMatchType = BROAD AND AdNetworkType1 = SEARCH ';
  if (includeCampaignIds.length > 0) {
    whereQuery += 'AND CampaignId IN [' + includeCampaignIds.join(',') + '] ';
  }
  for (var i = 0; i < CAMPAIGN_EXCLUDE_FILTER.length; i++) {
    whereQuery += "AND CampaignName DOES_NOT_CONTAIN_IGNORE_CASE '" + CAMPAIGN_EXCLUDE_FILTER[i] + "' ";
  }
  var duringQuery = 'DURING ' + DATE_RANGE;
  var query = selectQuery
                + fromQuery
                  + whereQuery
                      + duringQuery;

  // Generate report
  var report = AdWordsApp.report(query);
  // Poll report rows
  var campaignKeywords = {};
  var rows = report.rows();
  while (rows.hasNext()) {
    var row = rows.next();
    var keywordId = row.Id;
    var adGroupId = row.AdGroupId;
    var campaignId = row.CampaignId;
    var keywordText = row.Criteria.toLowerCase();
    var metricStat = parseFloat(row[METRIC].replace(/,/g, ''));

    if (METRIC.toLowerCase() === 'AverageCpc'.toLowerCase()) {
      if (metricStat > 0) {
        metricStat = 1 / metricStat;
      }
    }

    var stats = { metric: metricStat };

    if (ACCOUNT_WIDE) campaignId = 1;

    if (typeof (campaignKeywords[campaignId]) === 'undefined') {
      campaignKeywords[campaignId] = [];
    }

    campaignKeywords[campaignId].push(parseKeyword(keywordId, adGroupId, keywordText, stats));
  }

  // Establish duplicate keyword groups
  if (ACCOUNT_WIDE === true) {
    var keywordGroups = {};
  }
  for (var campaignId in campaignKeywords) {
    if (ACCOUNT_WIDE === false) {
      var keywordGroups = {};
    }
    var campaignKeywordsList = campaignKeywords[campaignId];

    var keywordArray = [];
    for (var keyword in campaignKeywordsList) {
      keywordArray.push(campaignKeywordsList[keyword].Text);
    }
    for (var keyword in campaignKeywordsList) {
      var keywordText = campaignKeywordsList[keyword].Text;
      var firstIndex = keywordArray.indexOf(keywordText);
      var lastIndex = keywordArray.lastIndexOf(keywordText);

      // push the dupes into dupe groups
      if (firstIndex !== lastIndex) {
        if (typeof (keywordGroups[keywordText]) === 'undefined') {
          keywordGroups[keywordText] = [];
        }
        keywordGroups[keywordText].push(campaignKeywordsList[keyword]);
      }
    }
    if (ACCOUNT_WIDE === true) {
      continue;
    }
    labelKeywords(keywordGroups, KEEP_LABEL, PAUSE_LABEL);
  }
  if (ACCOUNT_WIDE === true) {
    labelKeywords(keywordGroups, KEEP_LABEL, PAUSE_LABEL);
  }
}

function parseKeyword(keywordId, adGroupId, keywordText, stats) {
  var keyword = {};
  keyword.KeywordId = keywordId;
  keyword.AdGroupId = adGroupId;
  keyword.Id = [adGroupId, keywordId];
  keyword.Text = orderKeyword(keywordText);
  keyword.Stats = stats;

  return keyword;
}

function orderKeyword(keywordText) {
  // Splitting the words
  var keywordTextArray = keywordText.trim().split(' ');

  // Sort keyword components
  var sortedKeywordComponents = keywordTextArray.sort();

  // Turn sorted strings into one word
  var sortedKeyword = sortedKeywordComponents.join(' ');

  return sortedKeyword;
}

function labelKeywords(keywordGroups, KEEP_LABEL, PAUSE_LABEL) {
  for (var keywordText in keywordGroups) {
    // cycle through each group to pick best of the bunch
    var maxMetric = -1;
    var bestKeyword = [];
    for (var keyword in keywordGroups[keywordText]) {
      if (parseFloat(keywordGroups[keywordText][keyword].Stats.metric) > maxMetric) {
        maxMetric = keywordGroups[keywordText][keyword].Stats.metric;
        bestKeyword[0] = keywordGroups[keywordText][keyword];
      }
    }

    var indexOfBest = keywordGroups[keywordText].indexOf(bestKeyword[0]);
    keywordGroups[keywordText].splice(indexOfBest, 1);

    // label all groups with pause/unpause labels
    var keywordIterator = AdWordsApp.keywords().withIds([bestKeyword[0].Id]).get();
    keywordIterator.next().applyLabel(KEEP_LABEL);

    var keywordIdArray = [];
    for (keyword in keywordGroups[keywordText]) {
      keywordIdArray.push(keywordGroups[keywordText][keyword].Id);
    }
    var keywordIterator = AdWordsApp.keywords().withIds(keywordIdArray).get();
    while (keywordIterator.hasNext()) {
      var keyword = keywordIterator.next();
      keyword.applyLabel(PAUSE_LABEL);
    }
  }
}
