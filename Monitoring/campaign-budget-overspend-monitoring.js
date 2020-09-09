// ID: 9603512cc806b0a3cdbe3cbe8d1c8908
/**
 *
 * Campaign Budget Overspend Monitoring
 *
 * This script labels campaigns whose spend today is more than their daily
 * budgets. Optionally, it also pauses campaigns whose spend exceeds the
 * budget by too much. An email is then sent, listing the newly labelled
 * and paused campaigns.
 * When spend no longer exceeds budget, the campaigns are reactivated and
 * labels are removed.
 *
 * Version: 1.0
 * Google AdWords Script maintained on brainlabsdigital.com
 *
 */

// ////////////////////////////////////////////////////////////////////////////
// Options

var campaignNameContains = [];
// Use this if you only want to look at some campaigns.
// For example ["Generic"] would only look at campaigns with 'generic' in the name,
// while ["Generic", "Competitor"] would only look at campaigns with either
// 'generic' or 'competitor' in the name.
// Leave as [] to include all campaigns.

var campaignNameDoesNotContain = [];
// Use this if you want to exclude some campaigns.
// For example ["Brand"] would ignore any campaigns with 'brand' in the name,
// while ["Brand", "Key Terms"] would ignore any campaigns with 'brand' or
// 'key terms' in the name.
// Leave as [] to not exclude any campaigns.

var email = ['youremail@domain.com'];
// The email address you want the hourly update to be sent to.
// If you'd like to send to multiple addresses then have them separated by commas,
// for example ["aa@example.com", "bb@example.com"]

var currencySymbol = '£';
// Used for formatting in the email.

var thousandsSeparator = ',';
// Numbers will be formatted with this as the thousands separator.
// eg If this is ",", 1000 will appear in the email as 1,000
// If this is ".", 1000 will appear in the email as 1.000
// If this is "" 1000 will appear as 1000.

var decimalMark = '.';
// Numbers will be formatted with this as the decimal mark
// eg if this is ".", one and a half will appear in the email as 1.5
// and if this is "," it will be 1,5

var labelThreshold = 1.0;
// This is multiplied by the campaign's daily budget to create a threshold.
// If the campaign spend is higher than the threshold, it will be labelled
// (and you will be emailed).
// For example if labelThreshold = 1.0 then campaigns are labelled when
// their spend is greater than or equal to their budget.

var labelName = 'Over Budget';
// The name of the label you want to apply to campaigns that have gone
// over budget.

var campaignPauser = false;
// Set this to true to pause campaigns if spend exceeds the pauseThreshold.
// Set to false if campaigns are to be kept enabled.

var pauseThreshold = 1.2;
// This is multiplied by the campaign's daily budget to create a threshold.
// If campaignPauser is true and the campaign spend is higher than this threshold,
// it will be paused (and you will be emailed).
// For example if pauseThreshold = 1.2 then campaigns are paused when
// their spend is greater than or equal to 120% of their budget.
// pauseThreshold MUST be greater than or equal to the labelThreshold, so that all
// campaigns that the script pauses are also labelled.


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Functions

