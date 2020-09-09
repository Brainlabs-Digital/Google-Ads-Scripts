// ID: bb10c6c459a844665bcd5b170ed9fea8
/**
 *
 * Copying Labels Between Levels
 *
 * This script applies labels from campaigns or ad groups to entities contained
 * within them, or takes labels applied to keywords, ads or ad groups and applies
 * them to the campaigns or ad groups that contain them.
 *
 * Version: 1.0
 * Google AdWords Script maintained on brainlabsdigital.com
 *
 */

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Options

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

var ignorePausedAdsAndKeywords = true;
// Set this to true to only look at currently active keywords and ads.
// Set to false to also include keywords and ads that are currently paused.

var labelNames = ['Label 1', 'Label 2'];
// This is a list of the labels to copy between levels.
// This is case sensitive!

var copyLabelsFrom = 'Campaign';
// Labels from this sort of entity will be used
// This can be one of "Campaign" "AdGroup", "Keyword" or "Ad"

var copyLabelsTo = 'Keyword';
// This sort of entity will be given new labels
// This can be one of "Campaign" "AdGroup", "Keyword" or "Ad"

// Note: You cannot have both copyLabelsFrom and copyLabelsTo be the same,
// and they cannot both be 'Keyword' or 'Ad'

var threshold = 0;
// The proportion of lower level entities that must be labelled for the upper
// level entity to be labelled.
// eg if copyLabelsTo is 'Campaign' and copyLabelsFrom is 'Keyword', then 1 means
// the campaign is only labelled if all keywords are labelled.
// 0.9 means the campaign is labelled if at least 90% of keywords are labelled.
// 0 means the campaign is labelled if at least one keyword is labelled.
// If you are copying a label from a higher level entity (eg from campaign to
// keyword), then this is ignored.


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

function main() {
  var campaignIds = getCampaignIds();
  var labelIds = getLabelIds(labelNames);

  if (labelIds.length == 0) {
    throw ('No labels found.');
  }

  copyLabelsFrom = capitaliseLevelName(copyLabelsFrom);
  copyLabelsTo = capitaliseLevelName(copyLabelsTo);

  if (copyLabelsFrom == copyLabelsTo) {
    throw ('copyLabelsFrom and copyLabelsTo cannot be the same.');
  }

  var hierarchyOrder = {
    Campaign: 3,
    AdGroup: 2,
    Keyword: 1,
    Ad: 1
  };

  if (hierarchyOrder[copyLabelsFrom] == hierarchyOrder[copyLabelsTo]) {
    throw ('Cannot copy labels from ' + copyLabelsFrom + 's to ' + copyLabelsTo + 's');
  }

  if (hierarchyOrder[copyLabelsFrom] > hierarchyOrder[copyLabelsTo]) {
    trickleDown(campaignIds, copyLabelsTo, copyLabelsFrom, labelIds, labelNames);
  } else {
    checkNumber('threshold', threshold, 0, 1);
    trickleUp(campaignIds, copyLabelsFrom, copyLabelsTo, labelIds, labelNames);
  }
}


// Label lower level entities according to labels on the upper level entities
// that contain them
function trickleDown(campaignIds, lowerLevel, upperLevel, labelIds, labelNames) {
  // Record the labels and IDs of the labelled upper level entities
  var report = AdWordsApp.report(
    'SELECT Labels, ' + upperLevel + 'Id '
    + 'FROM ' + getReportType(upperLevel) + ' '
    + 'WHERE CampaignId IN [' + campaignIds.join(',') + '] '
    + 'AND Labels CONTAINS_ANY [' + labelIds.join(',') + '] '
    + getStatusPredicates(upperLevel)
    + 'DURING LAST_30_DAYS'
  );

  var labelledUpperLevel = {};
  for (var i = 0; i < labelNames.length; i++) {
    labelledUpperLevel[labelNames[i]] = [];
  }

  var rows = report.rows();
  while (rows.hasNext()) {
    var row = rows.next();
    var labels = JSON.parse(row.Labels);
    for (var i = 0; i < labels.length; i++) {
      var label = labels[i];
      if (labelledUpperLevel[label] != undefined) {
        labelledUpperLevel[label].push(row[upperLevel + 'Id']);
      }
    }
  }

  for (var label in labelledUpperLevel) {
    if (labelledUpperLevel[label].length == 0) {
      Logger.log('No ' + upperLevel + "s with '" + label + "' found");
      continue;
    }

    Logger.log('Labelling ' + lowerLevel + 's in ' + labelledUpperLevel[label].length + ' ' + upperLevel + "s with '" + label + "'");
    for (var i = 0; i < labelledUpperLevel[label].length; i += 10000) {
      var upperLevelIdsBatch = labelledUpperLevel[label].slice(i, i + 10000);
      labelEntities(label, lowerLevel, upperLevel, upperLevelIdsBatch);
    }
  }
}


