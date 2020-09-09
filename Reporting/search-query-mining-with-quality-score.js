// ID: b6b6d806968d0e706ed1518275212eb1
/**
 *
 * Search Query Mining With Quality Score Tool
 *
 * This script calculates the contribution of each word or phrase found in the
 * search query report and outputs a report into a Google Doc spreadsheet.
 *
 * Version: 1.0
 * Google AdWords Script maintained on brainlabsdigital.com
 *
 **/
function main() {
    //////////////////////////////////////////////////////////////////////////////
    // Options

    var startDate = "2018-07-01";
    var endDate = "2018-07-30";
    // The start and end date of the date range for your search query data
    // Format is yyyy-mm-dd

    var currencySymbol = "£";
    // The currency symbol used for formatting. For example "£", "$" or "€".

    var campaignNameContains = "";
    // Use this if you only want to look at some campaigns
    // such as campaigns with names containing 'Brand' or 'Shopping'.
    // Leave as "" if not wanted.

    var campaignNameDoesNotContain = "";
    // Use this if you want to exclude some campaigns
    // such as campaigns with names containing 'Brand' or 'Shopping'.
    // Leave as "" if not wanted.

    var ignorePausedCampaigns = true;
    // Set this to true to only look at currently active campaigns.
    // Set to false to include campaigns that had impressions but are currently paused.

    var ignorePausedAdGroups = true;
    // Set this to true to only look at currently active ad groups.
    // Set to false to include ad groups that had impressions but are currently paused.

    var checkNegatives = true;
    // Set this to true to remove queries that would be excluded by your negative keywords.

    var spreadsheetUrl = "https://docs.google.com/YOUR-SPREADSHEET-URL-HERE";
    // The URL of the Google Doc the results will be put into.

    var minNGramLength = 1;
    var maxNGramLength = 2;
    // The word length of phrases to be checked.
    // For example if minNGramLength is 1 and maxNGramLength is 3,
    // phrases made of 1, 2 and 3 words will be checked.
    // Change both min and max to 1 to just look at single words.

    var clearSpreadsheet = true;

    //////////////////////////////////////////////////////////////////////////////
    // Thresholds
    var queryCountThreshold = 0;
    var impressionThreshold = 10;
    var clickThreshold = 0;
    // Words will be ignored if their statistics are lower than any of these thresholds


    //  This is what you'll see if Adwords doesn't report a quality score.
    var DEFAULT_QUALITY_SCORE = "-";


    //////////////////////////////////////////////////////////////////////////////
    // Check the spreadsheet has been entered, and that it works
    if (spreadsheetUrl.replace(/[AEIOU]/g, "X") == "https://docs.google.com/YXXR-SPRXXDSHXXT-XRL-HXRX") {
        Logger.log("Problem with the spreadsheet URL: make sure you've replaced the default with a valid spreadsheet URL.");
        return;
    }
    try {
        var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
    } catch (e) {
        Logger.log("Problem with the spreadsheet URL: '" + e + "'");
        return;
    }

    // Get the IDs of the campaigns to look at
    var dateRange = startDate.replace(/-/g, "") + "," + endDate.replace(/-/g, "");
    var activeCampaignIds = [];
    var whereStatements = "";

    if (campaignNameDoesNotContain != "") {
        whereStatements += "AND CampaignName DOES_NOT_CONTAIN_IGNORE_CASE '" + campaignNameDoesNotContain + "' ";
    }
    if (ignorePausedCampaigns) {
        whereStatements += "AND CampaignStatus = ENABLED ";
    } else {
        whereStatements += "AND CampaignStatus IN ['ENABLED','PAUSED'] ";
    }

    var campaignReport = AdWordsApp.report(
        "SELECT CampaignName, CampaignId " +
        "FROM   CAMPAIGN_PERFORMANCE_REPORT " +
        "WHERE CampaignName CONTAINS_IGNORE_CASE '" + campaignNameContains + "' " +
        "AND Impressions > 0 " + whereStatements +
        "DURING " + dateRange
    );
    var campaignRows = campaignReport.rows();
    while (campaignRows.hasNext()) {
        var campaignRow = campaignRows.next();
        activeCampaignIds.push(campaignRow["CampaignId"]);
    }

    if (activeCampaignIds.length == 0) {
        Logger.log("Could not find any campaigns with impressions and the specified options.");
        return;
    }

    var whereAdGroupStatus = "AND AdGroupStatus IN ['ENABLED','PAUSED'] ";
    if (ignorePausedAdGroups) {
        whereAdGroupStatus = "AND AdGroupStatus = ENABLED ";
    }

    //////////////////////////////////////////////////////////////////////////////
    // Find the negative keywords
    var negativesByGroup = {};
    var negativesByCampaign = {};
    var sharedSetNames = {};
    var sharedSetCampaigns = {};

    if (checkNegatives) {
        // Gather ad group level negative keywords
        var keywordReport = AdWordsApp.report(
            "SELECT CampaignId, AdGroupId, Criteria, KeywordMatchType " +
            "FROM   KEYWORDS_PERFORMANCE_REPORT " +
            "WHERE Status = ENABLED AND IsNegative = TRUE " + whereAdGroupStatus +
            "AND CampaignId IN [" + activeCampaignIds.join(",") + "] " +
            "DURING " + dateRange
        );

        var keywordRows = keywordReport.rows();
        while (keywordRows.hasNext()) {
            var keywordRow = keywordRows.next();
            if (negativesByGroup[keywordRow["AdGroupId"]] == undefined) {
                negativesByGroup[keywordRow["AdGroupId"]] = {};
            }
            var keywordAdGroup = keywordRow["Criteria"].toLowerCase();
            var matchType = keywordRow["KeywordMatchType"].toLowerCase();

            if (!(matchType in negativesByGroup[keywordRow["AdGroupId"]])) {
                negativesByGroup[keywordRow["AdGroupId"]][matchType] = [];
            }
            negativesByGroup[keywordRow["AdGroupId"]][matchType].push(keywordAdGroup);
        }

        // Gather campaign level negative keywords
        var campaignNegReport = AdWordsApp.report(
            "SELECT CampaignId, Criteria, KeywordMatchType " +
            "FROM   CAMPAIGN_NEGATIVE_KEYWORDS_PERFORMANCE_REPORT " +
            "WHERE  IsNegative = TRUE " +
            "AND CampaignId IN [" + activeCampaignIds.join(",") + "]"
        );
        var campaignNegativeRows = campaignNegReport.rows();
        while (campaignNegativeRows.hasNext()) {
            var campaignNegativeRow = campaignNegativeRows.next();
            var campaignId = campaignNegativeRow["CampaignId"];
            var keywordCampaign = campaignNegativeRow["Criteria"].toLowerCase();
            var matchType = campaignNegativeRow["KeywordMatchType"].toLowerCase();

            if (negativesByCampaign[campaignNegativeRow["CampaignId"]] == undefined) {
                negativesByCampaign[campaignNegativeRow["CampaignId"]] = {};
            }
            if (!(matchType in negativesByCampaign[campaignId])) {
                negativesByCampaign[campaignId][matchType] = [];
            }
            negativesByCampaign[campaignId][matchType].push(keywordCampaign);
        }

        // Find which campaigns use shared negative keyword sets
        var campaignSharedReport = AdWordsApp.report(
            "SELECT CampaignName, CampaignId, SharedSetName, SharedSetType, Status " +
            "FROM   CAMPAIGN_SHARED_SET_REPORT " +
            "WHERE SharedSetType = NEGATIVE_KEYWORDS " +
            "AND CampaignId IN [" + activeCampaignIds.join(",") + "]");
        var campaignSharedRows = campaignSharedReport.rows();
        while (campaignSharedRows.hasNext()) {
            var campaignSharedRow = campaignSharedRows.next();
            if (sharedSetCampaigns[campaignSharedRow["SharedSetName"]] == undefined) {
                sharedSetCampaigns[campaignSharedRow["SharedSetName"]] = [campaignSharedRow["CampaignId"]];
            } else {
                sharedSetCampaigns[campaignSharedRow["SharedSetName"]].push(campaignSharedRow["CampaignId"]);
            }
        }

        // Map the shared sets' IDs (used in the criteria report below)
        // to their names (used in the campaign report above)
        var sharedSetReport = AdWordsApp.report(
            "SELECT Name, SharedSetId, MemberCount, ReferenceCount, Type " +
            "FROM   SHARED_SET_REPORT " +
            "WHERE ReferenceCount > 0 AND Type = NEGATIVE_KEYWORDS ");
        var sharedSetRows = sharedSetReport.rows();
        while (sharedSetRows.hasNext()) {
            var sharedSetRow = sharedSetRows.next();
            sharedSetNames[sharedSetRow["SharedSetId"]] = sharedSetRow["Name"];
        }

        // Collect the negative keyword text from the sets,
        // and record it as a campaign level negative in the campaigns that use the set
        var sharedSetReport = AdWordsApp.report(
            "SELECT SharedSetId, KeywordMatchType, Criteria " +
            "FROM   SHARED_SET_CRITERIA_REPORT ");
        var sharedSetRows = sharedSetReport.rows();
        while (sharedSetRows.hasNext()) {
            var sharedSetRow = sharedSetRows.next();
            var setName = sharedSetNames[sharedSetRow["SharedSetId"]];
            if (sharedSetCampaigns[setName] !== undefined) {
                for (var i = 0; i < sharedSetCampaigns[setName].length; i++) {
                    var campaignId = sharedSetCampaigns[setName][i];
                    var matchTypeSharedSet = sharedSetRow["KeywordMatchType"].toLowerCase();

                    if (!negativesByCampaign.hasOwnProperty(campaignId)) {
                        negativesByCampaign[campaignId] = {};
                    }

                    if (!negativesByCampaign[campaignId].hasOwnProperty(matchTypeSharedSet)) {
                        negativesByCampaign[campaignId][matchTypeSharedSet] = [];
                    }
                    negativesByCampaign[campaignId][matchTypeSharedSet].push(sharedSetRow["KeywordMatchType"].toLowerCase());
                }
            }
        }

        Logger.log("Finished finding negative keywords");
    } // end if


    //////////////////////////////////////////////////////////////////////////////
    // Define the statistics to download or calculate, and their formatting

    var statColumns = ["Clicks", "Impressions"];

    calculatedStats = [{
        "stat": "CTR",
        "multiplier": "Clicks",
        "divisor": "Impressions"
    }];
    var currencyFormat = currencySymbol + "#,##0.00";
    var formatting = ["#,##0", "#,##0", "#,##0", "0.00%", "0.00"];


    //////////////////////////////////////////////////////////////////////////////
    // Go through the search query report, remove searches already excluded by negatives
    // record the performance of each word in each remaining query

    var queryReport = AdWordsApp.report(
        "SELECT CampaignName, CampaignId, AdGroupId, AdGroupName, Query, KeywordId, " + statColumns.join(", ") + " " +
        "FROM SEARCH_QUERY_PERFORMANCE_REPORT " +
        "WHERE CampaignId IN [" + activeCampaignIds.join(",") + "] " + whereAdGroupStatus + " " +
        "DURING " + dateRange + " "
    );

    var aggregateStatsByWordLength = {};
    var campaignNGrams = {};
    var adGroupNGrams = {};
    var totalNGrams = {};

    for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
        totalNGrams[n] = {};
    }

    var queryRows = queryReport.rows();
    while (queryRows.hasNext()) {
        var queryRow = queryRows.next();
        if (checkNegatives) {
            // Checks if the query is excluded by an ad group level negative
            var searchIsExcluded = false;
            var adGroupId = queryRow["AdGroupId"];
            var currentQuery = queryRow["Query"];
            var campaignId = queryRow["CampaignId"];

            if (adGroupId in negativesByGroup) {
                searchIsExcluded = isSearchExcluded(adGroupId, currentQuery, negativesByGroup);
            }
            // Checks if the query is excluded by a campaign level negative
            if (!searchIsExcluded && negativesByCampaign.hasOwnProperty(campaignId)) {
                searchIsExcluded = isSearchExcluded(campaignId, currentQuery, negativesByCampaign);
            }

            if (searchIsExcluded) {
                continue;
            }
        }

        var currentWords = queryRow["Query"].split(" ");

        if (campaignNGrams[queryRow["CampaignName"]] == undefined) {
            campaignNGrams[queryRow["CampaignName"]] = {};
            adGroupNGrams[queryRow["CampaignName"]] = {};


            for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
                campaignNGrams[queryRow["CampaignName"]][n] = {};
            }
        }

        if (adGroupNGrams[queryRow["CampaignName"]][queryRow["AdGroupName"]] == undefined) {
            adGroupNGrams[queryRow["CampaignName"]][queryRow["AdGroupName"]] = {};
            for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
                adGroupNGrams[queryRow["CampaignName"]][queryRow["AdGroupName"]][n] = {};
            }
        }

        var stats = [];
        for (var i = 0; i < statColumns.length; i++) {
            stats[i] = parseFloat(queryRow[statColumns[i]].replace(/,/g, ""));
        }

        var wordLength = currentWords.length;
        if (wordLength > 6) {
            wordLength = "7+";
        }
        if (aggregateStatsByWordLength[wordLength] == undefined) {
            aggregateStatsByWordLength[wordLength] = {};
        }
        for (var i = 0; i < statColumns.length; i++) {
            if (aggregateStatsByWordLength[wordLength].hasOwnProperty(statColumns[i])) {
                aggregateStatsByWordLength[wordLength][statColumns[i]] += stats[i];
            } else {
                aggregateStatsByWordLength[wordLength][statColumns[i]] = stats[i];
            }
        }

        // Splits the query into n-grams and records the stats for each
        for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
            if (n > currentWords.length) {
                break;
            }

            var doneNGrams = [];

            for (var w = 0; w < currentWords.length - n + 1; w++) {
                var currentNGram = '="' + currentWords.slice(w, w + n).join(" ") + '"';

                if (doneNGrams.indexOf(currentNGram) < 0) {

                    if (!campaignNGrams[queryRow["CampaignName"]][n].hasOwnProperty(currentNGram)) {
                        campaignNGrams[queryRow["CampaignName"]][n][currentNGram] = {};
                        campaignNGrams[queryRow["CampaignName"]][n][currentNGram]["Query Count"] = 0;
                    }
                    if (!adGroupNGrams[queryRow["CampaignName"]][queryRow["AdGroupName"]][n].hasOwnProperty(currentNGram)) {
                        adGroupNGrams[queryRow["CampaignName"]][queryRow["AdGroupName"]][n][currentNGram] = {};
                        adGroupNGrams[queryRow["CampaignName"]][queryRow["AdGroupName"]][n][currentNGram]["Query Count"] = 0;
                    }
                    if (!totalNGrams[n].hasOwnProperty(currentNGram)) {
                        totalNGrams[n][currentNGram] = {};
                        totalNGrams[n][currentNGram]["Query Count"] = 0;
                    }

                    campaignNGrams[queryRow["CampaignName"]][n][currentNGram]["Query Count"]++;
                    adGroupNGrams[queryRow["CampaignName"]][queryRow["AdGroupName"]][n][currentNGram]["Query Count"]++;
                    totalNGrams[n][currentNGram]["Query Count"]++;


                    for (var i = 0; i < statColumns.length; i++) {
                        accumulateStats(campaignNGrams[queryRow["CampaignName"]][n][currentNGram], statColumns[i], stats[i]);
                        accumulateStats(adGroupNGrams[queryRow["CampaignName"]][queryRow["AdGroupName"]][n][currentNGram], statColumns[i], stats[i]);
                        accumulateStats(totalNGrams[n][currentNGram], statColumns[i], stats[i]);
                    }
                    doneNGrams.push(currentNGram);
                }
            }
        }
    }

    Logger.log("Finished analysing queries.");
    var qualityScores = generateAverageQualityScore(minNGramLength, maxNGramLength, dateRange);
    Logger.log("Done generating Quality score");
    var qualityScoresCampaignLevel = qualityScores["campaignNGrams"];
    var qualityScoresAdGroupLevel = qualityScores["adGroupNGrams"];
    var qualityScoresTotal = qualityScores["totalNGrams"];
    var qualityScoresWordCount = qualityScores["wordCountNGrams"];
    var qualityScoresAdGroupLevelBroad = qualityScores["adGroupNGramsBroad"];
    var qualityScoresCampaignLevelBroad = qualityScores["campaignNGramsBroad"];
    var qualityScoresTotalBroad = qualityScores["totalNGramsBroad"];

    //////////////////////////////////////////////////////////////////////////////
    // Output the data into the spreadsheet

    var wordLengthOutput = [];
    var wordLengthFormat = [];
    var outputs = [];
    var formats = [];

    for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
        outputs[n] = {
            'campaign': [],
            'adgroup': [],
            "total": []
        };
        formats[n] = {
            'campaign': [],
            'adgroup': [],
            "total": []
        };
    }

    // Create headers
    var calcStatNames = [];
    for (var s = 0; s < calculatedStats.length; s++) {
        calcStatNames.push(calculatedStats[s]["stat"]);
    }
    var statNames = statColumns.concat(calcStatNames);
    statNames.push("Average Quality Score")
    for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
        // headers
        outputs[n]['campaign'].push(["Campaign", "Phrase", "Query Count"].concat(statNames));
        outputs[n]['adgroup'].push(["Campaign", "Ad Group", "Phrase", "Query Count"].concat(statNames));
        outputs[n]['total'].push(["Phrase", "Query Count"].concat(statNames));

    }
    wordLengthOutput.push(["Word count"].concat(statNames));

    var logCounter = 0;
    // Organise the ad group level stats into an array for output
    for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
        for (var campaign in adGroupNGrams) {
            for (var adGroup in adGroupNGrams[campaign]) {
                for (var nGram in adGroupNGrams[campaign][adGroup][n]) {

                    // skips nGrams under the thresholds
                    if (adGroupNGrams[campaign][adGroup][n][nGram]["Query Count"] < queryCountThreshold) {
                        continue;
                    }
                    if (adGroupNGrams[campaign][adGroup][n][nGram]["Impressions"] < impressionThreshold) {
                        continue;
                    }
                    if (adGroupNGrams[campaign][adGroup][n][nGram]["Clicks"] < clickThreshold) {
                        continue;
                    }

                    var printline = [campaign, adGroup, nGram, adGroupNGrams[campaign][adGroup][n][nGram]["Query Count"]];

                    for (var s = 0; s < statColumns.length; s++) {
                        printline.push(adGroupNGrams[campaign][adGroup][n][nGram][statColumns[s]]);
                    }
                    for (var s = 0; s < calculatedStats.length; s++) {
                        var multiplier = calculatedStats[s]["multiplier"];
                        var divisor = calculatedStats[s]["divisor"];
                        if (adGroupNGrams[campaign][adGroup][n][nGram][divisor] > 0) {
                            printline.push(adGroupNGrams[campaign][adGroup][n][nGram][multiplier] / adGroupNGrams[campaign][adGroup][n][nGram][divisor]);
                        } else {
                            printline.push("-");
                        }
                    }

                    // Add Quality Score
                    var qualityScoreResult = DEFAULT_QUALITY_SCORE;

                    try {
                        qualityScoreResult = qualityScoresAdGroupLevel[campaign][adGroup][n][nGram]["QualityScore"];
                        if (qualityScoreResult === undefined) {
                            throw new Error("undefined");
                        }
                    } catch (error) {
                        qualityScoreResult = DEFAULT_QUALITY_SCORE;
                    }

                    var broadCounter = 0;

                    try {
                        var allBroadKeywords = qualityScoresAdGroupLevelBroad[campaign][adGroup][n];
                        if (allBroadKeywords === undefined) {
                            throw new Error("undefined");
                        }

                        for (var k = 0; k < allBroadKeywords.length; ++k) {
                            var broadKeywords = allBroadKeywords[k][0];
                            var nGramSplit = nGram.replace(/"/g, "").replace("=", "").split(" ");
                            var nGramContainsAllOfBroadKW = true;
                            for (var word in nGramSplit) {
                                if (!broadKeywords.hasOwnProperty(nGramSplit[word])) {
                                    nGramContainsAllOfBroadKW = false;
                                }
                            }
                            if (nGramContainsAllOfBroadKW) {
                                broadCounter += 1;
                                if (qualityScoreResult == DEFAULT_QUALITY_SCORE) {
                                    qualityScoreResult = allBroadKeywords[k][1];

                                    continue;
                                }

                                qualityScoreResult += allBroadKeywords[k][1];
                            }
                        }
                    } catch (error) {

                    }

                    if (qualityScoreResult !== DEFAULT_QUALITY_SCORE) {
                        if (broadCounter === 1) {
                            broadCounter = 2;
                        }
                        if (broadCounter === 0) {
                            broadCounter = 1;
                        }
                        qualityScoreResult /= broadCounter;
                    }

                    printline.push(qualityScoreResult);
                    outputs[n]['adgroup'].push(printline);
                    formats[n]['adgroup'].push(["0", "0", "0"].concat(formatting));
                }
            }
        }
    }

    // Organise the campaign level stats into an array for output
    for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
        for (var campaign in campaignNGrams) {
            for (var nGram in campaignNGrams[campaign][n]) {

                // skips nGrams under the thresholds
                if (campaignNGrams[campaign][n][nGram]["Query Count"] < queryCountThreshold) {
                    continue;
                }
                if (campaignNGrams[campaign][n][nGram]["Impressions"] < impressionThreshold) {
                    continue;
                }
                if (campaignNGrams[campaign][n][nGram]["Clicks"] < clickThreshold) {
                    continue;
                }

                var printline = [campaign, nGram, campaignNGrams[campaign][n][nGram]["Query Count"]];

                for (var s = 0; s < statColumns.length; s++) {
                    printline.push(campaignNGrams[campaign][n][nGram][statColumns[s]]);
                }

                for (var s = 0; s < calculatedStats.length; s++) {
                    var multiplier = calculatedStats[s]["multiplier"];
                    var divisor = calculatedStats[s]["divisor"];
                    if (campaignNGrams[campaign][n][nGram][divisor] > 0) {
                        printline.push(campaignNGrams[campaign][n][nGram][multiplier] / campaignNGrams[campaign][n][nGram][divisor]);
                    } else {
                        printline.push("-");
                    }
                }

                // Add the quality score
                var qualityScoreResult = DEFAULT_QUALITY_SCORE;

                try {
                    qualityScoreResult = qualityScoresCampaignLevel[campaign][n][nGram]["QualityScore"];
                    if (qualityScoreResult === undefined) {
                        throw new Error("undefined");
                    }
                } catch (e) {
                    qualityScoreResult = DEFAULT_QUALITY_SCORE;
                }

                var broadCounter = 0;
                try {
                    var allBroadKeywords = qualityScoresCampaignLevelBroad[campaign][n];
                    if (allBroadKeywords === undefined) {
                        throw new Error("undefined");
                    }
                    for (var k = 0; k < allBroadKeywords.length; ++k) {
                        var broadKeywords = allBroadKeywords[k][0];
                        var nGramSplit = nGram.replace(/"/g, "").replace("=", "").split(" ");
                        var nGramContainsAllOfBroadKW = true;
                        for (var word in nGramSplit) {
                            if (!broadKeywords.hasOwnProperty(nGramSplit[word])) {
                                nGramContainsAllOfBroadKW = false;
                            }
                        }
                        if (nGramContainsAllOfBroadKW) {
                            broadCounter += 1;
                            if (qualityScoreResult == DEFAULT_QUALITY_SCORE) {
                                qualityScoreResult = allBroadKeywords[k][1];
                                continue;
                            }
                            qualityScoreResult += allBroadKeywords[k][1];
                        }
                    }
                } catch (error) { }

                if (qualityScoreResult !== DEFAULT_QUALITY_SCORE) {
                    if (broadCounter === 1) {
                        broadCounter = 2;
                    }
                    if (broadCounter === 0) {
                        broadCounter = 1;
                    }
                    qualityScoreResult /= broadCounter;
                }

                printline.push(qualityScoreResult);
                outputs[n]['campaign'].push(printline);
                formats[n]['campaign'].push(["0", "0"].concat(formatting));
            }
        }
    }

    // Organise the account level stats into an array for output
    for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
        for (var nGram in totalNGrams[n]) {
            // skips n-grams under the thresholds
            if (totalNGrams[n][nGram]["Query Count"] < queryCountThreshold) {
                continue;
            }
            if (totalNGrams[n][nGram]["Clicks"] < clickThreshold) {
                continue;
            }
            if (totalNGrams[n][nGram]["Impressions"] < impressionThreshold) {
                continue;
            }

            var printline = [nGram, totalNGrams[n][nGram]["Query Count"]];

            for (var s = 0; s < statColumns.length; s++) {
                printline.push(totalNGrams[n][nGram][statColumns[s]]);
            }

            for (var s = 0; s < calculatedStats.length; s++) {
                var multiplier = calculatedStats[s]["multiplier"];
                var divisor = calculatedStats[s]["divisor"];
                if (totalNGrams[n][nGram][divisor] > 0) {
                    printline.push(totalNGrams[n][nGram][multiplier] / totalNGrams[n][nGram][divisor]);
                } else {
                    printline.push("-");
                }
            }

            // Add the quality score
            var qualityScoreResult = DEFAULT_QUALITY_SCORE;
            if (qualityScoresTotal[n] != undefined &&
                qualityScoresTotal[n][nGram] != undefined
            ) {
                qualityScoreResult = qualityScoresTotal[n][nGram]["QualityScore"];
            }

            var broadCounter = 0;
            if (qualityScoresTotalBroad.hasOwnProperty(n)) {
                var allBroadKeywords = qualityScoresTotalBroad[n];
                for (var k = 0; k < allBroadKeywords.length; ++k) {
                    var broadKeywords = allBroadKeywords[k][0];
                    var nGramSplit = nGram.replace(/"/g, "").replace("=", "").split(" ");
                    var nGramContainsAllOfBroadKW = true;
                    for (var word in nGramSplit) {
                        if (!broadKeywords.hasOwnProperty(nGramSplit[word])) {
                            nGramContainsAllOfBroadKW = false;
                        }
                    }
                    if (nGramContainsAllOfBroadKW) {
                        broadCounter += 1;
                        if (qualityScoreResult == DEFAULT_QUALITY_SCORE) {
                            qualityScoreResult = allBroadKeywords[k][1];
                            continue;
                        }
                        qualityScoreResult += allBroadKeywords[k][1];
                    }
                }
            }

            if (qualityScoreResult !== DEFAULT_QUALITY_SCORE) {
                if (broadCounter === 1) {
                    broadCounter = 2;
                }
                if (broadCounter === 0) {
                    broadCounter = 1;
                }
                qualityScoreResult /= broadCounter;
            }

            printline.push(qualityScoreResult);
            outputs[n]['total'].push(printline);
            formats[n]['total'].push(["0"].concat(formatting));
        }
    }

    // Organise the word count analysis into an array for output
    for (var i = 1; i < 8; i++) {
        if (i < 7) {
            var wordLength = i;
        } else {
            var wordLength = "7+";
        }

        var printline = [wordLength];

        if (aggregateStatsByWordLength[wordLength] == undefined) {
            for (var s = 0; s < statColumns.length + 1; s++) {
                printline.push(0);
            }

        } else {
            for (var s = 0; s < statColumns.length; s++) {
                printline.push(aggregateStatsByWordLength[wordLength][statColumns[s]]);
            }

            for (var s = 0; s < calculatedStats.length; s++) {
                var multiplier = calculatedStats[s]["multiplier"];
                var divisor = calculatedStats[s]["divisor"];
                if (aggregateStatsByWordLength[wordLength][divisor] > 0) {
                    printline.push(aggregateStatsByWordLength[wordLength][multiplier] / aggregateStatsByWordLength[wordLength][divisor]);
                } else {
                    printline.push("-");
                }
            }
        }

        // Loop through all total n grams
        var qualityScoreResult = DEFAULT_QUALITY_SCORE;
        if (qualityScoresWordCount.hasOwnProperty(wordLength)) {
            var totalQualityScore = qualityScoresWordCount[wordLength]["totalQualityScore"];
            var totalOccurences = qualityScoresWordCount[wordLength]["occurence"];
            qualityScoreResult = totalQualityScore / totalOccurences;

        }

        printline.push(qualityScoreResult);
        wordLengthOutput.push(printline);
        wordLengthFormat.push(formatting);
    }

    var filterText = "";
    if (ignorePausedAdGroups) {
        filterText = "Active ad groups";
    } else {
        filterText = "All ad groups";
    }

    if (ignorePausedCampaigns) {
        filterText += " in active campaigns";
    } else {
        filterText += " in all campaigns";
    }

    if (campaignNameContains != "") {
        filterText += " containing '" + campaignNameContains + "'";
        if (campaignNameDoesNotContain != "") {
            filterText += " and not containing '" + campaignNameDoesNotContain + "'";
        }
    } else if (campaignNameDoesNotContain != "") {
        filterText += " not containing '" + campaignNameDoesNotContain + "'";
    }

    // Find or create the required sheets
    var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
    var campaignNGramName = {};
    var adGroupNGramName = {};
    var totalNGramName = {};
    var campaignNGramSheet = {};
    var adGroupNGramSheet = {};
    var totalNGramSheet = {};

    for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
        if (n == 1) {
            campaignNGramName[n] = "Campaign Word Analysis";
            adGroupNGramName[n] = "Ad Group Word Analysis";
            totalNGramName[n] = "Account Word Analysis";
        } else {
            campaignNGramName[n] = "Campaign " + n + "-Gram Analysis";
            adGroupNGramName[n] = "Ad Group " + n + "-Gram Analysis";
            totalNGramName[n] = "Account " + n + "-Gram Analysis";
        }

        campaignNGramSheet[n] = getSheet(campaignNGramName[n], spreadsheet);
        adGroupNGramSheet[n] = getSheet(adGroupNGramName[n], spreadsheet);
        totalNGramSheet[n] = getSheet(totalNGramName[n], spreadsheet);
    }

    var wordCountSheet = getSheet("Word Count Analysis", spreadsheet);

    // Write the output arrays to the spreadsheet
    for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
        var nGramName = n + "-Grams";
        if (n == 1) {
            nGramName = "Words";
        }

        writeOutput(outputs[n]['campaign'], formats[n]['campaign'], campaignNGramSheet[n], nGramName, "Campaign", filterText, clearSpreadsheet);
        writeOutput(outputs[n]['adgroup'], formats[n]['adgroup'], adGroupNGramSheet[n], nGramName, "Ad Group", filterText, clearSpreadsheet);
        writeOutput(outputs[n]['total'], formats[n]['total'], totalNGramSheet[n], nGramName, "Account", filterText, clearSpreadsheet);
    }

    writeOutput(wordLengthOutput, wordLengthFormat, wordCountSheet, "Word Count", "Account", filterText, clearSpreadsheet);

    Logger.log("Finished writing to spreadsheet.");
} // end main function