function main() {
  checkInputs();

  // Get the campaign IDs (based on campaignNameDoesNotContain and campaignNameContains)
  var campaignData = getCampaignIds();

  var campaignsToAddLabel = [];
  var campaignsToRemoveLabel = [];
  var campaignsToPause = [];
  var campaignsToEnable = [];

  for (var campaignId in campaignData) {
    var currentCampaign = campaignData[campaignId];

    var budget = currentCampaign.Budget;
    var status = currentCampaign.CampaignStatus;
    var spend = currentCampaign.Spend;
    var label = currentCampaign.Labels;

    var pauseBudgetCap = pauseThreshold * budget;
    var labelBudgetCap = labelThreshold * budget;

    if (status == 'enabled' && label.indexOf('"' + labelName + '"') == -1) {
      if (spend >= labelBudgetCap) {
        campaignsToAddLabel.push(currentCampaign);
      }
    }
    if (status == 'enabled') {
      if (spend >= pauseBudgetCap) {
        campaignsToPause.push(currentCampaign);
      }
    }
    if (status == 'paused' && label.indexOf('"' + labelName + '"') != -1) {
      if (spend <= pauseBudgetCap) {
        campaignsToEnable.push(currentCampaign);
      }
    }
    if (status == 'enabled' && label.indexOf('"' + labelName + '"') != -1) {
      if (spend <= labelBudgetCap) {
        campaignsToRemoveLabel.push(currentCampaign);
      }
    }
  }

  // Change and update campaigns
  if (campaignsToEnable.length > 0 && campaignPauser === true) {
    Logger.log(campaignsToEnable.length + ' campaigns to enable');
    enableCampaigns(campaignsToEnable);
  }
  if (campaignsToRemoveLabel.length > 0) {
    Logger.log(campaignsToRemoveLabel.length + ' campaigns to unlabel');
    removeLabel(campaignsToRemoveLabel);
  }
  if (campaignsToAddLabel.length > 0) {
    Logger.log(campaignsToAddLabel.length + ' campaigns to label');
    addLabel(campaignsToAddLabel);
  }
  if (campaignsToPause.length > 0 && campaignPauser === true) {
    Logger.log(campaignsToPause.length + ' campaigns to pause');
    pauseCampaigns(campaignsToPause);
  }

  // Send an email, if actions were taken
  sendSummaryEmail(campaignsToAddLabel, campaignsToPause, campaignPauser, email);
}


// Check the inputs
function checkInputs() {
  if (!isValidNumber(labelThreshold)) {
    throw "labelThreshold '" + labelThreshold + "' is not a valid, positive number.";
  }
  if (labelThreshold > 2) {
    Logger.log("Warning: labelThreshold '" + labelThreshold + "' is greater than 2. As AdWords does not spend more than twice the budget, this threshold will not be reached.");
  }
  if (campaignPauser) {
    if (!isValidNumber(pauseThreshold)) {
      throw "pauseThreshold '" + pauseThreshold + "' is not a valid, positive number.";
    }
    if (pauseThreshold < labelThreshold) {
      throw "pauseThreshold '" + pauseThreshold + "' is less than labelThreshold '" + labelThreshold + "'. It should be greater than or equal to labelThreshold.";
    }
    if (pauseThreshold > 2) {
      Logger.log("Warning: pauseThreshold '" + pauseThreshold + "' is greater than 2. As AdWords does not spend more than twice the budget, this threshold will not be reached.");
    }
  }
}


// Checks the input is a number that's finite and greater than zero
function isValidNumber(number) {
  var isANumber = !isNaN(number) && isFinite(number);
  var isPositive = number > 0;
  return isANumber && isPositive;
}


// Get the IDs of campaigns which match the given options
function getCampaignIds() {
  var whereStatement = "WHERE CampaignStatus IN ['ENABLED','PAUSED'] ";
  var whereStatementsArray = [];
  var campData = {};

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
    var report = AdWordsApp.report(
      'SELECT CampaignId, CampaignName, CampaignStatus, Amount, Labels, LabelIds, Cost '
      + 'FROM   CAMPAIGN_PERFORMANCE_REPORT '
      + whereStatementsArray[i]
      + "AND AdvertisingChannelType IN ['SEARCH', 'DISPLAY'] "
      + 'DURING TODAY'
    );

    var rows = report.rows();
    while (rows.hasNext()) {
      var row = rows.next();
      var budget = parseFloat(row.Amount.replace(/,/g, ''));
      var spend = parseFloat(row.Cost.replace(/,/g, ''));
      var campaignId = row.CampaignId;

      campData[campaignId] = {
        CampaignId: campaignId,
        CampaignName: row.CampaignName,
        CampaignStatus: row.CampaignStatus,
        Spend: spend,
        Budget: budget,
        Labels: row.Labels,
        LabelId: row.LabelIds
      };
    }
  }

  var campaignIds = Object.keys(campData);
  if (campaignIds.length == 0) {
    throw ('No campaigns found with the given settings.');
  }
  Logger.log(campaignIds.length + ' campaigns found');

  return campData;
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


// Pause Campaigns
function pauseCampaigns(campaignData) {
  for (j = 0; j < campaignData.length; j++) {
    var campaignIterator = AdWordsApp.campaigns()
      .withCondition('CampaignId = ' + campaignData[j].CampaignId)
      .get();
    if (campaignIterator.hasNext()) {
      var campaign = campaignIterator.next();
      campaign.pause();
      campaignData[j].CampaignStatus = 'paused';
    }
  }
}


