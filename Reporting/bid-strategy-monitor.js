// ID: f9f1aab1b70628be9e156f6b09e9f32e

/**
*
* Bid Strategy Performance Monitor
*
* This script allows Google Ads MCC Accounts to monitor the performance
* of various bidding strategies on child accounts based on defined
* metrics.
*
* Version: 1.0
* Google Ads Script maintained on brainlabsdigital.com
*
**/

//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

//Options

//Spreadsheet URL

var SPREADSHEET_URL = 'https://docs.google.com/YOUR-SPREADSHEET-URL-HERE';

//Ignore Paused Campaigns

// Set to 'false' to include paused campaigns in data.

var ignorePausedCampaigns = true;

//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

// Metrics

// Metrics are written onto output sheet in order stated below. Read the 'Metric'
// column of the Google Ads documentation to find other metrics to include:
// https://developers.google.com/adwords/api/docs/appendix/reports/campaign-performance-report

var METRICS = [
  'AverageCpc',
  'Clicks',
  'Conversions',
  'Cost',
  'Ctr',
  'Impressions',
  'TopImpressionPercentage'
];

//Bidding Strategies

var BIDDING_STRATEGIES =
{
  'Manual CPC': 'MANUAL_CPC',
  'Manual CPV': 'MANUAL_CPV',
  'Manual CPM': 'MANUAL_CPM',
  'Target search page location': 'PAGE_ONE_PROMOTED',
  'Maximize clicks': 'TARGET_SPEND',
  'Target CPA': 'TARGET_CPA',
  'Target ROAS': 'TARGET_ROAS',
  'Maximize Conversions': 'MAXIMIZE_CONVERSIONS',
  'Maximize Conversion Value': 'MAXIMIZE_CONVERSION_VALUE',
  'Target Outranking Share': 'TARGET_OUTRANK_SHARE'
};

// Indices

var INPUT_HEADER_ROW = 1;
var INPUT_DATA_ROW = 3;
var OUTPUT_HEADER_ROW = 2;

//////////////////////////////////////////////////////////////////////////////

// Functions

function main() {

  var spreadsheet = getSpreadsheet(SPREADSHEET_URL);
  var inputSheet = spreadsheet.getSheetByName("Input");
  var outputSheet = spreadsheet.getSheetByName("Output");

  var tz = AdsApp.currentAccount().getTimeZone();

  //Store Sheet Headers and Indices

  var inputHeaders = inputSheet.getRange(INPUT_HEADER_ROW + ":" + INPUT_HEADER_ROW).getValues()[0];
  var statusColumnIndex = inputHeaders.indexOf("Status");
  var accountIDColumnIndex = inputHeaders.indexOf("Account ID");
  var accountNameColumnIndex = inputHeaders.indexOf("Account Name")
  var biddingStrategyColumnIndex = inputHeaders.indexOf("Bidding Strategy");
  var campaignNameContainsIndex = inputHeaders.indexOf("Campaign Name Contains");
  var campaignNameDoesNotContainIndex = inputHeaders.indexOf("Campaign Name Doesn't Contain");
  var contactEmailsColumnIndex = inputHeaders.indexOf("Contact email(s)")
  var startDateColumnIndex = inputHeaders.indexOf("Start Date");
  var endDateColumnIndex = inputHeaders.indexOf("End Date");
  var outputHeaders = outputSheet.getRange(OUTPUT_HEADER_ROW + ":" + OUTPUT_HEADER_ROW).getValues()[0];
  var timeRunIndex = outputHeaders.indexOf("Time Run");

  //Get all rows of data.

  var allData = inputSheet.getRange(INPUT_DATA_ROW, 1, inputSheet.getLastRow() - (INPUT_HEADER_ROW + 1), inputSheet.getLastColumn()).getValues();

  //For each row of data:
  Logger.log("Verifying each row of data...")
  for (var i = 0; i < allData.length; i++) {
    var row = allData[i];
    if (row[statusColumnIndex] == "Paused") {
      continue;
    };
    var accountName = row[accountNameColumnIndex];
    var contacts = (row[contactEmailsColumnIndex]).split(',').map(function(item){
      return item.trim();
    });
    var childAccount = getAccountId(row[accountIDColumnIndex], contacts, accountName);
    AdsManagerApp.select(childAccount);
    var dates = getDates([row[startDateColumnIndex], row[endDateColumnIndex]], tz, contacts, accountName);
    var combinedQueries = makeQueries(dates, row[campaignNameContainsIndex], row[campaignNameDoesNotContainIndex],row[biddingStrategyColumnIndex])
    var dataRow = getMetricsforRow(combinedQueries, contacts, accountName);
    var outputRows = [];
    outputRows = [row[accountNameColumnIndex], row[accountIDColumnIndex], row[biddingStrategyColumnIndex]]
      .concat(dataRow.map(function (data) {
        return data.value
      }));
    writeRows(outputSheet, outputRows);
    setDate(outputSheet, timeRunIndex);
  }
  Logger.log("Success.")
}

