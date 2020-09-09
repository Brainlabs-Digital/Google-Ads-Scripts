// ID: f9095d0b6783a7526117ad14e36935c8
/**
*
* MiniChecker
*
* A Google Ads script that carries out a selection of checks to assess account
* health, and emails the user its conclusions.  The checks that it carries out
* are:
* - Worldwide Targeting Checker.  Checks for any campaigns with worldwide
*   targeting
* - Keyword Bid Upper Limit Checker.  Compares bids to a user-set upper
*   limit, reporting any keywords that exceed this limit
* - Bid Modifier Upper Limit Checker.  Compares device, location and ad
*   scheduling bid modifiers to a user-set upper limit, reporting any modifiers
*   that exceed this limit
*
* Version: 1.1
* Google AdWords Script maintained on brainlabsdigital.com
*
**/
///////////////////////////////////////////////////////////////////////////////
// Options

// The email address that the results of the checks should be sent to
var EMAIL_ADDRESS = "example@example.com";

// Use this if you want to exclude some campaigns. Case insensitive.
// For example ["Brand"] would ignore any campaigns with "brand" in the name,
// while ["Brand","Competitor"] would ignore any campaigns with "brand" or
// "competitor" in the name.
// Leave as [] to not exclude any campaigns.
var CAMPAIGN_NAME_DOES_NOT_CONTAIN = [];

// Use this if you only want to look at some campaigns.  Case insensitive.
// For example ["Brand"] would only look at campaigns with "brand" in the name,
// while ["Brand","Generic"] would only look at campaigns with "brand" or
// "generic" in the name.
// Leave as [] to include all campaigns.
var CAMPAIGN_NAME_CONTAINS = [];

// Use this if you want to only look at enabled campaigns.
// Set this to true to only look at currently active campaigns.
// Set to false to also include campaigns that are currently paused.
var IGNORE_PAUSED_CAMPAIGNS = true;

// Set the following to true or false to enable or disable the checkers.
// If CHECK_BID_MODIFIERS is set to false, the settings below it are ignored
var CHECK_WORLDWIDE_TARGETING = true;
var CHECK_KEYWORD_BIDS = true;
var CHECK_BID_MODIFIERS = true;

// Use this to set the upper limit on max CPC if using the Keyword Bid Checker.
// This must be a number greater than 0, in the currency of the account.
var BID_UPPER_LIMIT = 20.0;
// Use this if using the Keyword Bid Checker.
// Set this to true to only look at currently active keywords.
// Set to false to also include keywords that are currently paused.
var IGNORE_PAUSED_KEYWORDS = true;

// Use these to set the upper limit on bid modifiers if using the Bid Modifier
// Checker, as well as turning off checks on specific modifiers.
// The upper limits must be numbers between 0.1 and 9 corresponding to a
// percentage bid adjustment.
// adjustment.
// For example, 0.1 corresponds to a bid adjustment of -90% and 9 corresponds
// to a bid adjustment of +900%
var CHECK_DEVICE_BID_MODIFIERS = true;
var DEVICE_UPPER_LIMIT = 5.0;
var CHECK_LOCATION_BID_MODIFIERS = true;
var LOCATION_UPPER_LIMIT = 5.0;
var CHECK_AD_SCHEDULE_BID_MODIFIERS = true;
var AD_SCHEDULING_UPPER_LIMIT = 5.0;


///////////////////////////////////////////////////////////////////////////////
// Constants for use in the script
// DO NOT CHANGE
var CAMPAIGN_NAME = 'CampaignName';
var OVER_SIZED_MODIFIERS = 'OverSizedModifiers';
var CRITERION_TYPE = 'CriterionType';
var CRITERION = 'Criterion';
var DEVICE = 'Device';
var LOCATION = 'Location';
var AD_SCHEDULING = 'AdScheduling';
var BID_MODIFIER = 'BidModifier';
var HIGH_BID_KEYWORDS = 'HighBidKeywords';
var KEYWORD = 'Keyword';
var AD_GROUP_NAME = 'AdGroupName';
var BID = 'Bid';
var BID_LIMIT = 'BidLimit';
var COUNT = 'Count'

