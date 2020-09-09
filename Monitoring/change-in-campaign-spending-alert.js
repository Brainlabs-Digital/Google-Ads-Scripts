// ID: 95864684fe37d20c010dd64ea5607b2b
/**
*
* Change in Campaign Spending Alert
*
* This script uses the current hour to calculate how much has been spent on
* individual campaigns on the day of running. The average spend up to the
* current hour in a specified numbers of days previously is averaged. If the
* spend today is higher by a specified percentage threshold an alert email
* is sent.
*
* There is a 20 minute delay between events occurring and the data being
* available in AdWords. This script should be scheduled to run after 20
* past the hour.
*
* Version: 1.0
* Google AdWords Script maintained on brainlabsdigital.com
*
**/

function main() {
  //////////////////////////////////////////////////////////////////////////////
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

  var addressesToNotify = [];
  // An array of email addresses to send alerts to, example usage:
  // ['ron@gryffindor.hogwarts.ac.uk', 'hermione@gryffindor.hogwarts.ac.uk']
  // ['luna@ravenclaw.hogwarts.ac.uk']

  //////////////////////////////////////////////////////////////////////////////
  // Thresholds

  var percentageDifferenceSpend = 10;
  // The positive or negative percentage change in spend must be greater than
  // this number for an alert to be sent. eg 10 means greater than a positive or negative
  // 10% change. The variable must be positive.

  var averageSpendMinimumThreshold = 100.00;
  // This value sets a minimum value that the average historic spend should be
  // for it to be compared to today's spend. This number must be greater than 0.

  var earliestHour = 7;
  // Restricts the script to run only after a certain hour of the day so that a
  // significant amount of data can be gathered. This number should be 0 - 23.

  //////////////////////////////////////////////////////////////////////////////
  // Advanced settings

  var timePeriod = 7;
  // The default time period averages the previous 7 days of spending. This number
  // must be greater than 0.

  //////////////////////////////////////////////////////////////////////////////
  // The actual code starts here

  // Validate input
  var validated = validateInput(
    addressesToNotify,
    percentageDifferenceSpend,
    averageSpendMinimumThreshold,
    earliestHour,
    timePeriod
  );

  if (validated !== true) {
    throw validated;
  }

  // Create date strings for AWQL query and data comparison
  var dates = makeDates(timePeriod);

  // Check if it's too early to run the script or not
  if (dates.currentHour < earliestHour) {
    Logger.log('Too early for code, need coffee.');
    return;
  }

  // Get the IDs of the campaigns to look at
  var ignorePausedCampaigns = true;
  var activeCampaignIds = getCampaignIds(campaignNameDoesNotContain, campaignNameContains, ignorePausedCampaigns);

  // Construct the AWQL query using the campaign IDs and dates
  var query = constructQuery(activeCampaignIds, dates);

  var queryReport = AdWordsApp.report(query);

  // Calculate sum of spend today and historically by campaign ID
  var costs = calculateCostByCampaign(queryReport, dates);

  Logger.log("Got the costs for all campaigns");

  // Generate a dictionary of overspending campaigns
  var overSpendingCampaigns = checkPercentageChange(costs, averageSpendMinimumThreshold, timePeriod, percentageDifferenceSpend);

  // Do nothing if there are no overspending campaigns
  if (Object.keys(overSpendingCampaigns).length === 0) {
    Logger.log('No overspending campaigns.');
    return;
  }

  Logger.log('Overspending campaigns: ' + JSON.stringify(overSpendingCampaigns));

  // Notify contacts if there are overspending campaigns
  notifyContact(addressesToNotify, overSpendingCampaigns, averageSpendMinimumThreshold);
  Logger.log("Email sent.");
}

function validateInput(addressesToNotify,
  percentageDifferenceSpend,
  averageSpendMinimumThreshold,
  earliestHour,
  timePeriod
) {

  if (addressesToNotify.length === 0) {
    return 'Please provide at least one email address to notify.';
  }

  if (percentageDifferenceSpend <= 0) {
    return 'Please provide a positive percentage difference spend.';
  }

  if (averageSpendMinimumThreshold <= 0) {
    return 'Please provide a positive average spend minimum threshold.';
  }

  if (earliestHour > 23 | earliestHour < 0) {
    return 'Please provide an earliest hour between 0 and 23 inclusive.'
  }

  if (timePeriod < 1) {
    return 'Please provide a time period of at least one day.'
  }

  return true;
}

