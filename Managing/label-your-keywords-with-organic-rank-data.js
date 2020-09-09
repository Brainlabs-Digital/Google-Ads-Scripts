// ID: 7c8e0bdbc64db0a95e5ecd52f687ecfb
/**
*
* Label Your Keywords With Organic Rank Data
*
* This script takes ranking data from a spreadsheet and uses it to label exact
* match keywords, for manual data analysis.
*
* Version: 1.0
*
* Google AdWords Script maintained on brainlabsdigital.com
*
**/

function main() {

    var spreadsheetUrl = "https://docs.google.com/YOUR-SPREADSHEET-URL-HERE";
    // The URL of the spreadsheet containing your ranking data

    var campaignNameContains = "";
    // Use this if you want to only label keywords in particular campaigns.
    // For example setting it to "Generic" would mean only keywords in campaigns
    // with ‘Generic’ in the name would be labelled.
    // Leave as "" if unwanted.

    var campaignNameDoesNotContain = "";
    // Use this if you want to ignore particular campaigns.
    // For example setting it to "Brand" then keywords in any campaigns with
    // ‘brand’ in the name would not be labelled.
    // Leave as "" if unwanted.

    var includePaused = false;
    // Set to true to include paused campaigns, ad groups and keywords
    // Set to false to ignore them and only label what is currently enabled.

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // Read the spreadsheet
    try {
        var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
    } catch (e) {
        Logger.log("Problem with the spreadsheet URL: ‘" + e + "‘");
        Logger.log("Make sure you have correctly copied in your own spreadsheet URL.");
        return;
    }
    var sheet = spreadsheet.getSheets()[0];
    var spreadsheetData = sheet.getDataRange().getValues();

    var keywordTextArray = [];
    var keywordLabels = {};
    var sites = [];
    var neededLabels = [];

    for (var i = 1; i < spreadsheetData[0].length; i++) {
        var siteName = spreadsheetData[0][i].trim();
        if (siteName != "") {
            sites.push(siteName);
        }
    }

    for (var i = 1; i < spreadsheetData.length; i++) {
        var keyword = spreadsheetData[i][0].trim().toLowerCase();

        if (keyword == "") {
            continue;
        }

        keywordTextArray.push(keyword);
        keywordLabels[keyword] = [];

        for (var j = 0; j < sites.length; j++) {
            var position = parseInt(spreadsheetData[i][j + 1], 10);

            if (isNaN(position) || position < 1 || position > 9) {
                var labelText = sites[j] + " – Off First Page";
            } else {
                var labelText = sites[j] + " – " + position;
            }

            keywordLabels[keyword].push(labelText);
            if (neededLabels.indexOf(labelText) < 0) {
                neededLabels.push(labelText);
            }
        }
    }

    Logger.log(keywordTextArray.length + " keywords found in spreadsheet.");

    var existingLabels = {};
    var labelIds = {};
    var labelIter = AdWordsApp.labels().get();

    while (labelIter.hasNext()) {
        var label = labelIter.next();
        existingLabels[label.getName()] = label;
    }

    // Remove existing position labels, to get rid of any outdated ones
    for (var i = 0; i < sites.length; i++) {
        for (var j = 0; j < 10; j++) {
            labelText = sites[i] + " – " + j;
            if (existingLabels[labelText] != undefined) {
                existingLabels[labelText].remove();
            }
        }
        labelText = sites[i] + " – Off First Page";
        if (existingLabels[labelText] != undefined) {
            existingLabels[labelText].remove();
        }
    }

    // Create the necessary labels
    for (var i = 0; i < neededLabels.length; i++) {
        AdWordsApp.createLabel(neededLabels[i]);
    }

    // Make the iterator to get the keywords
    var keywordIter = AdWordsApp.keywords()
        .withCondition("Criteria IN[‘" + keywordTextArray.join("‘, '") + "‘]")
        .withCondition("KeywordMatchType = EXACT");

    if (campaignNameContains != "") {
        keywordIter = keywordIter.withCondition("CampaignName CONTAINS_IGNORE_CASE ‘" + campaignNameContains + "‘");
    }
    if (campaignNameDoesNotContain != "") {
        keywordIter = keywordIter.withCondition("CampaignName DOES_NOT_CONTAIN_IGNORE_CASE ‘" + campaignNameDoesNotContain + "‘");
    }

    if (includePaused) {
        keywordIter = keywordIter.withCondition("CampaignStatus IN[ENABLED, PAUSED]")
            .withCondition("AdGroupStatus IN[ENABLED, PAUSED]")
            .withCondition("Status IN[ENABLED, PAUSED]");
    } else {
        keywordIter = keywordIter.withCondition("CampaignStatus IN[ENABLED]")
            .withCondition("AdGroupStatus IN[ENABLED]")
            .withCondition("Status IN[ENABLED]");
    }

    keywordIter = keywordIter.get();

    // Apply the labels
    while (keywordIter.hasNext()) {
        var keyword = keywordIter.next();
        var keywordText = keyword.getText().replace("[", "").replace("]", "").trim().toLowerCase();

        if (keywordLabels[keywordText] == undefined) {
            Logger.log(keywordText + " not found");
            continue;
        }

        for (var i = 0; i < keywordLabels[keywordText].length; i++) {
            var labelText = keywordLabels[keywordText][i];
            keyword.applyLabel(keywordLabels[keywordText][i]);
        }
    }

}
