// ID: 7059dfb2a845da47d061250d506a0491
/**
*
* Duplicate Query Checker
*
* Creates a report detailing which searches are triggering multiple ad groups. 
*
* Version: 1.0
* Google AdWords Script maintained on brainlabsdigital.com
*
*/

//////////////////////////////////////////////////////////////////////////////
// Options

var spreadsheetUrl = "https://docs.google.com/YOUR-SPREADSHEET-URL-HERE";
// The URL of the Google Doc the results will be put into.

var impressionThreshold = 0;
// Only queries with more than this number of impressions will be looked at.
// Set as 0 to look at all available queries.

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

var ignorePausedCampaigns = true;
// Set this to true to only look at currently active campaigns.
// Set to false to also include campaigns that are currently paused.


//////////////////////////////////////////////////////////////////////////////
function main() {
  var writeSpreadsheet = checkSpreadsheet(spreadsheetUrl, "the spreadsheet");
  var writeSheet = writeSpreadsheet.getSheets()[0];
  
  var campaignIds = getCampaignIds(ignorePausedCampaigns, campaignNameDoesNotContain, campaignNameContains); 
  var queries = getQueries(campaignIds); 
  writeReport(queries, writeSheet);
}


// Check the spreadsheet URL has been entered, and that it works
function checkSpreadsheet(spreadsheetUrl, spreadsheetName) {
  if (spreadsheetUrl.replace(/[AEIOU]/g,"X") == "https://docs.google.com/YXXR-SPRXXDSHXXT-XRL-HXRX") {
    throw("Problem with " + spreadsheetName + " URL: make sure you've replaced the default with a valid spreadsheet URL.");
  }
  try {
    var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
    
    // Checks if you can edit the spreadsheet
    var sheet = spreadsheet.getSheets()[0];
    var sheetName = sheet.getName();
    sheet.setName(sheetName);
    
    return spreadsheet;
  } catch (e) {
    throw("Problem with " + spreadsheetName + " URL: '" + e + "'");
  }
}


// Get the IDs of campaigns which match the given options
function getCampaignIds(ignorePausedCampaigns, campaignNameDoesNotContain, campaignNameContains) {
  var whereStatement = "WHERE ";
  var whereStatementsArray = [];
  var campaignIds = [];
  
  if (ignorePausedCampaigns) {
    whereStatement += "CampaignStatus = ENABLED ";
  } else {
    whereStatement += "CampaignStatus IN ['ENABLED','PAUSED'] ";
  }
  
  for (var i=0; i<campaignNameDoesNotContain.length; i++) {
    whereStatement += "AND CampaignName DOES_NOT_CONTAIN_IGNORE_CASE '" + campaignNameDoesNotContain[i].replace(/"/g,'\\\"') + "' ";
  }
  
  if (campaignNameContains.length == 0) {
    whereStatementsArray = [whereStatement];
  } else {
    for (var i=0; i<campaignNameContains.length; i++) {
      whereStatementsArray.push(whereStatement + 'AND CampaignName CONTAINS_IGNORE_CASE "' + campaignNameContains[i].replace(/"/g,'\\\"') + '" ');
    }
  }
  
  for (var i=0; i<whereStatementsArray.length; i++) {
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
    throw("No campaigns found with the given settings.");
  }
  
  Logger.log(campaignIds.length + " campaigns found");
  return campaignIds;
}


/* 
Downloads a searh query performance report
Stores data in an array. 
Returns that array. 

Builds array of Adgroups indexed by Query. 
Structure:
Queries => [adGroups, CampaignId, ...], ...]
*/ 
function getQueries(campaignIds){
  var queries = {};
  
  var report = AdWordsApp.report(
    "SELECT Query, CampaignId, CampaignName, AdGroupId, AdGroupName, KeywordTextMatchingQuery, Impressions, Clicks, Cost, Conversions" +
    " FROM SEARCH_QUERY_PERFORMANCE_REPORT " +
    " WHERE " +
    " CampaignId IN [" + campaignIds.join(",") + "]" +
    " AND Impressions > " + impressionThreshold + " " +
    " DURING LAST_30_DAYS");  
  var rows = report.rows();
  
  while (rows.hasNext()) {
    var row = rows.next();
    if (row['KeywordTextMatchingQuery'].indexOf("==") > -1){ //The 'keyword' is a product in a Shopping campaign
     continue; 
    }
    var metrics = [row['AdGroupId'], row['AdGroupName'], row['CampaignId'], row['CampaignName'], row['KeywordTextMatchingQuery'], row['Impressions'], row['Clicks'], row['Cost'], row['Conversions']]
    if (typeof queries[row['Query']] == 'undefined'){
      queries[row['Query']] = [metrics];
    }else{
      queries[row['Query']].push(metrics);
    }
  }
  
  for (var property in queries){
    if (queries[property].length ==1){
      delete queries[property];
    }
  }
  Logger.log(Object.keys(queries).length +  ' Search Queries appear in two or more Ad Groups.');
  return queries;
}

/*
Goes through object writting each line to a sheet.
Search Terms are ordered by total impressions.
*/
function writeReport(queries, writeSheet){
  writeSheet.clear();

  var queryTotalImpressions = {};
  for (var query in queries){
    var impressions = 0;
    var metrics = queries[query];
    for (var j=0; j<metrics.length; j++){
      impressions += parseInt(metrics[j][5].replace(/,/g,""),10);
    }
    queryTotalImpressions[query] = impressions;
  }
  var orderedQueries = Object.keys(queries).sort(function (a, b) {return queryTotalImpressions[b] - queryTotalImpressions[a];});
  
  writeSheet.getRange(1, 1, 1, 10).setValues([["Search Term", "AdGroup Id", "AdGroup Name", "Campaign Id", "Campaign Name", "Triggered Keyword", "Impressions", "Clicks", "Cost", "Conversions"]]); 
  
  var vertical = 2;
  var sizes = [];
  for (var i in orderedQueries){
    sizes.push(queries[orderedQueries[i]].length);
  }
  for (var i in orderedQueries){
    var entry = orderedQueries[i];
    var currentArrays = queries[entry];
    var size = sizes[i];
    writeSheet.getRange(vertical, 1).setValue(entry);
    writeSheet.getRange(vertical, 2, size, 9).setValues(currentArrays);
    vertical += size ;
  } 
  Logger.log('The data has been written to the sheet specified by URL provided');
}