var DEVICE_MODIFIER_FIELDS = {
    "CampaignDesktopBidModifier": "Desktop",
    "CampaignMobileBidModifier": "Mobile",
    "CampaignTabletBidModifier": "Tablet"
};


///////////////////////////////////////////////////////////////////////////////
function main() {
    var validCampaignIds = getCampaignIds();

    var worldwideTargetingResult = checkWorldwideTargeting(validCampaignIds);
    var bidModifiersResult = checkBidModifiers(validCampaignIds);
    var keywordsResult = checkKeywordBids(validCampaignIds);

    sendSummaryEmail(
        worldwideTargetingResult,
        bidModifiersResult,
        keywordsResult
    );
}

// Get the IDs of campaigns which match the given options
function getCampaignIds() {
    var whereStatement = "WHERE ";
    var whereStatementsArray = [];
    var campaignIds = [];

    if (IGNORE_PAUSED_CAMPAIGNS) {
        whereStatement += "CampaignStatus = ENABLED ";
    } else {
        whereStatement += "CampaignStatus IN ['ENABLED','PAUSED'] ";
    }

    for (var i = 0; i < CAMPAIGN_NAME_DOES_NOT_CONTAIN.length; i++) {
        whereStatement += "AND CampaignName DOES_NOT_CONTAIN_IGNORE_CASE '"
            + CAMPAIGN_NAME_DOES_NOT_CONTAIN[i].replace(/"/g, '\\\"') + "' ";
    }

    if (CAMPAIGN_NAME_CONTAINS.length == 0) {
        whereStatementsArray = [whereStatement];
    } else {
        for (var i = 0; i < CAMPAIGN_NAME_CONTAINS.length; i++) {
            whereStatementsArray.push(
                whereStatement
                + 'AND CampaignName CONTAINS_IGNORE_CASE "'
                + CAMPAIGN_NAME_CONTAINS[i].replace(/"/g, '\\\"')
                + '" '
            );
        }
    }

    for (var i = 0; i < whereStatementsArray.length; i++) {
        var campaignReport = AdsApp.report(
            "SELECT CampaignId "
            + "FROM   CAMPAIGN_PERFORMANCE_REPORT "
            + whereStatementsArray[i]
            + "DURING LAST_30_DAYS"
        );

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


function checkWorldwideTargeting(campaignIds) {
    if (!CHECK_WORLDWIDE_TARGETING) {
        return [];
    }

    Logger.log("Checking Worldwide Targeting");

    var worldwideTargetingIssues = [];

    var campaignIterator = AdsApp.campaigns().withIds(campaignIds).get();

    while (campaignIterator.hasNext()) {
        var campaign = campaignIterator.next();
        var locationIterator = campaign
            .targeting()
            .targetedLocations()
            .get();
        if (!locationIterator.hasNext()) {
            var proximityIterator = campaign
                .targeting()
                .targetedProximities()
                .get();
            if (!proximityIterator.hasNext()) {
                var issue = {};
                issue[CAMPAIGN_NAME] = campaign.getName();
                worldwideTargetingIssues.push(issue);
            }
        }
    }
    return worldwideTargetingIssues;
}

function checkBidModifiers(campaignIds) {
    var combinedIssues = [];
    if (!CHECK_BID_MODIFIERS) {
        combinedIssues[COUNT] = 0;
        return combinedIssues;
    }

    Logger.log("Checking Bid Modifiers");

    var totalBidIssues = 0
    var deviceIssues = getDeviceIssues(campaignIds);
    var locationIssues = getLocationIssues(campaignIds);
    var adScheduleIssues = getAdScheduleIssues(campaignIds);

    var allIssues = deviceIssues.concat(locationIssues, adScheduleIssues);
    var combinedIssuesObject = {};

    for (var i in allIssues) {
        var issue = allIssues[i];
        if (issue[CAMPAIGN_NAME] in combinedIssuesObject) {
            combinedIssuesObject[issue[CAMPAIGN_NAME]] =
                combinedIssuesObject[issue[CAMPAIGN_NAME]]
                    .concat(issue[OVER_SIZED_MODIFIERS]);
        } else {
            combinedIssuesObject[issue[CAMPAIGN_NAME]] = issue[OVER_SIZED_MODIFIERS];
        }
    }

    for (var campaignName in combinedIssuesObject) {
        var issue = {};
        issue[CAMPAIGN_NAME] = campaignName;
        issue[OVER_SIZED_MODIFIERS] = combinedIssuesObject[campaignName];
        totalBidIssues += combinedIssuesObject[campaignName].length
        combinedIssues.push(issue);
    }

    combinedIssues[COUNT] = totalBidIssues
    return combinedIssues;
}

function checkKeywordBids(campaignIds) {
    var dataToReport = [];
    if (!CHECK_KEYWORD_BIDS) {
        dataToReport[COUNT] = 0;
        return dataToReport;
    }

    Logger.log('Checking Keyword Bids');

    if (IGNORE_PAUSED_KEYWORDS) {
        var keywordCondition = 'Status = ENABLED';
    } else {
        var keywordCondition = 'Status IN [ENABLED, PAUSED]';
    }

    var campaignIdsCondition = 'CampaignId IN ['
        + campaignIds.join(', ')
        + ']';

    var biddingStrategyCondition = 'BiddingStrategyType = MANUAL_CPC';

    var whereCondition = [
        keywordCondition,
        campaignIdsCondition,
        biddingStrategyCondition
    ].join(' AND ');

    var report = AdsApp.report(
        'SELECT CampaignName, AdGroupName, Criteria, CpcBid '
        + 'FROM KEYWORDS_PERFORMANCE_REPORT '
        + 'WHERE ' + whereCondition
    );
    var rowIterator = report.rows();

    var rawData = {};

    while (rowIterator.hasNext()) {
        var row = rowIterator.next();
        var bid = row['CpcBid'];
        if (bid <= BID_UPPER_LIMIT) {
            continue;
        }
        var campaignName = row['CampaignName'];
        if (rawData[campaignName] === undefined) {
            rawData[campaignName] = {};
        }
        var adGroupName = row['AdGroupName'];
        if (rawData[campaignName][adGroupName] === undefined) {
            rawData[campaignName][adGroupName] = [];
        }
        var keywordInformation = {};
        keywordInformation[KEYWORD] = row['Criteria'];
        keywordInformation[BID] = bid;
        rawData[campaignName][adGroupName].push(
            keywordInformation
        );
    }

    dataToReport[COUNT] = 0;
    for (var campaignName in rawData) {
        var adgroupInformation = rawData[campaignName];
        var highBidKeywords = [];
        for (var adGroupName in adgroupInformation) {
            var keywordArray = adgroupInformation[adGroupName];
            for (var i = 0; i < keywordArray.length; i++) {
                var keywordObject = keywordArray[i];
                keywordObject[AD_GROUP_NAME] = adGroupName;
                highBidKeywords.push(keywordObject);
            }
        }
        if (highBidKeywords.length === 0) {
            continue;
        }
        var campaignObject = {};
        campaignObject[CAMPAIGN_NAME] = campaignName;
        campaignObject[HIGH_BID_KEYWORDS] = highBidKeywords;
        dataToReport[COUNT] += highBidKeywords.length
        dataToReport.push(
            campaignObject
        );
    }

    return dataToReport;
}


function getDeviceIssues(campaignIds) {
    if (!CHECK_DEVICE_BID_MODIFIERS) {
        return [];
    }

    Logger.log("Checking Device Bid Modifiers");

    var deviceIssues = [];
    var query = "SELECT CampaignName, "
        + Object.keys(DEVICE_MODIFIER_FIELDS).join(", ")
        + " FROM CAMPAIGN_PERFORMANCE_REPORT "
        + "WHERE CampaignId IN [" + campaignIds.join(", ") + "]"

    var report = AdsApp.report(query);
    var rowIterator = report.rows();

    while (rowIterator.hasNext()) {
        var row = rowIterator.next();
        var campaignDeviceIssues = [];

        for (var field in DEVICE_MODIFIER_FIELDS) {
            var bidModifier = row[field].slice(0, -1) / 100;
            if (bidModifier > DEVICE_UPPER_LIMIT) {
                var issue = {};
                issue[CRITERION_TYPE] = DEVICE;
                issue[CRITERION] = DEVICE_MODIFIER_FIELDS[field];
                issue[BID_MODIFIER] = bidModifier;
                issue[BID_LIMIT] = DEVICE_UPPER_LIMIT

                campaignDeviceIssues.push(issue);
            }
        }

        if (campaignDeviceIssues.length > 0) {
            var issue = {};
            issue[CAMPAIGN_NAME] = row["CampaignName"];
            issue[OVER_SIZED_MODIFIERS] = campaignDeviceIssues;

            deviceIssues.push(issue);
        }
    }

    return deviceIssues;
}

function getLocationIssues(campaignIds) {
    if (!CHECK_LOCATION_BID_MODIFIERS) {
        return [];
    }

    Logger.log("Checking Location Bid Modifiers");

    var locationIssues = [];

    var campaignIterator = AdsApp.campaigns().withIds(campaignIds).get();

    while (campaignIterator.hasNext()) {
        var campaign = campaignIterator.next();
        var campaignLocationIssues = [];
        var locationIterator = campaign
            .targeting()
            .targetedLocations()
            .withCondition("BidModifier > " + (LOCATION_UPPER_LIMIT + 1))
            .get();

        while (locationIterator.hasNext()) {
            var location = locationIterator.next();

            var issue = {};
            issue[CRITERION_TYPE] = LOCATION;
            issue[CRITERION] = location.getName();
            issue[BID_MODIFIER] = location.getBidModifier() - 1;
            issue[BID_LIMIT] = LOCATION_UPPER_LIMIT

            campaignLocationIssues.push(issue);
        }

        if (campaignLocationIssues.length > 0) {
            var issue = {};
            issue[CAMPAIGN_NAME] = campaign.getName();
            issue[OVER_SIZED_MODIFIERS] = campaignLocationIssues;

            locationIssues.push(issue);
        }
    }

    return locationIssues;
}

function getAdScheduleIssues(campaignIds) {
    if (!CHECK_AD_SCHEDULE_BID_MODIFIERS) {
        return [];
    }

    Logger.log("Checking Ad Schedule Bid Modifiers");

    var adScheduleIssues = [];

    var campaignIterator = AdsApp.campaigns().withIds(campaignIds).get();

    while (campaignIterator.hasNext()) {
        var campaign = campaignIterator.next();
        var campaignAdScheduleIssues = [];
        var adScheduleIterator = campaign.targeting()
            .adSchedules()
            .withCondition("BidModifier > " + (AD_SCHEDULING_UPPER_LIMIT + 1))
            .get();

        while (adScheduleIterator.hasNext()) {
            var adSchedule = adScheduleIterator.next();
            var adScheduleTimeSlotString = adSchedule.getDayOfWeek()
                + " " + adSchedule.getStartHour()
                + ":" + padToLength(adSchedule.getStartMinute(), 2)
                + " - " + adSchedule.getEndHour()
                + ":" + padToLength(adSchedule.getEndMinute(), 2);

            var issue = {};
            issue[CRITERION_TYPE] = AD_SCHEDULING;
            issue[CRITERION] = adScheduleTimeSlotString;
            issue[BID_MODIFIER] = adSchedule.getBidModifier() - 1;
            issue[BID_LIMIT] = AD_SCHEDULING_UPPER_LIMIT

            campaignAdScheduleIssues.push(issue);
        }

        if (campaignAdScheduleIssues.length > 0) {
            var issue = {};
            issue[CAMPAIGN_NAME] = campaign.getName();
            issue[OVER_SIZED_MODIFIERS] = campaignAdScheduleIssues;

            adScheduleIssues.push(issue);
        }
    }

    return adScheduleIssues;
}

function padToLength(int, len) {
    var intString = int.toString();

    while (intString.length < len) {
        intString = "0" + intString;
    }

    return intString;
}

function sendSummaryEmail(worldwideTargetingResult, bidModifiersResult, keywordsResult) {
    var html = ['<html>', '<body>'];

    html.push("Keyword bids above " + BID_UPPER_LIMIT + ": " + keywordsResult[COUNT])
    html.push("<br>Bids exceeding modifier limits: " + bidModifiersResult[COUNT])
    html.push("<br>Campaigns with worldwide location targeting: " + worldwideTargetingResult.length)

    var totalCampaignIssues = keywordsResult[COUNT] + bidModifiersResult[COUNT] + worldwideTargetingResult.length

    html.push('<h2>Keywords with bids above ' + BID_UPPER_LIMIT + ':</h2>');

    if (keywordsResult.length == 0) {
        html.push("<br>No keywords found above bid limit<br>")
    } else {
        html.push('<br><table width=750>',
            "<tr bgcolor='#ddd'>",
            "<th>Campaign</th>",
            "<th>Keyword</th>",
            "<th>Bid</th>",
            "<th>Ad Group</th>",
            '</tr>');

        for (var i = 0; i < keywordsResult.length; i++) {
            var highBidKeywords = keywordsResult[i][HIGH_BID_KEYWORDS];
            for (var j = 0; j < highBidKeywords.length; j++) {
                html.push('<tr>',
                    "<td>" + keywordsResult[i][CAMPAIGN_NAME] + '</td>',
                    "<td style='text-align: center'>" + highBidKeywords[j]["Keyword"] + '</td>',
                    "<td style='text-align: center'>" + highBidKeywords[j]["Bid"] + '</td>',
                    "<td style='text-align: right'>" + highBidKeywords[j]["AdGroupName"] + '</td>',
                    '</tr>');
            }
        }
        html.push('</table><br>');
    }
    html.push('<br><h2>Bid modifiers above limit:</h2>');

    if (bidModifiersResult.length == 0) {
        html.push("<br>No bid modifiers found above limit<br>")
    } else {
        html.push('<br><table width=600>',
            "<tr bgcolor='#ddd'>",
            "<th>Campaign</th>",
            "<th>Criterion Type</th>",
            "<th>Criterion</th>",
            "<th>Limit</th>",
            "<th>Bid Modifier</th>",
            '</tr>');

        for (var i = 0; i < bidModifiersResult.length; i++) {
            var overSizedModifiers = bidModifiersResult[i][OVER_SIZED_MODIFIERS]
            for (var j = 0; j < overSizedModifiers.length; j++) {
                html.push('<tr>',
                    "<td>" + bidModifiersResult[i][CAMPAIGN_NAME] + '</td>',
                    "<td style='text-align: center'>" + overSizedModifiers[j]["CriterionType"] + '</td>',
                    "<td style='text-align: center'>" + overSizedModifiers[j]["Criterion"] + '</td>',
                    "<td style='text-align: center'>" + overSizedModifiers[j]["BidLimit"] + '</td>',
                    "<td style='text-align: right'>" + overSizedModifiers[j]["BidModifier"].toFixed(2) + '</td>',
                    '</tr>');
            }
        }
        html.push('</table><br>');
    }
    html.push('<br><h2>Campaigns with worldwide targeting:</h2>');

    if (worldwideTargetingResult.length == 0) {
        html.push("<br>No campaigns found with worldwide targeting<br>")
    } else {
        html.push('<br><table width=200>',
            "<tr bgcolor='#ddd'>",
            "<th>Campaigns</th>",
            '</tr>');
    }

    for (var i = 0; i < worldwideTargetingResult.length; i++) {
        html.push('<tr>',
            "<td>" + worldwideTargetingResult[i][CAMPAIGN_NAME] + '</td>',
            '</tr>');
    }
    html.push('</table>');
    html.push('</body>', '</html>');
    MailApp.sendEmail(EMAIL_ADDRESS, 'Google Ads Account ' +
        AdsApp.currentAccount().getCustomerId() + ' Summary Report: '
        + totalCampaignIssues + ' issues', '',
        { htmlBody: html.join("") });

}