function writeOutput(outputArray, formatArray, sheet, nGramName, levelName, filterText, clearSpreadsheet) {
    for (var i = 0; i < 5; i++) {
        try {
            if (clearSpreadsheet) {
                sheet.clear();
            }

            if (nGramName == "Word Count") {
                sheet.getRange("R1C1").setValue("Analysis of Search Query Performance by Word Count");
            } else {
                sheet.getRange("R1C1").setValue("Analysis of " + nGramName + " in Search Query Report, By " + levelName);
            }

            sheet.getRange("R" + (sheet.getLastRow() + 2) + "C1").setValue(filterText);

            var lastRow = sheet.getLastRow();

            if (formatArray.length == 0) {
                sheet.getRange("R" + (lastRow + 1) + "C1").setValue("No " + nGramName.toLowerCase() + " found within the thresholds.");
            } else {
                sheet.getRange("R" + (lastRow + 1) + "C1:R" + (lastRow + outputArray.length) + "C" + outputArray[0].length).setValues(outputArray);
                sheet.getRange("R" + (lastRow + 2) + "C1:R" + (lastRow + outputArray.length) + "C" + formatArray[0].length).setNumberFormats(formatArray);

                var sortByColumns = [];
                if (outputArray[0][0] == "Campaign" || outputArray[0][0] == "Word count") {
                    sortByColumns.push({
                        column: 1,
                        ascending: true
                    });
                }
                if (outputArray[0][1] == "Ad Group") {
                    sortByColumns.push({
                        column: 2,
                        ascending: true
                    });
                }

                if (sortByColumns.length !== 0) {
                    sheet.getRange("R" + (lastRow + 2) + "C1:R" + (lastRow + outputArray.length) + "C" + outputArray[0].length).sort(sortByColumns);
                }

            }

            break;

        } catch (e) {
            if (e == "Exception: This action would increase the number of cells in the worksheet above the limit of 2000000 cells.") {
                Logger.log("Could not output " + levelName + " level " + nGramName.toLowerCase() + ": '" + e + "'");
                try {
                    sheet.getRange("R" + (sheet.getLastRow() + 2) + "C1").setValue("Not enough space to write the data - try again in an empty spreadsheet");
                } catch (e2) {
                    Logger.log("Error writing 'not enough space' message: " + e2);
                }
                break;
            }

            if (i == 4) {
                Logger.log("Could not output " + levelName + " level " + nGramName.toLowerCase() + ": '" + e + "'");
            }
        }
    }
}