// Enable Campaigns that were paused
function enableCampaigns(campaignData) {
  for (j = 0; j < campaignData.length; j++) {
    var campaignIterator = AdWordsApp.campaigns()
      .withCondition('CampaignId = ' + campaignData[j].CampaignId)
      .get();
    if (campaignIterator.hasNext()) {
      var campaign = campaignIterator.next();
      campaign.enable();
      campaignData[j].CampaignStatus = 'enabled';
    }
  }
}


// Add Labels to campaigns
function addLabel(campaignData) {
  for (j = 0; j < campaignData.length; j++) {
    var campaign = AdWordsApp.campaigns()
      .withCondition('CampaignId = ' + campaignData[j].CampaignId).get().next();
    getOrCreateLabelId(labelName);
    campaign.applyLabel(labelName);
  }
}


// Remove Labels from campaigns
function removeLabel(campaignData) {
  for (j = 0; j < campaignData.length; j++) {
    var campaign = AdWordsApp.campaigns()
      .withCondition('CampaignId = ' + campaignData[j].CampaignId).get().next();
    campaign.removeLabel(labelName);
  }
}


// Combines information on labelled and paused campaigns and emails this
function sendSummaryEmail(campaignsToAddLabel, campaignsToPause, campaignPauser, email) {
  var localDate = Utilities.formatDate(new Date(), AdWordsApp.currentAccount().getTimeZone(), 'yyyy-MM-dd');
  var localTime = Utilities.formatDate(new Date(), AdWordsApp.currentAccount().getTimeZone(), 'HH:mm');

  // Assemble the email message
  var subject = AdWordsApp.currentAccount().getName() + ' - Budget Overspend Email';
  var message = '';
  message += makeChangeMessage(campaignsToAddLabel, 'labelled');
  if (campaignPauser) {
    message += makeChangeMessage(campaignsToPause, 'paused');
  }
  if (message == '') {
    Logger.log('No message to send.');
    return;
  }
  message = localDate + ' at ' + localTime + ' :' + message;
  MailApp.sendEmail({
    to: email.join(','),
    subject: subject,
    htmlBody: message
  });
  Logger.log('Message to ' + email.join(',') + ' sent.');
}


// Turns campaign data into an HTML table
function makeChangeMessage(campaignData, changed) {
  if (campaignData.length == 0) {
    return '';
  }
  var message = '<br><br>Campaigns that have been ' + changed + '<br><br>';
  var table = "<table border=1 style='border: 1px solid black; border-collapse: collapse;'>";
  table += '<tr><th>Campaign ID</th><th>Campaign Name</th><th>Status</th><th>Spend</th><th>Budget</th></tr>';
  for (var k = 0; k < campaignData.length; k++) {
    table += '<tr><td>' + campaignData[k].CampaignId + '</td><td>' + campaignData[k].CampaignName + '</td><td>'
      + campaignData[k].CampaignStatus + '</td><td>' + formatNumber(campaignData[k].Spend, true) + '</td><td>' + formatNumber(campaignData[k].Budget, true) + '</td>';
    table += '</tr>';
  }
  table += '</table>';
  message += table;
  return message;
}


// Formats a number with the specified thousand separator and decimal mark
// Adds the currency symbol and two decimal places if isCurrency is true
function formatNumber(number, isCurrency) {
  if (isCurrency) {
    var formattedNumber = number.toFixed(2);
    formattedNumber = formattedNumber.substr(0, formattedNumber.length - 3);
    formattedNumber = formattedNumber.split('').reverse().join('').replace(/(...)/g, '$1 ')
      .trim()
      .split('')
      .reverse()
      .join('')
      .replace(/ /g, thousandsSeparator);
    formattedNumber = currencySymbol + formattedNumber + decimalMark + number.toFixed(2).substr(-2);
  } else {
    var formattedNumber = number.toFixed(0).split('').reverse().join('')
      .replace(/(...)/g, '$1 ')
      .trim()
      .split('')
      .reverse()
      .join('')
      .replace(/ /g, thousandsSeparator);
  }
  return formattedNumber;
}
