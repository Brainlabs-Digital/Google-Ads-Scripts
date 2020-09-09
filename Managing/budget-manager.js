// ID: 8998c4c7e914892930e4f9554e4fe006
/**
 *
 * Budget Manager
 *
 * This script allows Google Ads MCC Accounts to monitor the performance
 * of various budgets on child accounts based on defined
 * metrics.
 *
 * Version: 1.0
 * Google Ads Script maintained on brainlabsdigital.com
 *
 **/

//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

//Options

//Run Type

// Enter 'DOWNLOAD' to download budgets, or 'UPDATE' to update budgets once set new values on the sheet.
// Include the quotation marks.

var RUN_TYPE = 'SET_RUN_TYPE_HERE';

//Spreadsheet URL

var SPREADSHEET_URL = 'YOUR-SPREADSHEET-URL-HERE';

//Ignore Paused Campaigns

// Set to 'false' to include paused campaigns in data.

var ignorePausedCampaigns = true;

//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////


// Indices

var CONFIG_HEADER_ROW = 1;
var CONFIG_FIRST_DATA_ROW = 3;
var DASHBOARD_HEADER_ROW = 6;
var DASHBOARD_FIRST_DATA_ROW = 7;

//////////////////////////////////////////////////////////////////////////////

// Functions

function main() {

    var spreadsheet = getSpreadsheet(SPREADSHEET_URL);
    var runType = RUN_TYPE;
    if (runType.toLowerCase() == "download") {
        download(spreadsheet);
    } else if (runType.toLowerCase() == "update") {
        update(spreadsheet);
    } else {
        throw ("input for RUN_TYPE variable \"" + runType +
            "\" not recognised. Please enter either 'DOWNLOAD' or 'UPDATE' (including quotation marks)");
    }
}

function update(spreadsheet) {

    var dashboardSheet = spreadsheet.getSheetByName("Budget Dashboard");
    var budgetsToChange = getBudgetsToChange(dashboardSheet);
    Logger.log("Updating budgets")
    for (var i = 0; i < budgetsToChange.length; i++) {
        budgetToChange = budgetsToChange[i];
        updateBudgetOnGoogleAds(budgetToChange);
    }
    Logger.log("Clearing sheet");
    clearSheet(dashboardSheet);
    Logger.log("Re-downloading budgets");
    download(spreadsheet);
    Logger.log("Success");
}

function download(spreadsheet) {

    var configSheet = spreadsheet.getSheetByName("Configuration");
    var dashboardSheet = spreadsheet.getSheetByName("Budget Dashboard");
    var tz = AdsApp.currentAccount().getTimeZone();

    //Store Sheet Headers and Indices
    var configHeaders = configSheet.getRange(CONFIG_HEADER_ROW + ":" + CONFIG_HEADER_ROW).getValues()[0];
    var statusIndex = configHeaders.indexOf("Status");
    var accountIDIndex = configHeaders.indexOf("Account ID");
    var accountNameIndex = configHeaders.indexOf("Account Name");
    var campaignNameContainsIndex = configHeaders.indexOf("Campaign Name Contains");
    var campaignNameDoesNotContainIndex = configHeaders.indexOf("Campaign Name Doesn't Contain");


    //Get all rows of data.

    var allData = configSheet.getRange(CONFIG_FIRST_DATA_ROW, 1, configSheet.getLastRow() - (CONFIG_HEADER_ROW + 1), configSheet.getLastColumn()).getValues();

    //For each row of data:
    Logger.log("Verifying each row of data...")
    for (var i = 0; i < allData.length; i++) {
        var row = allData[i];
        if (row[statusIndex] == "Paused") {
            continue;
        };
        var childAccount = getAccountId(row[accountIDIndex]);
        AdsManagerApp.select(childAccount);
        var combinedQueries = makeQueries(row[campaignNameContainsIndex], row[campaignNameDoesNotContainIndex])
        var budgetData = getBudgetData(combinedQueries, row[accountNameIndex]);
        var accountCurrencyCode = getAccountCurrencyCode();
        var accountDataRow = [row[accountNameIndex], row[accountIDIndex]]
        var dashboardRows = budgetData.map(function (budgetDataRow) {
            return accountDataRow.concat(budgetDataRow.map(function (field) {
                return field.value;
            })).concat([accountCurrencyCode])
        });
        Logger.log(dashboardRows)
        writeRowsOntoSheet(dashboardSheet, dashboardRows);
    }
    setDate(dashboardSheet, tz);
    Logger.log("Success.")
}