function generateAverageQualityScore(minNGramLength, maxNGramLength, dateRange) {
    var campaignNGrams = {};
    var campaignNGramsBroad = {};
    var adGroupNGrams = {};
    var adGroupNGramsBroad = {};
    var totalNGrams = {};
    var totalNGramsBroad = {};
    var wordCountGrams = {};

    for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
        totalNGrams[n] = {};
    }

    var statColumns = ["QualityScore"];
    var awql = AdWordsApp.report(
        "SELECT CampaignName, QualityScore, AdGroupName, Criteria, Id, KeywordMatchType " +
        "FROM  KEYWORDS_PERFORMANCE_REPORT " +
        "WHERE Status = ENABLED AND IsNegative = FALSE  " +
        "DURING " + dateRange + " "
    );

    // Iterate over exact/phrase/broad Keywords
    var rows = awql.rows();

    // Broad KWs.
    while (rows.hasNext()) {
        var row = rows.next();
        var campaignName = row["CampaignName"];
        var adGroupName = row["AdGroupName"];
        var qualityScore = row["QualityScore"];
        var keywordMatchType = row["KeywordMatchType"];
        var criteria = row["Criteria"];

        if (qualityScore === "--") {
            continue;
        }
        if (keywordMatchType.toLowerCase() === "broad") {

            qualityScore = parseFloat(qualityScore);
            var words = criteria.replace(/\+/g, "").split(" ");
            var wordObject = {};

            if (wordCountGrams[words.length] == undefined) {
                wordCountGrams[words.length] = {};
                wordCountGrams[words.length]["totalQualityScore"] = 0;
                wordCountGrams[words.length]["occurence"] = 0;
            }
            wordCountGrams[words.length]["totalQualityScore"] += qualityScore;
            wordCountGrams[words.length]["occurence"] += 1;

            for (var i = 0; i < words.length; i++) {
                var currentWord = words[i];
                wordObject[currentWord] = true;
            }

            // Ag Group N Gram Broad
            initialiseIfNotExists(adGroupNGramsBroad, campaignName, {});
            initialiseIfNotExists(adGroupNGramsBroad[campaignName], adGroupName, {});
            initialiseIfNotExists(adGroupNGramsBroad[campaignName][adGroupName], words.length, []);
            // Campaign N Gram Broad
            initialiseIfNotExists(campaignNGramsBroad, campaignName, {});
            initialiseIfNotExists(campaignNGramsBroad[campaignName], words.length, []);
            // Total N Gram Broad
            initialiseIfNotExists(totalNGramsBroad, words.length, []);
            adGroupNGramsBroad[campaignName][adGroupName][words.length].push([wordObject, qualityScore]);
            campaignNGramsBroad[campaignName][words.length].push([wordObject, qualityScore]);

            if (totalNGramsBroad[words.length].length === 0) {
                totalNGramsBroad[words.length].push([wordObject, qualityScore, 1])
            } else {
                for (var c = 0; c < totalNGramsBroad[words.length].length; c++) {

                    var areBothObjectsEqual = areObjectsEqual(wordObject, totalNGramsBroad[words.length][c][0]);
                    if (areBothObjectsEqual) {
                        totalNGramsBroad[words.length][c][1] += qualityScore;
                        totalNGramsBroad[words.length][c][2] += 1;
                        continue;
                    }
                    totalNGramsBroad[words.length].push([wordObject, qualityScore, 1]);
                    break;
                }
            }
        } else {
            var currentWords = criteria.split(" ");
            var stats = [];
            qualityScore = parseFloat(qualityScore);
            for (var i = 0; i < statColumns.length; i++) {
                stats[i] = qualityScore;
            }

            var wordsLength = currentWords.length;
            if (wordCountGrams[wordsLength] == undefined) {
                wordCountGrams[wordsLength] = {};
                wordCountGrams[wordsLength]["totalQualityScore"] = 0;
                wordCountGrams[wordsLength]["occurence"] = 0;
            }
            wordCountGrams[wordsLength]["totalQualityScore"] += qualityScore;
            wordCountGrams[wordsLength]["occurence"] += 1;


            if (campaignNGrams[campaignName] == undefined) {
                campaignNGrams[campaignName] = [];
                adGroupNGrams[campaignName] = {};

                for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
                    campaignNGrams[campaignName][n] = {};
                }
            }

            if (adGroupNGrams[campaignName][adGroupName] == undefined) {
                adGroupNGrams[campaignName][adGroupName] = [];
                for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
                    adGroupNGrams[campaignName][adGroupName][n] = {};
                }
            }

            for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
                if (n > currentWords.length) {
                    break;
                }

                var doneNGrams = {};

                for (var w = 0; w < currentWords.length - n + 1; w++) {
                    var replaced = currentWords.slice(w, w + n).join(" ").replace(/\+/g, "");
                    var currentNGram = '="' + replaced + '"';
                    if (!doneNGrams.hasOwnProperty(currentNGram)) {
                        if (campaignNGrams[campaignName][n][currentNGram] == undefined) {
                            campaignNGrams[campaignName][n][currentNGram] = {};
                            campaignNGrams[campaignName][n][currentNGram]["Query Count"] = 0;
                        }
                        if (adGroupNGrams[campaignName][adGroupName][n][currentNGram] == undefined) {
                            adGroupNGrams[campaignName][adGroupName][n][currentNGram] = {};
                            adGroupNGrams[campaignName][adGroupName][n][currentNGram]["Query Count"] = 0;
                        }
                        if (totalNGrams[n][currentNGram] == undefined) {
                            totalNGrams[n][currentNGram] = {};
                            totalNGrams[n][currentNGram]["Query Count"] = 0;
                        }
                        campaignNGrams[campaignName][n][currentNGram]["Query Count"]++;
                        adGroupNGrams[campaignName][adGroupName][n][currentNGram]["Query Count"]++;
                        totalNGrams[n][currentNGram]["Query Count"]++;

                        for (var i = 0; i < statColumns.length; i++) {

                            accumulateStats(campaignNGrams[campaignName][n][currentNGram], statColumns[i], stats[i]);
                            accumulateStats(adGroupNGrams[campaignName][adGroupName][n][currentNGram], statColumns[i], stats[i]);
                            accumulateStats(totalNGrams[n][currentNGram], statColumns[i], stats[i]);
                        }
                        doneNGrams[currentNGram] = true;
                    }
                }
            }
        }
    }

    Logger.log("Finished Keywords Quality Score Collection");

    // Finding Average QS.
    // AdGroup Level
    Logger.log("Starting Finding QS Average");
    for (var [campaign, campaignAdGroups] in adGroupNGrams) {
        for (var [adGroup, keywords] in campaignAdGroups) {
            for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
                var currentKeywords = keywords[n];
                for (var [keyword, keywordInformation] in currentKeywords) {
                    var queryCount = (keywordInformation["Query Count"]);
                    var qualityScore = (keywordInformation["QualityScore"]);
                    keywordInformation["QualityScore"] = qualityScore / queryCount;
                }

            }
        }
    }

    // Campaign level
    // campaignNGrams[campaignName][n][currentNGram][statColumns[i]] = stats[i];
    for (var [campaign, keywordSegmentedBySize] in campaignNGrams) {
        for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
            var currentKeywords = keywordSegmentedBySize[n];
            for (var [keyword, keywordInformation] in currentKeywords) {
                var queryCount = (keywordInformation["Query Count"]);
                var qualityScore = (keywordInformation["QualityScore"]);
                keywordInformation["QualityScore"] = qualityScore / queryCount;
            }
        }
    }

    // Account Level
    for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
        for (var [keyword, keywordInformation] in totalNGrams[n]) {
            var queryCount = (keywordInformation["Query Count"]);
            var qualityScore = (keywordInformation["QualityScore"]);
            keywordInformation["QualityScore"] = qualityScore / queryCount;
        }
    }

    // Account Level - Broad
    for (var n = minNGramLength; n < maxNGramLength + 1; n++) {
        if (totalNGramsBroad[n] == undefined) {
            continue;
        }
        for (var [index, keywordInfo] in totalNGramsBroad[n]) {
            keywordInfo[1] = keywordInfo[1] / keywordInfo[2];
        }
    }

    var collectionOfObjects = {
        "totalNGrams": totalNGrams,
        "adGroupNGrams": adGroupNGrams,
        "campaignNGrams": campaignNGrams,
        "wordCountNGrams": wordCountGrams,
        "campaignNGramsBroad": campaignNGramsBroad,
        "adGroupNGramsBroad": adGroupNGramsBroad,
        "totalNGramsBroad": totalNGramsBroad
    };
    return collectionOfObjects;
}