// Label upper level entities (ie campaigns or ad groups) according to the
// labels on lower level entities they contain
function trickleUp(campaignIds, lowerLevel, upperLevel, labelIds, labelNames) {
  // First go through the lower level entities to record the IDs of their
  // upper level entities, and the number of lower level entities
  var report = AdWordsApp.report(
    'SELECT Labels, ' + upperLevel + 'Id '
    + 'FROM ' + getReportType(lowerLevel) + ' '
    + 'WHERE CampaignId IN [' + campaignIds.join(',') + '] '
    + 'AND Labels CONTAINS_ANY [' + labelIds.join(',') + '] '
    + getStatusPredicates(lowerLevel)
    + 'DURING LAST_30_DAYS'
  );

  var upperLevelIdTotals = {}; // Total numbers of lower level entities
  var upperLevelIdLabels = {}; // Numbers of lower level entities with labels

  var rows = report.rows();
  while (rows.hasNext()) {
    var row = rows.next();
    var upperLevelId = row[upperLevel + 'Id'];

    if (upperLevelIdLabels[upperLevelId] == undefined) {
      upperLevelIdLabels[upperLevelId] = {};
      for (var i = 0; i < labelNames.length; i++) {
        upperLevelIdLabels[upperLevelId][labelNames[i]] = 0;
      }
      upperLevelIdTotals[upperLevelId] = 1;
    } else {
      upperLevelIdTotals[upperLevelId]++;
    }

    var labels = JSON.parse(row.Labels);

    for (var i = 0; i < labels.length; i++) {
      var label = labels[i];

      if (upperLevelIdLabels[upperLevelId][label] != undefined) {
        upperLevelIdLabels[upperLevelId][label]++;
      }
    }
  }

  Logger.log(Object.keys(upperLevelIdTotals).length + ' ' + upperLevel + 's contain at least one labelled ' + lowerLevel);

  // This object holds the labels and a list of upper level entities
  // to apply those labels to
  var labelToUpperLevel = {};
  for (var i = 0; i < labelNames.length; i++) {
    labelToUpperLevel[labelNames[i]] = [];
  }

  if (threshold == 0) {
    // Upper level entities will be labelled if they have any
    // labelled lower level entities
    for (var upperLevelId in upperLevelIdLabels) {
      for (var label in upperLevelIdLabels[upperLevelId]) {
        if (upperLevelIdLabels[upperLevelId][label] > 0) {
          labelToUpperLevel[label].push(upperLevelId);
        }
      }
    }
  } else {
    // Only upper level entities above the threshold will be labelled
    // so we find how many unlabelled lower level entities there are

    var upperLevelIds = Object.keys(upperLevelIdTotals);

    for (var i = 0; i < upperLevelIds.length; i += 10000) {
      var idBatch = upperLevelIds.slice(i, i + 10000);
      var report = AdWordsApp.report(
        'SELECT Labels, ' + upperLevel + 'Id '
        + 'FROM ' + getReportType(lowerLevel) + ' '
        + 'WHERE ' + upperLevel + 'Id IN [' + idBatch.join(',') + '] '
        + 'AND Labels CONTAINS_NONE [' + labelIds.join(',') + '] '
        + getStatusPredicates(lowerLevel)
        + 'DURING LAST_30_DAYS'
      );

      var rows = report.rows();
      while (rows.hasNext()) {
        var row = rows.next();
        var upperLevelId = row[upperLevel + 'Id'];
        upperLevelIdTotals[upperLevelId]++;
      }
    }

    // Upper level entities are only recorded in the labelToUpperLevel
    // object if they pass the threshold
    for (var upperLevelId in upperLevelIdLabels) {
      for (var label in upperLevelIdLabels[upperLevelId]) {
        var entitiesLabelled = upperLevelIdLabels[upperLevelId][label];
        var totalEntities = upperLevelIdTotals[upperLevelId];
        if (entitiesLabelled / totalEntities >= threshold) {
          labelToUpperLevel[label].push(upperLevelId);
        }
      }
    }
  }

  for (var label in labelToUpperLevel) {
    Logger.log(labelToUpperLevel[label].length + ' ' + upperLevel + "s to label '" + label + "'");

    if (labelToUpperLevel[label].length == 0) {
      continue;
    }

    for (var i = 0; i < labelToUpperLevel[label].length; i += 10000) {
      var upperLevelIdsBatch = labelToUpperLevel[label].slice(i, i + 10000);
      labelEntities(label, upperLevel, upperLevel, upperLevelIdsBatch);
    }
  }
}


// Get the name of the report for an entity
function getReportType(levelName) {
  switch (levelName) {
    case 'Campaign':
      return 'CAMPAIGN_PERFORMANCE_REPORT';

    case 'AdGroup':
      return 'ADGROUP_PERFORMANCE_REPORT';

    case 'Keyword':
      return 'KEYWORDS_PERFORMANCE_REPORT';

    case 'Ad':
      return 'AD_PERFORMANCE_REPORT';

    default:
      throw ('Type ' + levelName + ' not recognised');
  }
}


