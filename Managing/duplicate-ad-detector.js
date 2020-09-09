// ID: df4b721f0e7a3713d6f9fa5165e9a4ad
/**
 *
 * Duplicate Ad Detector
 * This script will find ads with identical text and URLs, and label
 * one to keep and the rest to pause according to performance.
 *
 * Version: 1.0
 * Google AdWords Script maintained by brainlabsdigital.com
 *
 */

var metric = 'Ctr';
// Select the metric which will determine which duplicate ad will be kept.
// Choose from "Ctr", "Clicks", "Impressions", "Cost", "Conversions", "AverageCpc"

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

var checkUrl = true;
// Set this to true to include the URL as part of the ad text - ads are only
// treated as duplicates if they have the same ad copy and final URL.
// Set this to false to treat ads as duplicates if they have the same copy
// but different landing pages.

var caseSensitive = false;
// If this is set to true, then only ads with the same capitalisation will
// count as duplicates.
// If this is false, ad text comparison will be case insensitive.

var keepLabel = 'Duplicate Ad: Enable';
// Label one ad from each duplicate group

var pauseLabel = 'Duplicate Ad: Pause';
// Label all ads which don't have the best statistic from selected


function main() {
  var campaignIds = getCampaignIds();

  // Create labels
  var keepLabelId = getOrCreateLabelId(keepLabel);
  var pauseLabelId = getOrCreateLabelId(pauseLabel);

  // Metric validation
  var allowedMetrics = ['Ctr', 'Clicks', 'Impressions', 'Cost', 'Conversions', 'AverageCpc'];
  metric = validateMetricName(metric, allowedMetrics);

  // Record the ads
  var adsByAdGroup = getAds(campaignIds, keepLabelId, pauseLabelId, metric);

  // Find and label the duplicates
  findDuplicates(adsByAdGroup, keepLabel, pauseLabel);

  Logger.log('Finished.');
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


// Create the label if it doesn't exist, and return its ID.
// (Returns a dummy ID if the label does not exist and this is a preview run,
// because we can't create or apply the label)
function getOrCreateLabelId(labelName) {
  var labels = AdWordsApp.labels().withCondition("Name = '" + labelName + "'").get();

  if (!labels.hasNext()) {
    AdWordsApp.createLabel(labelName);
    labels = AdWordsApp.labels().withCondition("Name = '" + labelName + "'").get();
  }

  if (AdWordsApp.getExecutionInfo().isPreview() && !labels.hasNext()) {
    var labelId = 0;
  } else {
    var labelId = labels.next().getId();
  }

  return labelId;
}


// Verify that a metric name is valid, and return it with the correct capitalisation.
function validateMetricName(metric, allowedMetrics) {
  var allowedMetrics_lowerCase = allowedMetrics.map(function (str) {
    return str.toLowerCase();
  });
  var metricIndex = allowedMetrics_lowerCase.indexOf(metric.toLowerCase().replace(' ', '').trim());
  if (metricIndex === -1) {
    throw "Metric '" + metric + "' not recognised, please set to one from '" + allowedMetrics.join("', '") + "'.";
  }
  return allowedMetrics[metricIndex];
}


// Get the text and the relevant stat for all text ads and ETAs
// in the given campaigns.
// Returns the ads, grouped by their ad group ID.
function getAds(campaignIds, keepLabelId, pauseLabelId, metric) {
  // Construct AWQL report query and generate report
  var query = 'SELECT Id, AdGroupId, Headline, Description1, Description2, DisplayUrl, CreativeFinalUrls, HeadlinePart1, HeadlinePart2, Description, Path1, Path2, ' + metric + ' '
    + 'FROM AD_PERFORMANCE_REPORT '
    + 'WHERE AdType IN [TEXT_AD, EXPANDED_TEXT_AD] '
    + 'AND Status = ENABLED '
    + 'AND Labels CONTAINS_NONE [' + keepLabelId + ',' + pauseLabelId + '] '
    + 'AND CampaignId IN [' + campaignIds.join(',') + '] '
    + 'DURING LAST_30_DAYS';
  var report = AdWordsApp.report(query);

  // Poll report rows
  var adsByAdGroup = {};
  var rows = report.rows();
  while (rows.hasNext()) {
    var row = rows.next();

    var metricStat = parseFloat(row[metric].replace(/,/g, ''));
    if (metric.toLowerCase() === 'AverageCpc'.toLowerCase()) {
      if (metricStat > 0) {
        metricStat = 1 / metricStat;
      }
    }
    var stats = {
      metric: metricStat
    };

    var groupId = row.AdGroupId;
    if (typeof (adsByAdGroup[groupId]) === 'undefined') {
      adsByAdGroup[groupId] = [];
    }

    var ad = {};

    if (checkUrl) {
      var finalUrl = row.CreativeFinalUrls.toLowerCase();
    } else {
      var finalUrl = '';
    }
    if (row.AdType == 'Text ad') {
      ad.Text = row.Headline + '#' + row.Description1 + '#' + row.Description2 + '#' + row.DisplayUrl + '#' + finalUrl;
    } else {
      ad.Text = row.HeadlinePart1 + '#' + row.HeadlinePart2 + '#' + row.Description + '#' + row.Path1 + '#' + row.Path2 + '#' + finalUrl;
    }
    if (!caseSensitive) {
      ad.Text = ad.Text.toLowerCase();
    }

    ad.AdId = row.Id;
    ad.AdGroupId = row.AdGroupId;
    ad.Id = [row.AdGroupId, row.Id];
    ad.Stats = stats;
    adsByAdGroup[groupId].push(ad);
  }

  return adsByAdGroup;
}


// Finds duplicate ads
function findDuplicates(adsByAdGroup, keepLabel, pauseLabel) {
  var ids = Object.keys(adsByAdGroup);

  Logger.log('Found ads in ' + ids.length + ' ad groups');

  for (var i = 0; i < ids.length; i += 1000) {
    if ((i + 1) % 10000 == 0) {
      Logger.log('Checking ad group ' + (i + 1) + ' of ' + ids.length);
    }

    var duplicateAds = {};

    for (var j = i; j < i + 100 && j < ids.length; j++) {
      var id = ids[j];
      var currentGroupsAds = adsByAdGroup[id];

      var adArray = [];
      for (var ad in currentGroupsAds) {
        adArray.push(currentGroupsAds[ad].Text);
      }

      for (var ad in currentGroupsAds) {
        var adText = currentGroupsAds[ad].Text;
        var firstIndex = adArray.indexOf(adText);
        var lastIndex = adArray.lastIndexOf(adText);

        // push the dupes into dupe groups
        if (firstIndex !== lastIndex) {
          if (typeof (duplicateAds[id]) === 'undefined') {
            duplicateAds[id] = {};
          }
          if (typeof (duplicateAds[id][adText]) === 'undefined') {
            duplicateAds[id][adText] = [];
          }
          duplicateAds[id][adText].push(currentGroupsAds[ad]);
        }
      }
    }

    pickBestAdAndLabel(duplicateAds, keepLabel, pauseLabel);
  }
}


// Finds the best ad, according to the user defined metric
// then labels accordingly
function pickBestAdAndLabel(duplicateAds, keepLabel, pauseLabel) {
  var idsForPauseLabel = [];
  var idsForKeepLabel = [];

  for (var id in duplicateAds) {
    for (var adText in duplicateAds[id]) {
      // cycle through each group to pick best of the bunch
      var maxmetric = -1;
      var bestAd = [];
      for (var ad in duplicateAds[id][adText]) {
        if (parseFloat(duplicateAds[id][adText][ad].Stats.metric) > maxmetric) {
          maxmetric = duplicateAds[id][adText][ad].Stats.metric;
          bestAd[0] = duplicateAds[id][adText][ad];
        }
      }

      var indexOfBest = duplicateAds[id][adText].indexOf(bestAd[0]);
      duplicateAds[id][adText].splice(indexOfBest, 1);
      idsForKeepLabel.push(bestAd[0].Id);

      for (ad in duplicateAds[id][adText]) {
        idsForPauseLabel.push(duplicateAds[id][adText][ad].Id);
      }
    }
  }

  // label all groups with pause/unpause labels
  if (idsForKeepLabel.length + idsForPauseLabel.length > 0) {
    applyLabelsToAds(idsForKeepLabel, keepLabel);
    applyLabelsToAds(idsForPauseLabel, pauseLabel);
  }
}


// Applies a label to all ads with the given ids
function applyLabelsToAds(ids, labelName) {
  for (var i = 0; i < ids.length; i += 5000) {
    var iterator = AdWordsApp.ads()
      .withIds(ids.slice(i, i + 5000))
      .get();
    while (iterator.hasNext()) {
      var ad = iterator.next();
      ad.applyLabel(labelName);
    }
  }
}