function getSpreadsheet(spreadsheetUrl) {
  Logger.log('Checking spreadsheet: ' + SPREADSHEET_URL + ' is valid.');
  if (spreadsheetUrl.replace(/[AEIOU]/g, "X") == "https://docs.google.com/YXXR-SPRXXDSHXXT-XRL-HXRX") {
    throw ("Problem with " + SPREADSHEET_URL +
    " URL: make sure you've replaced the default with a valid spreadsheet URL."
    );
  }
  try {
    var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);

    var sheet = spreadsheet.getSheets()[0];
    var sheetName = sheet.getName();
    sheet.setName(sheetName);

    return spreadsheet;
  } catch (e) {
    throw ("Problem with " + SPREADSHEET_URL + " URL: '" + e + "'. You may not have edit access");
  }
}

function getAccountId(accountId, contacts, accountName) {
  var childAccount = AdsManagerApp.accounts().withIds([accountId]).get();
  if (childAccount.hasNext()) {
    return childAccount.next();
  }
  else {
    MailApp.sendEmail({
      to: contacts.join(),
      subject: "Bid Strategy Performance Monitor: error with account " + accountName,
      htmlBody: "Could not find account with ID: " + accountId + "."
    });
  throw ("Could not find account with ID: " + accountId);
  }
  
}

function getDates(dates, tz, contacts, accountName) {
  var validatedDates = dates.map(function (date) {
    if (date.length === 0) {
      var today = new Date()
      return Utilities.formatDate(today, tz, 'yyyyMMdd');
    }
    else {
      return Utilities.formatDate(new Date(date), tz, 'yyyyMMdd');
    }
  })
  if (validatedDates[0] <= validatedDates[1]) {
    return validatedDates;
  }
  else {
    MailApp.sendEmail({
      to: contacts.join(),
      subject: "Bid Strategy Performance Monitor: error with account " + accountName,
      htmlBody: ("Invalid date ranges (yyyMMdd): End Date: "
        + validatedDates[1] + " precedes Start date: " + validatedDates[0])
    })
    throw ("Invalid date ranges: End Date precedes Start Date.");
  }
}

