// ID: 880fe84203c17b835343b8f69b32bf33
/**
 *
 * Hourly Email Updates
 *
 * This script emails you every hour with totals for selected performance metrics (like cost)
 * for your account for the day so far.
 *
 * Version: 1.1
 * Updated 2016-10-11: removed 'ConvertedClicks'
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

var email = ['aa@example.com'];
// The email address you want the hourly update to be sent to.
// If you'd like to send to multiple addresses then have them separated by commas,
// for example ["aa@example.com", "bb@example.com"]

var metricsToReport = ['Cost', 'Impressions', 'Clicks'];
// Allowed fields: "Impressions", "Clicks", "Cost",
// "Conversions", "ConversionValue"

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


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Functions

function main() {
  // Get the campaign IDs (based on campaignNameDoesNotContain and campaignNameContains)
  var campaignIds = getCampaignIds();

  var localDate = Utilities.formatDate(new Date(), AdWordsApp.currentAccount().getTimeZone(), 'yyyy-MM-dd');
  var localTime = Utilities.formatDate(new Date(), AdWordsApp.currentAccount().getTimeZone(), 'HH:mm');
  Logger.log('Date: ' + localDate);
  Logger.log('Time: ' + localTime);

  // Check the given metrics, and make sure they are trimmed and correctly capitalised
  var allowedFields = ['Conversions', 'ConversionValue', 'Impressions', 'Clicks', 'Cost'];
  var metrics = checkFieldNames(allowedFields, metricsToReport);

  // Get the total metrics for today
  var totals = getMetrics('TODAY', campaignIds, metrics);

  // Assemble the email message
  var subject = AdWordsApp.currentAccount().getName() + ' Hourly Email';
  if (totals.Cost != undefined) {
    subject += ' - Cost is ' + formatNumber(totals.Cost, true);
  }
  var message = 'Metrics for ' + localDate + ' at ' + localTime + '\n';

  for (var i = 0; i < metrics.length; i++) {
    var isCurrency = (metrics[i] == 'Cost' || metrics[i] == 'ConversionValue');
    message += metrics[i] + ' = ' + formatNumber(totals[metrics[i]], isCurrency) + '\n';
    Logger.log(metrics[i] + ' = ' + totals[metrics[i]]);
  }

  // Send the email
  MailApp.sendEmail(email.join(','), subject, message);
  Logger.log('Message to ' + email.join(',') + ' sent.');
}


// Get the IDs of campaigns which match the given options
function getCampaignIds() {
  var whereStatement = "WHERE CampaignStatus IN ['ENABLED','PAUSED','REMOVED'] AND Impressions > 0 ";
  var whereStatementsArray = [];
  var campaignIds = [];

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
      + 'DURING TODAY'
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

  Logger.log(campaignIds.length + ' campaigns found');
  return campaignIds;
}


// Verify that all field names are valid, and return a list of them with the
// correct capitalisation
function checkFieldNames(allowedFields, givenFields) {
  var allowedFieldsLowerCase = allowedFields.map(function (str) {
    return str.toLowerCase();
  });
  var wantedFields = [];
  var unrecognisedFields = [];
  for (var i = 0; i < givenFields.length; i++) {
    var fieldIndex = allowedFieldsLowerCase.indexOf(givenFields[i].toLowerCase().replace(' ', '').trim());
    if (fieldIndex === -1) {
      unrecognisedFields.push(fields[i]);
    } else {
      wantedFields.push(allowedFields[fieldIndex]);
    }
  }

  if (unrecognisedFields.length > 0) {
    throw unrecognisedFields.length + " field(s) not recognised: '" + unrecognisedFields.join("', '")
      + "'. Please choose from '" + allowedFields.join("', '") + "'.";
  }

  return wantedFields;
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


// Get totals for the listed metrics in the given campaigns in the given date range
function getMetrics(dateRange, campaignIds, metrics) {
  // Initialise the object that will store the metrics' data
  var totals = {};
  for (var i = 0; i < metrics.length; i++) {
    totals[metrics[i]] = 0;
  }

  var report = AdWordsApp.report(
    'SELECT ' + metrics.join(', ') + ' '
    + 'FROM   CAMPAIGN_PERFORMANCE_REPORT '
    + 'WHERE  Impressions > 0 AND CampaignId IN [' + campaignIds.join(',') + '] '
    + 'DURING ' + dateRange
  );

  var rows = report.rows();
  while (rows.hasNext()) {
    var row = rows.next();
    for (var i = 0; i < metrics.length; i++) {
      totals[metrics[i]] += parseFloat(row[metrics[i]].replace(/,/g, ''));
    }
  }

  return totals;
}