function notifyContact(addresses, overSpendingCampaigns, threshold) {
  var accountName = AdWordsApp.currentAccount().getName();
  var subject = accountName + ' | Spend Checker Script | Campaigns have exceeded your spend change threshold.';
  var body = 'The following campaigns have exceeded the ' + threshold + '% spend threshold:\n\n';

  var campaignIds = Object.keys(overSpendingCampaigns);

  for (var i = 0; i < campaignIds.length; i++) {
    var campaignId = campaignIds[i];
    var campaign = overSpendingCampaigns[campaignId];
    var campaignName = campaign.campaignName;
    var percentageChange = campaign.percentageChange.toFixed(2);
    var spendToday = campaign.today.toFixed(2);

    body += (i + 1) + '. \nName: ' + campaignName + '\n' +
      'ID: ' + campaignId + '\n' +
      'Change(%): ' + percentageChange + '\n' +
      'Spend today (£): ' + spendToday + '\n\n';
  }

  MailApp.sendEmail(addresses.join(','), subject, body);
}

function checkPercentageChange(costs, spendThreshold, timePeriod, percentageThreshold) {
  var campaignIds = Object.keys(costs);

  return campaignIds.reduce(function (overspendingCampaigns, campaignId) {
    var campaign = costs[campaignId];
    var averageSpend = campaign.sumTimePeriod / timePeriod;
    var spendToday = campaign.today;

    if (averageSpend < spendThreshold) {
      return overspendingCampaigns;
    }

    var percentageChange = ((spendToday - averageSpend) / averageSpend) * 100;

    if (Math.abs(percentageChange) > percentageThreshold) {
      campaign['percentageChange'] = percentageChange;
      overspendingCampaigns[campaignId] = campaign;
    }

    return overspendingCampaigns;
  }, {});
}

function makeDates(timePeriod) {
  var millisPerDay = 1000 * 60 * 60 * 24;
  var timeZone = AdWordsApp.currentAccount().getTimeZone();

  var now = new Date();
  var dateInPast = new Date(now - ((timePeriod + 1) * millisPerDay));

  var todayHyphenated = Utilities.formatDate(now, timeZone, 'yyyy-MM-dd');
  var todayFormatted = todayHyphenated.replace(/-/g, '');
  var currentHour = Utilities.formatDate(now, timeZone, 'H');

  var dateInPastFormatted = Utilities.formatDate(dateInPast, timeZone, 'yyyyMMdd');

  return {
    'todayHyphenated': todayHyphenated,
    'todayFormatted': todayFormatted,
    'dateInPastFormatted': dateInPastFormatted,
    'currentHour': currentHour,
  };

}

function constructQuery(activeCampaignIds, dates) {
  var currentHour = dates.currentHour;
  var todayFormatted = dates.todayFormatted;
  var dateInPastFormatted = dates.dateInPastFormatted;

  var query =
    'SELECT CampaignName, CampaignId, Cost, HourOfDay, Date ' +
    'FROM CAMPAIGN_PERFORMANCE_REPORT ' +
    'WHERE CampaignId IN [' + activeCampaignIds.join(',') + '] ' +
    'AND CampaignStatus = ENABLED ' +
    'AND HourOfDay < ' + currentHour + ' ' +
    'DURING ' + dateInPastFormatted + ',' + todayFormatted;

  Logger.log('AWQL Query: ' + query);

  return query;
}

function calculateCostByCampaign(report, dates) {
  var reportRows = report.rows();
  var costs = {};

  while (reportRows.hasNext()) {
    var row = reportRows.next();
    var cost = parseFloat(row.Cost);
    var campaignId = row.CampaignId;

    if (costs[campaignId] === undefined) {
      costs[campaignId] = {
        'today': 0,
        'sumTimePeriod': 0,
        'campaignName': row.CampaignName,
      }
    }

    if (row.Date === dates.todayHyphenated) {
      costs[campaignId].today += cost;
    } else {
      costs[campaignId].sumTimePeriod += cost;
    }
  }

  return costs;
}

function getCampaignIds(campaignNameDoesNotContain, campaignNameContains, ignorePausedCampaigns) {
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
    var campaignReport = AdWordsApp.report(
      "SELECT CampaignId " +
      "FROM   CAMPAIGN_PERFORMANCE_REPORT " +
      whereStatementsArray[i] +
      "DURING LAST_30_DAYS");

    var rows = campaignReport.rows();
    while (rows.hasNext()) {
      var row = rows.next();
      campaignIds.push(row['CampaignId']);
    }
  }

  if (campaignIds.length == 0) {
    throw ("No campaigns found with the given settings.");
  }

  Logger.log(campaignIds.length + " campaigns found");
  return campaignIds;
}