function getBudgetsToChange(sheet) {
    var dataRange = sheet.getRange(DASHBOARD_HEADER_ROW, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
    var headers = dataRange.shift();
    var allBudgets = dataRange.map(function (budgetData) {
        return headers.reduce(function (budgetRow, header, index) {
            budgetRow[header] = budgetData[index];
            return budgetRow;
        }, {});
    });
    budgetsToChange = [];
    for (var i = 0; i < allBudgets.length; i++) {
        var budgetRow = allBudgets[i];
        var updateBudgetCol = budgetRow["Set New Budget"];
        if (updateBudgetCol.length !== 0) {
            budgetsToChange.push(budgetRow);
        }
    }
    return budgetsToChange;
}


function updateBudgetOnGoogleAds(budgetToChange) {
    var childAccount = getAccountId(budgetToChange["Account ID"], budgetToChange["Account Name"])
    AdsManagerApp.select(childAccount);
    var budgetIterator = AdsApp.budgets().withCondition("BudgetId = " + budgetToChange["Budget ID"]).get();
    if (budgetIterator.hasNext()) {
        var budget = budgetIterator.next();
        try {
            budget.setAmount(budgetToChange["Set New Budget"]);

        } catch (e) {
            throw ("Unable to update budgets: " + e)
        }
    }
}

function getSpreadsheet(spreadsheetUrl) {
    Logger.log('Checking spreadsheet: ' + spreadsheetUrl + ' is valid.');
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
        throw ("Problem with " + spreadsheetUrl + " URL: '" + e + "'. You may not have edit access");
    }
}

function getAccountId(accountId) {
    var childAccount = AdsManagerApp.accounts().withIds([accountId]).get();
    if (childAccount.hasNext()) {
        return childAccount.next();
    } else {
        throw ("Could not find account with ID: " + accountId + ". Check you have entered a correct account ID (MCC IDs not valid)");
    }

}

function clearSheet(sheet) {
    sheet.getRange(DASHBOARD_FIRST_DATA_ROW, 1, sheet.getLastRow(), sheet.getLastColumn()).clear({
        contentsOnly: true
    });
}

function makeQueries(campaignNameContains, campaignNameDoesNotContain) {
    var campaignNameContains = campaignNameContains.split(',').map(function (item) {
        return item.trim();
    });
    var campaignNameDoesNotContain = campaignNameDoesNotContain.split(',').map(function (item) {
        return item.trim();
    });
    var campaignFilterStatements = makeCampaignFilterStatements(campaignNameContains, campaignNameDoesNotContain, ignorePausedCampaigns);
    var queries = addDateToStatements(campaignFilterStatements);
    return queries;
}

function makeCampaignFilterStatements(campaignNameContains, campaignNameDoesNotContain, ignorePausedCampaigns) {
    var whereStatement = "WHERE BudgetStatus != 'REMOVED' ";
    var whereStatementsArray = [];


    if (ignorePausedCampaigns) {
        whereStatement += "AND AssociatedCampaignStatus = 'ENABLED' ";
    } else {
        whereStatement += "AND AssociatedCampaignStatus IN ['ENABLED','PAUSED'] ";
    }

    for (var i = 0; i < campaignNameDoesNotContain.length; i++) {
        if (campaignNameDoesNotContain == "") {
            break;
        } else {
            whereStatement += "AND AssociatedCampaignName DOES_NOT_CONTAIN_IGNORE_CASE '" +
                campaignNameDoesNotContain[i].replace(/"/g, '\\\"') + "' ";
        }
    }

    if (campaignNameContains.length == 0) {
        whereStatementsArray = [whereStatement];

    } else {
        for (var i = 0; i < campaignNameContains.length; i++) {
            whereStatementsArray.push(whereStatement + 'AND AssociatedCampaignName CONTAINS_IGNORE_CASE "' +
                campaignNameContains[i].replace(/"/g, '\\\"') + '" '
            );
        }
    }
    return whereStatementsArray;
}


function addDateToStatements(campaignFilterQueries) {
    var combinedQueries = []
    for (var i = 0; i < campaignFilterQueries.length; i++) {
        combinedQueries.push(campaignFilterQueries[i]
            .concat(" DURING TODAY"));

    }
    return combinedQueries;
}

function getAccountCurrencyCode() {
    var report = AdsApp.report("SELECT AccountCurrencyCode FROM ACCOUNT_PERFORMANCE_REPORT");
    var reportRow = report.rows().next();
    return reportRow["AccountCurrencyCode"]
}

function getBudgetData(queries, accountName) {
    dataRows = []
    var fields = ["BudgetName", "BudgetId", "BudgetReferenceCount", "Amount"]
    for (var i = 0; i < queries.length; i++) {
        var report = AdsApp.report(
            "SELECT " + fields.map(function (field) {
                return field;
            }).join(',') + " FROM BUDGET_PERFORMANCE_REPORT " + queries[i]
        );
        var budgetIds = [];
        var reportRows = report.rows();
        if (reportRows.hasNext() === false) {
            throw ("Bid Strategy Performance Monitor: error with account " + accountName +
                ": no campaigns found with the given settings: " + queries[i]
            )
        };
        while (reportRows.hasNext()) {
            var reportRow = reportRows.next();
            if (budgetIds.indexOf(reportRow["BudgetId"]) == -1) {
                budgetIds.push(reportRow["BudgetId"]);
                var dataRow = fields.map(function (field) {
                    return {
                        name: field,
                        value: reportRow[field] || "N/A"
                    };
                });
                dataRows.push(dataRow)
            }
        }
    }
    return dataRows;
}

function writeRowsOntoSheet(sheet, rows) {
    for (var i = 0; i < rows.length; i++) {
        row = rows[i];
        sheet.getRange((sheet.getLastRow() + 1), 1, 1, row.length).setValues([row]);
    }
}

function setDate(sheet, tz) {
    var now = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm:ss');
    sheet.getRange("H2").setValue(now);
}
