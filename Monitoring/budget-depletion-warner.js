// ID: 0ca8ebe550fed23cf4fabbb6e2926d6a
function main() {
  var CAMPAIGN_NAME_CONTAINS = [];
  // Use this if you only want to look at some campaigns.
  // For example ["Generic"] would only look at campaigns with 'generic' in the name,
  // while ["Generic", "Competitor"] would only look at campaigns with either
  // 'generic' or 'competitor' in the name.
  // Leave as [] to include all campaigns.

  var CAMPAIGN_NAME_EXCLUDES = [];
  // Use this if you want to exclude some campaigns.
  // For example ["Brand"] would ignore any campaigns with 'brand' in the name,
  // while ["Brand", "Key Terms"] would ignore any campaigns with 'brand' or
  // 'key terms' in the name.
  // Leave as [] to not exclude any campaigns.

  var WARNING_PERCENTAGE_CAP = -1;
  // The percentage of a campaign's budget that needs to have been spent for
  // the tool to consider that campaign over cap and warn about it.

  var EMAILS = [''];
  // The email address you want the hourly update to be sent to.
  // If you'd like to send to multiple addresses then have them separated by commas,
  // for example ["aa@example.com", "bb@example.com"]

  try {
    var campaigns = getCampaigns(CAMPAIGN_NAME_CONTAINS, CAMPAIGN_NAME_EXCLUDES);
    var overCap = getOverCap(WARNING_PERCENTAGE_CAP, campaigns);
    alert(overCap, EMAILS);
  } catch (e) {
    alertError(e, EMAILS);
  }
}

function getCampaigns(campNameContains, campNameExcludes) {
  var campaigns = {};
  var whereStatementsArray = buildWhereStatements(campNameContains, campNameExcludes);
  for (var i = 0; i < whereStatementsArray.length; i++) {
    var query = "SELECT CampaignId, Date, Cost, Amount, CampaignName" +
      " FROM CAMPAIGN_PERFORMANCE_REPORT " +
      whereStatementsArray[i] +
      "DURING TODAY";
    var rows = AdWordsApp.report(query).rows();
    while (rows.hasNext()) {
      var campaign = campaignFromRow(rows.next());
      campaigns[campaign.id] = campaign;
    }
  }
  return campaigns;
}

function buildWhereStatements(campNameContains, campNameExcludes) {
  var whereStatement = "WHERE CampaignStatus IN ['ENABLED','PAUSED'] ";
  for (var i = 0; i < campNameExcludes.length; i++) {
    whereStatement += "AND CampaignName DOES_NOT_CONTAIN_IGNORE_CASE '"
      + campNameExcludes[i].replace(/"/g, '\\\"') + "' ";
  }
  var whereStatementsArray = [];
  if (campNameContains.length == 0) {
    whereStatementsArray = [whereStatement];
  } else {
    for (var i = 0; i < campNameContains.length; i++) {
      whereStatementsArray.push(whereStatement + 'AND CampaignName CONTAINS_IGNORE_CASE "'
        + campNameContains[i].replace(/"/g, '\\\"') + '" ');
    }
  }
  return whereStatementsArray;
}

function campaignFromRow(reportRow) {
  var obj = {};
  obj.id = reportRow["CampaignId"];
  obj.name = reportRow["CampaignName"];
  obj.budget = reportRow["Amount"];
  obj.spend = reportRow["Cost"];
  obj.spent = function () {
    return 100 * (1 - (obj.budget - obj.spend) / obj.budget);
  }
  obj.overSpendCap = function (cap) {
    return (obj.spent() > cap);
  }
  return obj;
}

function getOverCap(cap, campaigns) {
  var overCap = [];
  for (var campaignId in campaigns) {
    var campaign = campaigns[campaignId];
    if (campaign.overSpendCap(cap)) {
      overCap.push(campaign);
    }
  }
  return overCap;
}

function alert(campaigns, EMAILS) {
  var subject = AdWordsApp.currentAccount().getName() + " - Budgets Nearly Spent";
  var message = buildTable(campaigns);

  MailApp.sendEmail({
    to: EMAILS.join(','),
    subject: subject,
    htmlBody: message
  });
}

function buildTable(campaigns) {
  var table = "<table border=1 style='border: 1px solid black; border-collapse: collapse;'>";
  table += "<tr><th>Campaign ID</th><th>Campaign Name</th><th>Budget</th><th>Percent of Budget Spent</th></tr>";
  for (var campaignId in campaigns) {
    var campaign = campaigns[campaignId];
    table += "<tr><td>" + campaign.id + "</td>";
    table += "<td>" + campaign.name + "</td>";
    table += "<td>" + campaign.budget + "</td>";
    table += "<td>" + campaign.spent().toFixed(2) + "</td>";
    table += "</tr>";
  }
  table += "</table>";
  return table;
}

function alertError(error, emails) {
  MailApp.sendEmail(
    emails.join(','),
    'Budget Script - Error',
    error);
}