function makeQueries(dates, campaignNameContains, campaignNameDoesNotContain, biddingStrategy){
  var campaignNameContains = campaignNameContains.split(',').map(function(item){
    return item.trim();
  });
  var campaignNameDoesNotContain = campaignNameDoesNotContain.split(',').map(function(item){
    return item.trim();
  });
  var campaignFilterQueries = makeCampaignFilterStatements(campaignNameContains, campaignNameDoesNotContain, ignorePausedCampaigns);
  var biddingStrategyQuery = makeBiddingStrategyStatement((biddingStrategy));
  var combinedQueries = combineQueries(dates, biddingStrategyQuery, campaignFilterQueries);
  return combinedQueries;
}
function makeCampaignFilterStatements(campaignNameContains, campaignNameDoesNotContain, ignorePausedCampaigns) {
  var whereStatement = "WHERE ";
  var whereStatementsArray = [];

  if (ignorePausedCampaigns) {
    whereStatement += "CampaignStatus = ENABLED ";
  } else {
    whereStatement += "CampaignStatus IN ['ENABLED','PAUSED'] ";
  }

  for (var i = 0; i < campaignNameDoesNotContain.length; i++) {
    if (campaignNameDoesNotContain  == ""){
      break;;
    }
    else {
    whereStatement += "AND CampaignName DOES_NOT_CONTAIN_IGNORE_CASE '"
      + campaignNameDoesNotContain[i].replace(/"/g, '\\\"') + "' ";
  }
  }

  if (campaignNameContains.length == 0) {
    whereStatementsArray = [whereStatement];

  }
  else {
    for (var i = 0; i < campaignNameContains.length; i++) {
      whereStatementsArray.push(whereStatement + 'AND CampaignName CONTAINS_IGNORE_CASE "'
        + campaignNameContains[i].replace(/"/g, '\\\"') + '" '
        );
    }
  }
  return whereStatementsArray;
}

function makeBiddingStrategyStatement(biddingStrategy) {
  if (biddingStrategy.length === 0) {
    return ""
  }
  else {
    for (var key in BIDDING_STRATEGIES) {
      if (key == biddingStrategy) {
        return " AND BiddingStrategyType = " + BIDDING_STRATEGIES[key]
      };
    }
  }
};

function combineQueries(dates, biddingStrategyQuery, campaignFilterQueries) {
  var combinedQueries = []
  for (var i = 0; i < campaignFilterQueries.length; i++) {
    combinedQueries.push(campaignFilterQueries[i]
      .concat(biddingStrategyQuery + " DURING " + dates[0] + "," + dates[1]
      ));
  }
  return combinedQueries;
}

function getMetricsforRow(queries, contacts, accountName) {

  var ReportRows = getMetricsforSettings(queries, contacts, accountName);
  return ReportRows;
}

function getMetricsforSettings(queries, contacts, accountName) {
  var metricCounter = makeEmptyMetricCounter()
  var totalCampaignCount = 0;
  for (var i = 0; i < queries.length; i++) {
    var singleCampaignCount = 0
    var report = AdsApp.report(
      "SELECT " + METRICS.map(function (field) {
        return field;
      }).join(',') + " FROM CAMPAIGN_PERFORMANCE_REPORT " + queries[i]
    );
    var rows = report.rows();
    if (rows.hasNext() === false) {
      MailApp.sendEmail({
        to: contacts.join(),
        subject: "Bid Strategy Performance Monitor: error with account " + accountName,
        htmlBody: "No campaigns found with the given settings: " + queries[i]
      });
    }
    while (rows.hasNext()) {
      singleCampaignCount = parseInt(singleCampaignCount) + parseInt(1);
      var row = rows.next();
      metricCounter.map(function (metric) {
        metric.value = parseFloat(metric.value) + (parseFloat((row[metric.name])) || 0);
        return metric.value;
      });
    }
    totalCampaignCount = parseInt(totalCampaignCount) + parseInt(singleCampaignCount)
  }
  metricCounter.push({name: "Total Campaigns", value: totalCampaignCount})
  return metricCounter;

  function makeEmptyMetricCounter() {
    var metricCounter = [];
    metricCounter.push(METRICS.map(function (field) {
      return {name: field, value: 0};
    }));
    return metricCounter[0];
  }
}

function writeRows(sheet, rows) {
  for (var i = 0; i < 5; i++) {
    try {
      sheet.getRange((sheet.getLastRow() + 1), 1, 1, rows.length).setValues([rows]);

      break;

    } catch (e) {
      if (e == "Exception: This action would increase the number of cells in the worksheet above the limit of 2000000 cells.") {
        Logger.log("Could not write to spreadsheet: '" + e + "'");
        try {
          sheet.getRange("R" + (sheet.getLastRow() + 2) + "C1")
            .setValue("Not enough space to write the data - try again in an empty spreadsheet");
        } catch (e2) {
          Logger.log("Error writing 'not enough space' message: " + e2);
        }
        break;
      }
      if (i == 4) {
        Logger.log("Could not write to spreadsheet: '" + e + "'");
      }
    }
  }
}

function setDate(sheet, columnIndex) {
  var now = new Date();
  sheet.getRange((sheet.getLastRow()), columnIndex + 1).setValue(now);
}

