// ID: 5c4ab76097d8fd1851cda12252192ba0
/**
*
* Account Structure Checker
*
* This script will check your account for any missing keyword match types
* are output a report with the missing keywords
*
* Version: 1.0
* Google AdWords Script maintained on brainlabsdigital.com
* 
**/

/////////////////////////////////////////////////////////////////////////////
// Options

var campaignNameContains = [""];
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

var checkPausedCampaigns = true;
// Set true if you want to include paused campaigns.
// Set false if you want to check enabled campaigns only.

var keywordMatchTypes = ["Exact", "Phrase", "BMM", "Broad"]
// Change this if you only use certain keyword types. For example, in an account
// with only exact and broad match modifier keywords, set this to ["Exact", "BMM"].

var spreadsheetUrl = "";
// The URL of the Google Sheet the results will be put into
 
/////////////////////////////////////////////////////////////////////////////
// Functions

function main() {
  var keywords = {};
  var issues = [];
  
//Check if we need to look at paused campaigns
  var campaignStatus = ['ENABLED'];
  if (checkPausedCampaigns) {
    campaignStatus.push('PAUSED');
  }
  
  //Build report query from filters
  var whereStatement = 'WHERE CampaignStatus IN ['+ campaignStatus+'] ';
  for (var i=0; i < campaignNameDoesNotContain.length; i++) {
    whereStatement += " AND CampaignName DOES_NOT_CONTAIN_IGNORE_CASE '" +
      campaignNameDoesNotContain[i].replace(/"/g,'\\\"') + "' ";
  }
  var whereStatementsArray = [];
  if (campaignNameContains.length == 0) {
    var whereStatementsArray = [whereStatement];
  } else {
    for (var i = 0; i < campaignNameContains.length; i++) {
      whereStatementsArray.push(
        whereStatement +
        'AND CampaignName CONTAINS_IGNORE_CASE "' +
        campaignNameContains[i].replace(/"/g,'\\\"') + '" '
        );
    }
  }
  
  //Get Keyword report
  for (var i = 0; i < whereStatementsArray.length; i++) {
    var report = AdWordsApp.report(
      'SELECT Criteria, KeywordMatchType ' +
      'FROM KEYWORDS_PERFORMANCE_REPORT ' +
      whereStatementsArray[i] + " " +
      "DURING TODAY");
      
    var rows = report.rows();
    while (rows.hasNext()) {
      var row = rows.next();
      var criteria = row['Criteria'];
      var keywordMatchType = row['KeywordMatchType'];

      if (criteria.indexOf('+') != -1 && keywordMatchType == "Broad") {
        keywordMatchType = "BMM";
        criteria = criteria.replace(/\+/g, '');
      }

      if (!(criteria in keywords)) {
        keywords[criteria] = {};
      }
      keywords[criteria][keywordMatchType] = row;
    }
  }

  //Find any missing match type issues
  for (var i in keywords) {
    var keywordSet = keywords[i];
    var keywordIssues = [i, []];

    for (var j in keywordMatchTypes) {
      var matchType = keywordMatchTypes[j];
      if (!(matchType in keywordSet)) {
        keywordIssues[1].push(matchType);
      }
    }

    if (keywordIssues[1].length > 0) {
        issues.push(keywordIssues);
    }
  }

  //Open and populate spreadsheet with missing match types
  var SS = SpreadsheetApp.openByUrl(spreadsheetUrl);
  var sheetName = "Keyword Structure Report";
  var sheet = SS.getSheetByName(sheetName)
  if (!sheet) {
    sheet = SS.insertSheet(sheetName);
  }
  sheet.clear();
  var headers = ["Keyword", "Missing Match Types"];
    for (var k in issues) {
      issues[k][1] = issues[k][1].join(', ');
    }
  issues.unshift(headers); 
  
  sheet.getRange(1,1,issues.length, issues[0].length)
    .setValues(issues)
    .setFontFamily('Roboto')
    .setBorder(true, true, true, true, true, false);

  sheet.getRange(1,1,1,headers.length)
    .setFontColor('white')
    .setFontSize(12)
    .setBackground("#3c78d8");   

  sheet.setHiddenGridlines(true);            
}