// Get the predicates for the correct ad group and keyword/ad statuses
// for use in AWQL reports
function getStatusPredicates(levelName) {
  if (levelName == 'Campaign') {
    // Campaign status was already used to get the list of campaign IDs
    // so we don't need to filter with it any more
    return '';
  }

  if (ignorePausedAdGroups) {
    var predicates = 'AND AdGroupStatus = ENABLED ';
  } else {
    var predicates = 'AND AdGroupStatus IN [ENABLED,PAUSED] ';
  }

  if (levelName != 'AdGroup') {
    if (ignorePausedAdsAndKeywords) {
      predicates += 'AND Status = ENABLED ';
    } else {
      predicates += 'AND Status IN [ENABLED,PAUSED] ';
    }
  }

  return predicates;
}


// Label all of the labelLevel entities, filtered by the filterLevelIds.
// labelLevel and filterLevel can be the same (eg to filter campaigns
// by campaign ID)
function labelEntities(label, labelLevel, filterLevel, filterLevelIds) {
  switch (labelLevel) {
    case 'Campaign':
      var iterator = AdWordsApp.campaigns();
      break;

    case 'AdGroup':
      var iterator = AdWordsApp.adGroups();
      break;

    case 'Keyword':
      var iterator = AdWordsApp.keywords();
      break;

    case 'Ad':
      var iterator = AdWordsApp.ads();
      break;

    default:
      throw ('Type ' + labelLevel + ' not recognised');
  }

  var iterator = iterator
    .withCondition(filterLevel + 'Id IN [' + filterLevelIds.join(',') + ']')
    .withCondition("LabelNames CONTAINS_NONE ['" + label + "']");

  if (labelLevel != 'Campaign') {
    if (ignorePausedAdGroups) {
      iterator.withCondition('AdGroupStatus = ENABLED');
    } else {
      iterator.withCondition('AdGroupStatus IN [ENABLED,PAUSED]');
    }
  }

  if (labelLevel != 'Campaign' && labelLevel != 'AdGroup') {
    if (ignorePausedAdsAndKeywords) {
      iterator.withCondition('Status = ENABLED');
    } else {
      iterator.withCondition('Status IN [ENABLED,PAUSED]');
    }
  }

  iterator = iterator.get();

  while (iterator.hasNext()) {
    var entity = iterator.next();
    entity.applyLabel(label);
  }
}


// Make entity level names the right capitalisation
function capitaliseLevelName(levelName) {
  var lowerCaseName = levelName.toLowerCase().replace(/ /g, '');
  if (lowerCaseName.substr(-1) == 's') {
    lowerCaseName = lowerCaseName.slice(0, -1);
  }

  var correctCapitalisation = {};
  correctCapitalisation.campaign = 'Campaign';
  correctCapitalisation.adgroup = 'AdGroup';
  correctCapitalisation.keyword = 'Keyword';
  correctCapitalisation.ad = 'Ad';

  if (correctCapitalisation[lowerCaseName] == undefined) {
    throw ("Level name '" + levelName + "' not recognised.");
  }

  return correctCapitalisation[lowerCaseName];
}


// Check that a number is valid
function checkNumber(name, number, lowerBound, upperBound) {
  if (isNaN(number)) {
    throw (name + " must be a number, '" + number + "' is not.");
  }
  if (number < lowerBound) {
    throw (name + ' must be ' + lowerBound + " or greater, '" + number + "' is not.");
  }
  if (number > upperBound) {
    throw (name + ' must be ' + upperBound + " or lower, '" + number + "' is not.");
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

  if (campaignNameDoesNotContain != '' && typeof campaignNameDoesNotContain === 'string') {
    campaignNameDoesNotContain = [campaignNameDoesNotContain];
  }
  for (var i = 0; i < campaignNameDoesNotContain.length; i++) {
    whereStatement += "AND CampaignName DOES_NOT_CONTAIN_IGNORE_CASE '" + campaignNameDoesNotContain[i].replace(/"/g, '\\\"') + "' ";
  }

  if (campaignNameContains != '' && typeof campaignNameContains === 'string') {
    campaignNameContains = [campaignNameContains];
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


// Get the IDs of labels, based on a list of names
function getLabelIds(labelNames) {
  if (labelNames == '' || labelNames.length == 0) {
    throw ('No labels given in labelNames');
  }
  if (typeof labelNames === 'string') {
    labelNames = [labelNames];
  }

  var iterator = AdWordsApp.labels()
    .withCondition("Name IN ['" + labelNames.join("','") + "']")
    .get();

  var existingLabelNames = {};
  var labelIds = [];

  while (iterator.hasNext()) {
    var label = iterator.next();
    existingLabelNames[label.getName()] = true;
    labelIds.push(label.getId());
  }

  for (var i = 0; i < labelNames.length; i++) {
    if (existingLabelNames[labelNames[i]] == undefined) {
      Logger.log("Warning: could not find the label '" + labelNames[i] + "'. Please check it is spelt and capitalised correctly.");
      labelNames.splice(i, 1);
      i--;
    }
  }

  return labelIds;
}