// Helper function to compare objects.
function areObjectsEqual(o1, o2) {
    for (var p in o1) {
        if (o1.hasOwnProperty(p)) {
            if (o1[p] !== o2[p]) {
                return false;
            }
        }
    }
    for (var p in o2) {
        if (o2.hasOwnProperty(p)) {
            if (o1[p] !== o2[p]) {
                return false;
            }
        }
    }
    return true;
};

// Checking object keys.
function initialiseIfNotExists(uniqueObject, keyToCheck, valueDefault) {
    if (!uniqueObject.hasOwnProperty(keyToCheck)) {
        uniqueObject[keyToCheck] = valueDefault;
    }
}

function isSearchExcluded(id, currentQuery, negativesByCampaignOrAdGroup) {
    var searchIsExcluded = false;
    for (var [matchType, keywords] in negativesByCampaignOrAdGroup[id]) {
        if (
            (
                (matchType === "exact") &&
                (keywords.indexOf(currentQuery) > -1)
            ) ||
            (
                (matchType !== "exact") && keywords.map(function (keyword) {
                    return " " + keyword + " "
                }).indexOf(" " + currentQuery + " ") > -1)

        ) {
            searchIsExcluded = true;
            break;
        }

    }
    return searchIsExcluded;
}

function getSheet(sheetName, spreadsheet) {
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (sheet === null) {
        return spreadsheet.insertSheet(sheetName);
    }
    return sheet;
}

function accumulateStats(object, key, stats) {
    if (object[key] > 0) {
        object[key] += stats;
        return;
    }
    object[key] = stats;
}
