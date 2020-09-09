// ID: d7ef8b89df97b93a98a88822720cb26d
/**
*
* Shared Negative List Copying
*
* This script takes the shared campaign negative lists and excluded placement lists
* applied to one template campaign and applies them to all other campaigns that
* match the filters.
*
* Version: 1.0
* Google AdWords Script maintained on brainlabsdigital.com
*
**/

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
//Options

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

var ignorePausedCampaigns = false;
// Set this to true to only look at currently active campaigns.
// Set to false to also include campaigns that are currently paused.

var campaignToCopy = "YOUR TEMPLATE CAMPAIGN NAME HERE";
// This is the name of the template campaign which has the desired lists already applied.
// All lists shared with this campaign will be shared with the other campaigns.
// Case sensitive!

var copyNegativeKeywordLists = true;
// Set this to true to copy shared campaign negatives.

var copyExcludedPlacementLists = true;
// Set this to true to copy shared excluded placements.

var labelName = "Shared lists done";
// Once a campaign has had all the lists added, it will be labelled with this.


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
function main() {

  if (!copyNegativeKeywordLists && !copyExcludedPlacementLists) {
    throw ("The options say not to copy either type of list. Please set at least one of copyNegativeKeywordLists or copyExcludedPlacementLists to true.");
  }

  // Get the lists shared with the template campaign
  var templateCampaigns = AdWordsApp.campaigns()
    .withCondition('CampaignName = "' + campaignToCopy.replace(/"/g, '\\\"') + '"')
    .withCondition("CampaignStatus IN [ENABLED, PAUSED]")
    .get();

  if (!templateCampaigns.hasNext()) {
    throw ("No template campaign called '" + campaignToCopy + "' found.");
  }

  // There should be precisely one campaign in the iterator, because there should be
  // precisely one template campaign to look at. So we don't use a while loop, we just
  // look at the first campaign in the iterator.
  var templateCampaign = templateCampaigns.next();

  var typesOfList = [];
  var listObjectsToAdd = [];

  if (copyNegativeKeywordLists) {
    typesOfList.push("negativeKeywordLists");
    listObjectsToAdd.push([]);
  }
  if (copyExcludedPlacementLists) {
    typesOfList.push("excludedPlacementLists");
    listObjectsToAdd.push([]);
  }

  for (var i = 0; i < typesOfList.length; i++) {
    var iterator = templateCampaign[typesOfList[i]]().get();
    while (iterator.hasNext()) {
      var listObject = iterator.next()
      listObjectsToAdd[i].push(listObject);
    }
  }

  var totalListsToAdd = 0;
  for (var i = 0; i < typesOfList.length; i++) {
    Logger.log(listObjectsToAdd[i].length + " " + typesOfList[i] + " found");
    totalListsToAdd += listObjectsToAdd[i].length;
  }

  if (totalListsToAdd == 0) {
    throw ("No " + typesOfList.join(" or ") + " found to copy. Please check they are applied to template campaign '" + campaignToCopy + "'.");
  }

  // Get all the campaign IDs (based on campaignNameDoesNotContain, campaignNameContains
  // and ignorePausedCampaigns options).
  // This ignores labelling - if there are no campaigns it must be because the options
  // are set incorrectly, so it throws an error.
  var campaignIds = getCampaignIds();

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

  var listAddMethods = {};
  listAddMethods["negativeKeywordLists"] = "addNegativeKeywordList";
  listAddMethods["excludedPlacementLists"] = "addExcludedPlacementList";

  // Make an iterator of the campaigns that match the settings and are not labelled
  var campaigns = AdWordsApp.campaigns()
    .withCondition("CampaignId IN [" + campaignIds.join(",") + "]")
    .withCondition("Labels CONTAINS_NONE [" + labelId + "]")
    .get();
  var campaignCount = 0;

  // Go through each campaign and apply the lists
  while (campaigns.hasNext()) {
    var campaign = campaigns.next();
    for (var i = 0; i < typesOfList.length; i++) { // Loop over the types of list
      for (var j = 0; j < listObjectsToAdd[i].length; j++) { // Loop over the lists to add
        campaign[listAddMethods[typesOfList[i]]](listObjectsToAdd[i][j]); // Add the list
      }
    }
    campaign.applyLabel(labelName); // Label the campaign now the lists have been applied

    campaignCount++;
    if (campaignCount % 100 == 0) {
      Logger.log("Applied lists to " + campaignCount + " campaigns so far");
    }
  }

  if (campaignCount == 0) {
    Logger.log(campaignIds.length + " campaigns match the settings, but all were labelled with '" + labelName + "'. This suggests the lists have been applied to everything.");
  } else {
    Logger.log("Finished. Lists applied to " + campaignCount + " campaigns.");
  }

}


// Get the IDs of campaigns which match the given options
function getCampaignIds() {
  var whereStatement = "WHERE ";
  var whereStatementsArray = [];
  var campaignIds = [];

  if (ignorePausedCampaigns) {
    whereStatement += "CampaignStatus = ENABLED ";
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
      "SELECT CampaignId " +
      "FROM   CAMPAIGN_PERFORMANCE_REPORT " +
      whereStatementsArray[i] +
      "DURING LAST_30_DAYS");

    var rows = adTextReport.rows();
    while (rows.hasNext()) {
      var row = rows.next();
      campaignIds.push(row['CampaignId']);
    }
  }

  if (campaignIds.length == 0) {
    throw ("No campaigns found with the given settings.");
  }

  return campaignIds;
}
