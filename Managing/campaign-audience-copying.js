// ID: 25135ea471216048059e288397471be2
/**
 *
 * Campaign Audience Copying
 *
 * This script takes the audiences (and audience bid adjustments) applied to one
 * template campaign and applies them to all other campaigns that match the
 * filters. Campaigns are then labelled.
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
// while ["Display","Competitors"] would ignore any campaigns with 'display' or
// 'competitors' in the name. Case insensitive.
// Leave as [] to not exclude any campaigns.

var campaignNameContains = [];
// Use this if you only want to look at some campaigns.
// For example ["Brand"] would only look at campaigns with 'Brand' in the name,
// while ["Brand","Generic"] would only look at campaigns with 'brand' or 'generic'
// in the name. Case insensitive.
// Leave as [] to include all campaigns.

var ignorePausedCampaigns = true;
// Set this to true to only look at currently active campaigns.
// Set to false to also include campaigns that are currently paused.

var includeShoppingCampaigns = true;
// True if you want to copy audiences in Shopping campaigns.
// False if you're looking only at Search and Display campaigns.
// The template campaign can only be a shopping campaign if this is true.

var campaignToCopy = 'TEMPLATE CAMPAIGN NAME HERE';
// This is the name of the template campaign which has the desired audiences
// already applied.
// Audiences shared with this campaign will be shared with the other campaigns.
// Case sensitive!

var labelName = 'Campaign audience applied';
// Once a campaign has had all the audiences added, it will be labelled with this.


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
function main() {
  // Find or create the campaign label
  var labels = AdWordsApp.labels().withCondition("Name = '" + labelName + "'").get();
  if (!labels.hasNext()) {
    // If the label does not exist, we create it
    AdWordsApp.createLabel(labelName);
    labels = AdWordsApp.labels().withCondition("Name = '" + labelName + "'").get();
  }
  if (AdWordsApp.getExecutionInfo().isPreview() && !labels.hasNext()) {
    // We can't create labels when previewing scripts, so if this is a preview run
    // and the label still doesn't exist we use a dummy value for the ID
    // (as we know nothing can be labelled with the non-existent label anyway)
    var labelId = 0;
  } else {
    var labelId = labels.next().getId();
  }

  // Get the template campaign

  var templateCampaigns = AdWordsApp.campaigns()
    .withCondition('CampaignName = "' + campaignToCopy.replace(/"/g, '\\\"') + '"')
    .withCondition('CampaignStatus IN [ENABLED, PAUSED]')
    .get();

  if (includeShoppingCampaigns && !templateCampaigns.hasNext()) {
    var templateCampaigns = AdWordsApp.shoppingCampaigns()
      .withCondition('CampaignName = "' + campaignToCopy.replace(/"/g, '\\\"') + '"')
      .withCondition('CampaignStatus IN [ENABLED, PAUSED]')
      .get();
  }

  if (!templateCampaigns.hasNext()) {
    throw ("No template campaign called '" + campaignToCopy + "' found.");
  }

  // There should be precisely one campaign in the iterator, because there should be
  // precisely one template campaign to look at. So we don't use a while loop, we just
  // look at the first campaign in the iterator.
  var templateCampaign = templateCampaigns.next();

  // Label the template campaign so it's ignored later on
  if (!templateCampaign.labels().get().hasNext() || !templateCampaign.labels().withIds([labelId]).get().hasNext()) {
    templateCampaign.applyLabel(labelName);
  }

  var targetingSetting = templateCampaign.targeting().getTargetingSetting('USER_INTEREST_AND_LIST');
  var audiences = templateCampaign.targeting().audiences().get();
  var audiencesToCopy = {};

  while (audiences.hasNext()) {
    var audience = audiences.next();
    audiencesToCopy[audience.getAudienceId()] = audience.bidding().getBidModifier();
  }

  var countAudiences = Object.keys(audiencesToCopy).length;

  Logger.log(countAudiences + ' audience(s) found.');

  var negativeAudiences = templateCampaign.targeting().excludedAudiences().get();
  var negativeAudiencesToCopy = {};

  while (negativeAudiences.hasNext()) {
    var audience = negativeAudiences.next();
    negativeAudiencesToCopy[audience.getAudienceId()] = '-';
  }

  var countNegativeAudiences = Object.keys(negativeAudiencesToCopy).length;

  Logger.log(countNegativeAudiences + ' negative audience(s) found.');

  if (countAudiences + countNegativeAudiences == 0) {
    throw ("No audiences found to copy. Please check they are applied to template campaign '" + campaignToCopy + "'.");
  }

  // Get all the campaign IDs (based on campaignNameDoesNotContain, campaignNameContains
  // and ignorePausedCampaigns options).
  // This ignores labelling - if there are no campaigns it must be because the options
  // are set incorrectly, so it throws an error.
  var campaignIds = getCampaignIds();
  var campaignCount = 0;

  // Make an iterator of the campaigns that match the settings and are not labelled
  var campaignSelectors = [AdWordsApp.campaigns()];
  if (includeShoppingCampaigns) {
    campaignSelectors.push(AdWordsApp.shoppingCampaigns());
  }

  for (var i = 0; i < campaignSelectors.length; i++) {
    var campaigns = campaignSelectors[i]
      .withCondition('CampaignId IN [' + campaignIds.join(',') + ']')
      .withCondition('Labels CONTAINS_NONE [' + labelId + ']')
      .get();

    // Go through each campaign and apply the audiences
    while (campaigns.hasNext()) {
      var campaign = campaigns.next();
      var success = true;

      campaign.targeting().setTargetingSetting('USER_INTEREST_AND_LIST', targetingSetting);

      for (var audienceID in audiencesToCopy) {
        var audienceBuilder = campaign.targeting().newUserListBuilder().withAudienceId(audienceID).withBidModifier(audiencesToCopy[audienceID])
          .build();
        if (!audienceBuilder.isSuccessful()) {
          success = false;
        }
      }
      for (var audienceID in negativeAudiencesToCopy) {
        var audienceBuilder = campaign.targeting().newUserListBuilder().withAudienceId(audienceID).exclude();
        if (!audienceBuilder.isSuccessful()) {
          success = false;
        }
      }

      if (success) {
        campaign.applyLabel(labelName); // Label the campaign if the audiences have been applied
      }

      campaignCount++;
      if (campaignCount % 100 == 0) {
        Logger.log('Applied lists to ' + campaignCount + ' campaigns so far');
      }
    }
  }

  if (campaignCount == 0) {
    Logger.log(campaignIds.length + " campaigns match the settings, but all were labelled with '" + labelName + "'. This suggests the Audiences have been applied to everything.");
  } else {
    Logger.log('Finished. Audiences applied to ' + campaignCount + ' campaigns.');
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

  return campaignIds;
}
