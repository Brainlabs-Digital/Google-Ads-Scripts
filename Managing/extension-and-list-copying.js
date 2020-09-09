// ID: 4107b2241ae2f2c20aaf1e61706dbf8a
/**
*
* Extension and List Copying
*
* This script takes the ad extensions, shared campaign negative lists and excluded
* placement lists applied to one template campaign and applies them to all other
* campaigns that match the filters. Campaigns are then labelled.
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
// while ["Display","Competitors"] would ignore any campaigns with 'Display' or
// 'Competitors' in the name. Case insensitive.
// Leave as [] to not exclude any campaigns.

var campaignNameContains = [];
// Use this if you only want to look at some campaigns.
// For example ["Brand"] would only look at campaigns with 'Brand' in the name,
// while ["Brand","Generic"] would only look at campaigns with 'Brand' or 'Generic'
// in the name. Case insensitive.
// Leave as [] to include all campaigns.

var ignorePausedCampaigns = false;
// Set this to true to only look at currently active campaigns.
// Set to false to also include campaigns that are currently paused.

var campaignToCopy = 'YOUR TEMPLATE CAMPAIGN NAME HERE';
// This is the name of the template campaign which has the correct lists already applied.
// All lists shared with this campaign will be shared with the other campaigns.
// Case sensitive!

var extensionsAndLists = ['sitelinks', 'callouts', 'reviews', 'mobileApps', 'phoneNumbers', 'excludedPlacementLists', 'negativeKeywordLists'];
// Which extensions and lists to copy.
// Possible values: "sitelinks", "callouts", "reviews", "mobileApps", "phoneNumbers",
// "excludedPlacementLists", "negativeKeywordLists"
// "mobileApps" are app extensions
// "phoneNumbers" are call extensions.

var labelName = 'Extensions and shared lists done';
// Once a campaign has had all the lists added, it will be labelled with this.


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
function main() {
  // Make sure the array of extensions and lists has entries,
  // that they're all recognised extensions/lists,
  // and that they're capitalised correctly
  if (extensionsAndLists.length == 0) {
    throw ('No extension or list types entered. Please have at least one in the extensionsAndLists array.');
  }
  var allowedExtensionsAndLists = ['sitelinks', 'callouts', 'reviews', 'mobileApps', 'phoneNumbers', 'excludedPlacementLists', 'negativeKeywordLists'];
  extensionsAndLists = checkListOfNames(allowedExtensionsAndLists, extensionsAndLists, 'extension(s)/list(s)');

  // Get the lists shared with the template campaign
  var templateCampaigns = AdWordsApp.campaigns()
    .withCondition('CampaignName = "' + campaignToCopy.replace(/"/g, '\\\"') + '"')
    .withCondition('CampaignStatus IN [ENABLED, PAUSED]')
    .get();

  if (!templateCampaigns.hasNext()) {
    throw ("No template campaign called '" + campaignToCopy + "' found.");
  }

  // There should be precisely one campaign in the iterator, because there should be
  // precisely one template campaign to look at. So we don't use a while loop, we just
  // look at the first campaign in the iterator.
  var templateCampaign = templateCampaigns.next();

  var objectsToAdd = [];

  for (var i = 0; i < extensionsAndLists.length; i++) {
    if (extensionsAndLists[i] == 'excludedPlacementLists' || extensionsAndLists[i] == 'negativeKeywordLists') {
      var iterator = templateCampaign[extensionsAndLists[i]]().get();
    } else {
      var iterator = templateCampaign.extensions()[extensionsAndLists[i]]().get();
    }
    objectsToAdd[i] = [];
    while (iterator.hasNext()) {
      var extension = iterator.next();
      objectsToAdd[i].push(extension);
    }
  }

  var totalObjectsToAdd = 0;
  for (var i = 0; i < extensionsAndLists.length; i++) {
    Logger.log(objectsToAdd[i].length + ' ' + extensionsAndLists[i] + ' found');
    totalObjectsToAdd += objectsToAdd[i].length;
  }

  if (totalObjectsToAdd == 0) {
    throw ('No ' + extensionsAndLists.join(', ') + " found to copy. Please check they are applied to template campaign '" + campaignToCopy + "'.");
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

  var addMethod = {};
  addMethod.sitelinks = 'addSitelink';
  addMethod.callouts = 'addCallout';
  addMethod.reviews = 'addReview';
  addMethod.mobileApps = 'addMobileApp';
  addMethod.phoneNumbers = 'addPhoneNumber';
  addMethod.excludedPlacementLists = 'addExcludedPlacementList';
  addMethod.negativeKeywordLists = 'addNegativeKeywordList';

  // Make an iterator of the campaigns that match the settings and are not labelled
  var campaigns = AdWordsApp.campaigns()
    .withCondition('CampaignId IN [' + campaignIds.join(',') + ']')
    .withCondition('Labels CONTAINS_NONE [' + labelId + ']')
    .get();
  var campaignCount = 0;

  // Go through each campaign and apply the lists
  while (campaigns.hasNext()) {
    var campaign = campaigns.next();
    for (var i = 0; i < extensionsAndLists.length; i++) { // Loop over the types of list
      for (var j = 0; j < objectsToAdd[i].length; j++) { // Loop over the lists to add
        campaign[addMethod[extensionsAndLists[i]]](objectsToAdd[i][j]); // Add the list
      }
    }
    campaign.applyLabel(labelName); // Label the campaign now the lists have been applied

    campaignCount++;
    if (campaignCount % 100 == 0) {
      Logger.log('Applied lists to ' + campaignCount + ' campaigns so far');
    }
  }

  if (campaignCount == 0) {
    Logger.log(campaignIds.length + " campaigns match the settings, but all were labelled with '" + labelName + "'. This suggests the extensions/lists have been applied to everything.");
  } else {
    Logger.log('Finished. Extensions/lists applied to ' + campaignCount + ' campaigns.');
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


// Verify that all field names are valid, and return a deduped list of them
// with the correct capitalisation
function checkListOfNames(allowedFields, givenFields, fieldName) {
  var allowedFieldsLowerCase = allowedFields.map(function (str) { return str.toLowerCase(); });
  var wantedFields = {};
  var unrecognisedFields = [];
  for (var i = 0; i < givenFields.length; i++) {
    var fieldIndex = allowedFieldsLowerCase.indexOf(givenFields[i].toLowerCase().replace(' ', '').trim());
    if (fieldIndex === -1) {
      // Try with an 's' on the end
      fieldIndex = allowedFieldsLowerCase.indexOf(givenFields[i].toLowerCase().replace(' ', '').trim() + 's');
    }
    if (fieldIndex === -1) {
      unrecognisedFields.push(givenFields[i]);
    } else {
      wantedFields[allowedFields[fieldIndex]] = true;
    }
  }

  if (unrecognisedFields.length > 0) {
    throw unrecognisedFields.length + ' ' + fieldName + " not recognised: '" + unrecognisedFields.join("', '")
      + "'. Please choose from '" + allowedFields.join("', '") + "'.";
  }

  return Object.keys(wantedFields);
}
