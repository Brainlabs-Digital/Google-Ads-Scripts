// ID: 43a5209fd8bde1cd70c49da8bc34729c
/**
 *
 * Capacity Controller pauses and labels all enabled campaigns
 * in your account when conversions in a day exceed a defined limit
 * Campaigns can then be re-enabled at midnight
 * Must be scheduled to run hourly
 *
 * Version: 1.0
 * Google AdWords Script maintained by brainlabsdigital.com
 *
 */


// INPUTS
var CONVERSION_LIMIT_INCLUSIVE = 37;                             // Pause account if conversions are greater than or equal to this
var LABEL_NAME = "Paused Due To Near Conversion Limit";          // This label MUST already exist in account or script will error
var DRY_RUN = true;                                              // If true the script will send emails but not pause the account, if false the account will be paused
var SEND_EMAILS = true;                                          // Whether or not you want to receive emails when changes are made
var EMAIL_RECIPIENTS = "example@domain.com";                     // People to receive emails (comma separated list)
var ENABLE_CAMPAIGNS = true;                                     // Whether you want the script to re-enable campaigns just after midnight

// DON'T MODIFY ANYTHING BELOW THIS LINE
//--------------------------------------
function main() {

  if (DRY_RUN == true) {
    Logger.log("Dry run mode enabled");
  }

  var timezone = AdsApp.currentAccount().getTimeZone();
  Logger.log("Account timezone: " + timezone);

  var hour = Utilities.formatDate(new Date, timezone, "HH");
  Logger.log("Current account hour: " + hour);

  if (hour == "00" && ENABLE_CAMPAIGNS == true) {
    try {
      enableCampaigns();
    }
    catch (e) {
      var accountName = AdsApp.currentAccount().getName();
      Logger.log("ERROR: " + e);
      MailApp.sendEmail(EMAIL_RECIPIENTS, "ERROR | Conversion Threshold Script", "There has been the following error in the script to pause/enable activity in the account " + accountName + " when conversions exceed a set limit:\n\n" + e);
    }
  }

  else if (hour != "00") {
    try {
      pauseCampaignsIfOverLimit();
    }
    catch (e) {
      var accountName = AdsApp.currentAccount().getName();
      Logger.log("ERROR: " + e);
      MailApp.sendEmail(EMAIL_RECIPIENTS, "ERROR | Conversion Threshold Script", "There has been the following error in the script to pause/enable activity in the account " + accountName + " when conversions exceed a set limit:\n\n" + e);
    }
  }
}

// Pause and label active campaigns if required
function pauseCampaignsIfOverLimit() {
  Logger.log("Conversion limit: " + CONVERSION_LIMIT_INCLUSIVE);
  var todayConversions = getTodayConversions();
  Logger.log("Today's Conversions so far: " + todayConversions);

  if (todayConversions >= CONVERSION_LIMIT_INCLUSIVE) {
    Logger.log("Number of conversions today greater than or equal to limit.");
    var notAlreadyPaused = pauseAndLabelCampaigns(LABEL_NAME, DRY_RUN);

    if (SEND_EMAILS == true && notAlreadyPaused == true) {
      var accountName = AdsApp.currentAccount().getName();
      var normalBody = "<HTML><BODY>Hi all, <br>" +
        "<br>" +
        "The account <b>" + accountName + "</b> has been paused as the number of conversions in the account today is <b>" + todayConversions + "</b>, which is above the defined limit of " + CONVERSION_LIMIT_INCLUSIVE + ". " +
        "Paused campaigns have been labelled as <b>" + LABEL_NAME + "</b><br>" +
        "<br>" +
        "Thanks.</BODY></HTML>";

      var dryRunBody = "<HTML><BODY>Hi all, <br>" +
        "<br>" +
        "The account <b>" + accountName + "</b> WOULD HAVE been paused due as the number of conversions in the account today is <b>" + todayConversions + "</b>, which is above the defined limit of " + CONVERSION_LIMIT_INCLUSIVE + ". " +
        "Campaigns have not been paused as the script is set to dry run.<br>" +
        "<br>" +
        "Thanks.</BODY></HTML>";

      if (DRY_RUN == true) {
        var dryRunSubject = " Dry Run | " + accountName + " Would Be Paused";
        MailApp.sendEmail({ to: EMAIL_RECIPIENTS, subject: dryRunSubject, htmlBody: dryRunBody });
      }
      else if (DRY_RUN == false) {
        var normalSubject = accountName + " Paused";
        MailApp.sendEmail({ to: EMAIL_RECIPIENTS, subject: normalSubject, htmlBody: normalBody });
      }
    }
  }
}

