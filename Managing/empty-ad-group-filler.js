// ID: a8c40410f2ed960334815e698864216a
/**
 *
 * Empty Ad Group Filler
 *
 * Checks for ad groups with no approved and active ads (or no approved and active
 * ETAs) and creates a template ad in them.
 *
 * Version: 1.1
 * Updated 2017-01-05: changed 'CreativeApprovalStatus' to 'CombinedApprovalStatus'
 * Google AdWords Script maintained on brainlabsdigital.com
 *
 */


// ////////////////////////////////////////////////////////////////////////////
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

var checkedLabelName = 'Checked for empty ad groups';
// Ad groups and campaigns that have been checked (and had ads added where
// necessary) will be labelled with this.

var newAdLabelName = 'New ad to fill empty ad group';
// The ads this script creates will be labelled with this, so you can find
// them easily.

var onlyLookForETAs = false;
// If this is true, the script will create ads in ad groups with no expanded
// text ads (ignoring any standard text ads or other types of ad).
// If false, ads will be created in ad groups with no ads whatsoever.

var headlinePart1 = 'Headline 1';
var headlinePart2 = 'Headline 2';
var description = 'Description';
var finalUrl = 'www.example.com/Your-Landing-Page';
var urlPath1 = 'Path Text 1';
var urlPath2 = 'Path Text 2';
// The text for your template ad


// ////////////////////////////////////////////////////////////////////////////
function main() {
  // Check the template ad text for any issues
  checkAdText();

  // This is used to filter out campaigns and ad groups that have been checked in
  // previous runs. The function will also create the label if it doesn't already
  // exist, so we can apply it to entities we've checked or added ads to.
  var checkedLabelId = getOrCreateLabelId(checkedLabelName);

  // We don't need the ID, but this function will make sure the label exists
  // so we can apply it later
  var newAdLabelId = getOrCreateLabelId(newAdLabelName);

  // Get the campaigns that have yet to be labelled with checkedLabelName
  var campaignIds = getCampaignIdsWithoutLabel(checkedLabelId);

  // Check batches of 100 campaigns at a time
  for (var i = 0; i < campaignIds.length; i += 100) {
    var campaignBatch = campaignIds.slice(i, i + 100);
    var failedCampaignsInBatch = [];

    var adGroupIds = getAdGroupIdsWithoutLabel(campaignBatch, checkedLabelId);

    // Check batches of 1000 ad groups at a time
    for (var j = 0; j < adGroupIds.length; j += 1000) {
      var adGroupBatch = adGroupIds.slice(j, j + 1000);

      var adGroupsWithAds = getAdGroupsWithAds(adGroupBatch);

      if (adGroupBatch.length - adGroupsWithAds.length != 0) {
        var failedIds = createTemplateAds(adGroupBatch, adGroupsWithAds, newAdLabelName);
      } else {
        var failedIds = { failedGroups: [], failedCampaigns: [] };
      }

      // Label the ad groups, except those where ads couldn't be created
      applyLabel(checkedLabelName, 'adGroups', adGroupBatch, failedIds.failedGroups);

      Logger.log(adGroupsWithAds.length + ' groups already had ads; '
                 + (adGroupBatch.length - adGroupsWithAds.length - failedIds.failedGroups.length) + ' ads created');
      if (failedIds.failedGroups.length > 0) {
        Logger.log(failedIds.failedGroups.length + ' ads could not be created.');
      }

      // Record the campaign IDs of any ad groups where ad creation failed
      for (var c in failedIds.failedCampaigns) {
        if (failedCampaignsInBatch.indexOf(failedIds.failedCampaigns[c]) < 0) {
          failedCampaignsInBatch.push(failedIds.failedCampaigns[c]);
        }
      }
    }

    // Label the campaigns where all ad groups were processed successfully
    applyLabel(checkedLabelName, 'campaigns', campaignBatch, failedCampaignsInBatch);
    Logger.log((campaignBatch.length - failedCampaignsInBatch.length) + ' campaigns checked successfully.');
  }

  Logger.log('Account finished.');
}


// Checks the ad text to make sure no required fields are blank,
// no maximum lengths are exceeded
// and there are not too many exclamation marks.
// Also adds 'http://' to the start of the finalUrl if http or https is missing
function checkAdText() {
  var components = {};
  components.headlinePart1 = headlinePart1.trim();
  components.headlinePart2 = headlinePart2.trim();
  components.description = description.trim();
  components.finalUrl = finalUrl.trim();

  for (var name in components) {
    if (components[name].length == 0) {
      throw (name + ' is blank.');
    }
  }

  components.urlPath1 = urlPath1.trim();
  components.urlPath2 = urlPath2.trim();

  var maxLengths = {};
  maxLengths.headlinePart1 = 30;
  maxLengths.headlinePart2 = 30;
  maxLengths.description = 60;
  maxLengths.urlPath1 = 15;
  maxLengths.urlPath2 = 15;

  for (var name in maxLengths) {
    if (components[name].length > maxLengths[name]) {
      throw (name + ' is ' + components[name].length + ' characters long - the maximum length is ' + maxLengths[name]);
    }
  }

  var exclamationMarkCount = {};
  for (var name in components) {
    exclamationMarkCount[name] = components[name].split('!').length - 1;
  }

  if (exclamationMarkCount.headlinePart1 > 0 || exclamationMarkCount.headlinePart2 > 0) {
    throw ('No exclamation marks are allowed in either headline part.');
  }

  if (exclamationMarkCount.description > 1) {
    throw ('description has ' + exclamationMarkCount.description + ' exclamation marks. Only 1 is allowed.');
  }

  if (exclamationMarkCount.urlPath1 + exclamationMarkCount.urlPath2 > 1) {
    throw ('The URL paths have ' + exclamationMarkCount.description + ' exclamation marks. Only 1 is allowed.');
  }

  if (finalUrl.substr(0, 7) != 'http://' && finalUrl.substr(0, 8) != 'https://') {
    Logger.log('finalUrl does not start with http:// or https:// - adding http:// to the start');
    finalUrl = 'http://' + finalUrl;
  }
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


// Get the IDs of campaigns which match the given options and do not contain the given label
function getCampaignIdsWithoutLabel(labelId) {
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
      + 'AND Labels CONTAINS_NONE [' + labelId + '] '
      + 'DURING LAST_30_DAYS'
    );

    var rows = campaignReport.rows();
    while (rows.hasNext()) {
      var row = rows.next();
      campaignIds.push(row.CampaignId);
    }
  }

  if (campaignIds.length == 0) {
    throw ('No campaigns found with the given settings. Either the settings are too restrictive or the script has already checked and labelled all campaigns.');
  }

  Logger.log(campaignIds.length + ' campaigns found');
  return campaignIds;
}


