// ID: 63aae9b1d305a9c84d358f813de0f675
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
//Options

// Use this if you want to exclude some campaigns. Case insensitive.
// For example ["Brand"] would ignore any campaigns with 'brand' in the name,
// while ["Brand","Competitor"] would ignore any campaigns with 'brand' or
// 'competitor' in the name.
// Leave as [] to not exclude any campaigns.
var campaignNameDoesNotContain = [];

// Use this if you only want to look at some campaigns.  Case insensitive.
// For example ["Brand"] would only look at campaigns with 'brand' in the name,
// while ["Brand","Generic"] would only look at campaigns with 'brand' or 'generic'
// in the name.
// Leave as [] to include all campaigns.
var campaignNameContains = [""];

//Choose whether the negatives are created, or if you just get an email to review
var makeChanges = false;

// These addresses will be emailed when the tool is run, eg "daniel@example.com"
// If there are multiple addresses then separate them with commas, eg "a@a.com, b@b.com"
// Leave as "" to not send any emails
var emailAddresses = "";

// The tool will only compare keywords with search queries
// that have received over this many impressions.
var impressionsThreshold = 0;

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

function main() {
  var campaignIds = getCampaignIds();

  var queries = getSearchQueries(campaignIds);
  var keywords = getKeywords(campaignIds);

  Logger.log("Computing negatives to add");
  var newNegatives = [];
  for (var i = 0; i < campaignIds.length; i++) {
    var campaignId = campaignIds[i];
    var campaignNewNegatives = computeCampaignNegatives(queries[campaignId], keywords[campaignId]);
    newNegatives = newNegatives.concat(campaignNewNegatives);
  }

  sortByEntities(newNegatives);

  if (makeChanges) {
    addNewNegatives(newNegatives);
  }
  notify(newNegatives);
}