// Get conversions in account so far today
function getTodayConversions() {
  var accountTimeZone = AdsApp.currentAccount().getTimeZone();
  var dateToday = Utilities.formatDate(new Date(), accountTimeZone, "yyyy-MM-dd");
  Logger.log("Today's date (account timezone): " + dateToday);
  var report = AdsApp.report("SELECT Conversions FROM ACCOUNT_PERFORMANCE_REPORT DURING TODAY");
  var rows = report.rows();

  //report only has one row
  var row = rows.next();
  var todayConversions = row["Conversions"];

  var convAsNumber = Number(todayConversions.replace(",", ""));

  return convAsNumber;
}

// Pause and label enabled campaigns in account
// Will not make changes if isDryRun = true
// Returns whether or not there are any enabled campaigns to pause
function pauseAndLabelCampaigns(labelName, isDryRun) {
  var enabledCampaignsExist = false;
  var enabledCampaignsSelector = AdsApp.campaigns().withCondition("CampaignStatus = 'ENABLED'");
  var enabledCampaignsIterator = enabledCampaignsSelector.get();

  while (enabledCampaignsIterator.hasNext()) {
    enabledCampaignsExist = true;
    var campaign = enabledCampaignsIterator.next();
    var name = campaign.getName();

    if (isDryRun == true) {
      Logger.log("DRY RUN. Would pause and label: " + name);
    }
    else if (isDryRun == false) {
      Logger.log("Pausing and labelling: " + name);
      campaign.pause();
      campaign.applyLabel(labelName);
    }
  }

  return enabledCampaignsExist;
}

function enableCampaigns() {
  var wasEnabled = enablePausedCampaignsWithLabel(LABEL_NAME);
  var accountName = AdsApp.currentAccount().getName();
  if (SEND_EMAILS == true && wasEnabled == true) {
    MailApp.sendEmail(EMAIL_RECIPIENTS, accountName + " Enabled", "Hi all,\n\nThe campaigns in the account " + accountName + " which were previously paused due to hitting the account conversion limit have now been re-enabled");
  }

}

// Get selector of campaigns with label
function getCampaignsWithLabel(labelName) {
  var labelSelector = AdsApp.labels().withCondition("LabelName = '" + labelName + "'");
  var labelIterator = labelSelector.get();
  var labelledCampaignsSelector = labelIterator.next().campaigns();

  return labelledCampaignsSelector;
}

// Enable paused campaigns with label, and remove label
function enablePausedCampaignsWithLabel(labelName) {
  var campaignSelector = getCampaignsWithLabel(labelName).withCondition("CampaignStatus = PAUSED");
  var campaignIterator = campaignSelector.get();
  var somethingChanged = false;

  Logger.log("Enabling and removing labels from the following campaign(s):");
  while (campaignIterator.hasNext()) {
    var currentCampaign = campaignIterator.next();
    currentCampaign.removeLabel(labelName);
    currentCampaign.enable();
    Logger.log(currentCampaign.getName());
    somethingChanged = true;
  }

  if (somethingChanged == false) { Logger.log("No campaigns to enable."); }

  return somethingChanged;
}