// Get the IDs of ad groups in the given campaigns which do not use the given label
function getAdGroupIdsWithoutLabel(campaignIds, labelId) {
  if (ignorePausedAdGroups) {
    var whereStatement = 'AdGroupStatus = ENABLED ';
  } else {
    var whereStatement = "AdGroupStatus IN ['ENABLED','PAUSED'] ";
  }

  var adGroupIds = [];

  var report = AdWordsApp.report(
    'SELECT AdGroupId '
    + 'FROM   ADGROUP_PERFORMANCE_REPORT '
    + 'WHERE CampaignId IN [' + campaignIds.join(',') + '] AND '
    + whereStatement
      + 'AND Labels CONTAINS_NONE [' + labelId + '] '
        + 'DURING LAST_30_DAYS'
  );

  var rows = report.rows();
  while (rows.hasNext()) {
    var row = rows.next();
    adGroupIds.push(row.AdGroupId);
  }

  Logger.log(adGroupIds.length + ' ad groups found in ' + campaignIds.length + ' campaigns');
  return adGroupIds;
}


// Finds the ad groups (in adGroupIds) that already have active, approved ads
function getAdGroupsWithAds(adGroupIds) {
  var adGroupsWithAds = {};

  if (onlyLookForETAs) {
    var typeStatement = 'AND AdType = EXPANDED_TEXT_AD ';
  } else {
    var typeStatement = '';
  }

  var adReport = AdWordsApp.report(
    'SELECT AdGroupId '
    + 'FROM AD_PERFORMANCE_REPORT '
    + 'WHERE Status = ENABLED AND CombinedApprovalStatus != DISAPPROVED '
    + 'AND AdGroupId IN [' + adGroupIds.join(',') + '] '
    + typeStatement
    + 'DURING LAST_7_DAYS'
  );

  var rows = adReport.rows();
  while (rows.hasNext()) {
    var row = rows.next();
    adGroupsWithAds[row.AdGroupId] = true;
  }

  return Object.keys(adGroupsWithAds);
}


// Create the template ad in the ad groups that are listed in adGroupIds
// but not in adGroupsWithAds, then label with newAdLabelName
// Returns arrays of ad group IDs and campaign IDs where ads could not be
// made.
function createTemplateAds(adGroupIds, adGroupsWithAds, newAdLabelName) {
  var selector = AdWordsApp.adGroups()
    .withIds(adGroupIds);

  if (adGroupsWithAds.length > 0) {
    selector = selector.withCondition('AdGroupId NOT_IN [' + adGroupsWithAds.join(',') + ']');
  }

  var adGroupIterator = selector.get();

  var count = 0;
  var failedGroups = [];
  var failedCampaigns = [];

  while (adGroupIterator.hasNext()) {
    var adGroup = adGroupIterator.next();

    var adBuilder = adGroup.newAd().expandedTextAdBuilder()
      .withHeadlinePart1(headlinePart1)
      .withHeadlinePart2(headlinePart2)
      .withDescription(description)
      .withFinalUrl(finalUrl);

    if (urlPath1 != '') {
      adBuilder = adBuilder.withPath1(urlPath1);
    }

    if (urlPath2 != '') {
      adBuilder = adBuilder.withPath2(urlPath2);
    }

    var adOperation = adBuilder.build();
    if (adOperation.isSuccessful()) {
      adOperation.getResult().applyLabel(newAdLabelName);
      count++;
    } else {
      Logger.log('Error creating ad in ad group ' + adGroup.getName() + ', in campaign ' + adGroup.getCampaign().getName() + ' : ' + adOperation.getErrors());
      failedGroups.push(adGroup.getId());
      failedCampaigns.push(adGroup.getCampaign().getId());
    }
  }

  return { failedGroups: failedGroups, failedCampaigns: failedCampaigns };
}


// Applies a label to entities of the given type
function applyLabel(labelName, entityType, entityIdsToInclude, entityIdsToAvoid) {
  var selector = AdWordsApp[entityType]()
    .withIds(entityIdsToInclude);

  if (entityIdsToAvoid.length > 0) {
    selector = selector.withCondition(entityType.substr(0, 1).toUpperCase() + entityType.substr(1, entityType.length - 2) + 'Id NOT_IN [' + entityIdsToAvoid.join(',') + ']');
  }

  var iterator = selector.get();
  while (iterator.hasNext()) {
    var entity = iterator.next();
    entity.applyLabel(labelName);
  }
}