function getCampaignIds() {
  var whereStatement = "";
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
    var campaignReport = AdsApp.report(
      "SELECT CampaignId " +
      "FROM   CAMPAIGN_PERFORMANCE_REPORT " +
      "WHERE  CampaignStatus = ENABLED " +
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

  Logger.log(campaignIds.length + " campaigns were found.");
  return campaignIds;
}

function getSearchQueries(campaignIds) {
  var report = AdsApp.report(
    "SELECT Query, AdGroupId, CampaignId, AdGroupName, CampaignName " +
    "FROM SEARCH_QUERY_PERFORMANCE_REPORT " +
    "WHERE CampaignId IN [" + campaignIds.join(",") + "] " +
    "AND AdGroupStatus = 'ENABLED' " +
    "AND Impressions >= " + impressionsThreshold + " " +
    "DURING LAST_30_DAYS");

  var queries = {};
  for (var i = 0; i < campaignIds.length; i++) {
    queries[campaignIds[i]] = [];
  }

  var rows = report.rows();
  while (rows.hasNext()) {
    var row = rows.next();
    var query = {};
    query.query = row["Query"];
    query.adgroupId = row["AdGroupId"];
    query.campaignId = row["CampaignId"];
    query.adgroupName = row["AdGroupName"];
    query.campaignName = row["CampaignName"];
    queries[query.campaignId].push(query);
  }
  return queries;
}

function getKeywords(campaignIds) {
  var report = AdsApp.report(
    "SELECT AdGroupId, Id, CampaignId, Criteria " +
    "FROM KEYWORDS_PERFORMANCE_REPORT " +
    "WHERE CampaignId IN [" + campaignIds.join(",") + "] " +
    "AND Status = 'ENABLED' " +
    "AND KeywordMatchType IN [BROAD, PHRASE] " +
    "DURING LAST_30_DAYS");

  var keywords = {};
  for (var i = 0; i < campaignIds.length; i++) {
    keywords[campaignIds[i]] = [];
  }

  var rows = report.rows();
  while (rows.hasNext()) {
    var row = rows.next();
    var keyword = {};
    keyword.id = row["Id"];
    keyword.adgroupId = row["AdGroupId"];
    keyword.campaignId = row["CampaignId"];
    keyword.criteria = cleanKeywordText(row["Criteria"]);

    if (typeof keywords[keyword.campaignId][keyword.adgroupId] == 'undefined') {
      keywords[keyword.campaignId][keyword.adgroupId] = [];
    }

    keywords[keyword.campaignId][keyword.adgroupId].push(keyword);
  }
  return keywords;
}

function cleanKeywordText(rawText) {
  return rawText.toLowerCase().replace(/\+/g, "");
}

function computeCampaignNegatives(queries, keywords) {
  var newNegatives = [];
  var adgroupIds = Object.keys(keywords);

  for (var i = 0; i < adgroupIds.length; i++) {
    var adgroupId = adgroupIds[i];
    var adgroupKeywords = keywords[adgroupId];
    for (var j = 0; j < adgroupKeywords.length; j++) {
      var keyword = adgroupKeywords[j];
      for (var k = 0; k < queries.length; k++) {
        var query = queries[k];
        var queryAdgroupKeywords = keywords[query.adgroupId];
        if (wantToAddNegative(query, keyword, queryAdgroupKeywords)) {
          var newNegative = {};
          newNegative.campaignId = keyword.campaignId;
          newNegative.adgroupId = query.adgroupId;
          newNegative.adgroupName = query.adgroupName;
          newNegative.campaignName = query.campaignName;
          newNegative.text = keyword.criteria;
          newNegatives.push(newNegative);
        }
      }
    }
  }
  return newNegatives;
}

function wantToAddNegative(query, keyword, queryAdgroupKeywords) {
  if (typeof queryAdgroupKeywords == 'undefined') {
    return false;
  }
  if (query.adgroupId == keyword.adgroupId) {
    return false;
  }
  if (textSimilar(query.query, keyword.criteria)) {
    return !queryKeywordsContainKeyword(queryAdgroupKeywords, keyword.criteria);
  }
}

function textSimilar(base, compare) {
  base = " " + base + " ";
  compare = " " + compare + " ";
  return (base.indexOf(compare) > -1);
}

function queryKeywordsContainKeyword(keywords, potentialNegative) {
  for (var i = 0; i < keywords.length; i++) {
    if (textSimilar(keywords[i].criteria, potentialNegative)) {
      return true;
    }
  }
  return false;
}

function sortByEntities(newNegatives) {
  newNegatives.sort(function (a, b) {
    return a.campaignId - b.campaignId || a.adgroupId - b.adgroupId;
  });
}

function addNewNegatives(newNegatives) {
  Logger.log("Adding new negatives");
  var chunks = chunkNewNegatives(newNegatives);
  for (var i = 0; i < chunks.length; i++) {
    var chunk = chunks[i];
    var adgroups = AdsApp.adGroups().withIds(Object.keys(chunk)).get();
    while (adgroups.hasNext()) {
      var adgroup = adgroups.next();
      var adgroupId = adgroup.getId();
      var negativesToAdd = chunk[adgroupId];
      for (var i = 0; i < negativesToAdd.length; i++) {
        var newNegative = negativesToAdd[i];
        adgroup.createNegativeKeyword("\"" + newNegative.text + "\"");
      }
    }
  }
}

function chunkNewNegatives(newNegatives) {
  var chunks = [];
  var chunk = {};
  for (var i = 0; i < newNegatives.length; i++) {
    var negative = newNegatives[i];
    var adgroupId = negative.adgroupId;
    if (typeof chunk[adgroupId] == 'undefined') {
      chunk[adgroupId] = [];
    }
    chunk[adgroupId].push(negative);
    if (Object.keys(chunk).length > 9000) {
      chunks.push(chunk);
      chunk = {};
    }
  }
  chunks.push(chunk);
  return chunks;
}

function notify(newNegatives) {
  if (emailAddresses == "") {
    Logger.log("No email addresses given - not sending email.");
  } else if (newNegatives.length == 0) {
    Logger.log("No changes to email.");
  } else {

    var attachments = [];
    attachments.push(createResultsCsv(newNegatives, "Ad-Group-Negatives.csv"));

    if (!makeChanges || AdsApp.getExecutionInfo().isPreview()) {
      var verb = "would be";
    } else {
      var verb = "were";
    }
    var subject = AdsApp.currentAccount().getName() + " - Making Phrase Match Exact - " + Utilities.formatDate(new Date(), "GMT", "yyyy-MM-dd");
    var body = "Please find attached a list of the " + newNegatives.length + " negative keywords that " + verb + " added to your account.";

    var options = { attachments: attachments };
    MailApp.sendEmail(emailAddresses, subject, body, options);
  }
}

function createResultsCsv(newNegatives, csvName) {
  var cells = [];
  var headers = ["Campaign", "Ad Group", "Negative"];
  cells.push('"' + headers.join('","') + '"');
  for (var i = 0; i < newNegatives.length; i++) {
    var row = [];
    var newNegative = newNegatives[i];
    row.push(newNegative.campaignName.replace(/"/g, '""'));
    row.push(newNegative.adgroupName.replace(/"/g, '""'));
    row.push(newNegative.text.replace(/"/g, '""'));
    cells.push('"' + row.join('","') + '"');
  }
  return Utilities.newBlob("\ufeff" + cells.join("\n"), 'text/csv', csvName);
}
