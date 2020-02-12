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

var SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/u/0/d/1pQ-m0OypEmOmV73pKfbh38xzGuqosEuKvCjVaDEgUzI/edit';

//Ignore Paused Campaigns

// Set to 'false' to include paused campaigns in data.

var ignorePausedCampaigns = true;

//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

// Metrics

// Metrics are written onto output sheet in order stated below. Read the 'Metric'
// column of the Google Ads documentation to find other metrics to include:
// https://developers.google.com/adwords/api/docs/appendix/reports/campaign-performance-report


// Indices

var EMAIL_CELL = "B1";
var INPUT_HEADER_ROW = 3;
var INPUT_DATA_ROW = 5;
var OUTPUT_HEADER_ROW = 6;
var OUTPUT_FIRST_DATA_ROW = 7;

//////////////////////////////////////////////////////////////////////////////

// Functions

function main() {

    var spreadsheet = getSpreadsheet(SPREADSHEET_URL);
    var emails = getEmails(spreadsheet);
    var runType = RUN_TYPE;
    if (runType.toLowerCase() == "download") {
        download(spreadsheet, emails);
    } else if (runType.toLowerCase() == "update") {
        update(spreadsheet, emails);
    } else {
        throw ("input for RUN_TYPE variable \"" + runType +
            "\" not recognised. Please enter either 'DOWNLOAD' or 'UPDATE' (including quotation marks)");
    }
}

function getEmails(spreadsheet) {
    var inputSheet = spreadsheet.getSheetByName("Input");
    var emailString = inputSheet.getRange("B1").getValue()
    var emailList = emailString.split(',').map(function (item) {
        return item.trim();
    });
    if (emailString.length !== 0) {
        return emailList;
    } else {
        throw ("No email entered. Enter an email so that you may be notified of any script errors.")
    }
}

function update(spreadsheet, emails) {

    var outputSheet = spreadsheet.getSheetByName("Output");
    var budgetsToChange = getBudgetsToChange(outputSheet, emails);
    for (var i = 0; i < budgetsToChange.length; i++) {
        budgetToChange = budgetsToChange[i];
        updateBudgetOnGoogleAds(budgetToChange, emails);
    }
    Logger.log("clearing sheet");
    clearSheet(outputSheet);
    Logger.log("Re-downloading budgets");
    download(spreadsheet, emails);
    Logger.log("Success");
}

function download(spreadsheet, emails) {

    var inputSheet = spreadsheet.getSheetByName("Input");
    var outputSheet = spreadsheet.getSheetByName("Output");
    var tz = AdsApp.currentAccount().getTimeZone();

    //Store Sheet Headers and Indices
    var inputHeaders = inputSheet.getRange(INPUT_HEADER_ROW + ":" + INPUT_HEADER_ROW).getValues()[0];
    var statusIndex = inputHeaders.indexOf("Status");
    var accountIDIndex = inputHeaders.indexOf("Account ID");
    var accountNameIndex = inputHeaders.indexOf("Account Name");
    var campaignNameContainsIndex = inputHeaders.indexOf("Campaign Name Contains");
    var campaignNameDoesNotContainIndex = inputHeaders.indexOf("Campaign Name Doesn't Contain");
    var startDateIndex = inputHeaders.indexOf("Start Date");
    var endDateIndex = inputHeaders.indexOf("End Date");

    //Get all rows of data.

    var allData = inputSheet.getRange(INPUT_DATA_ROW, 1, inputSheet.getLastRow() - (INPUT_HEADER_ROW + 1), inputSheet.getLastColumn()).getValues();

    //For each row of data:
    Logger.log("Verifying each row of data...")
    for (var i = 0; i < allData.length; i++) {
        var row = allData[i];
        if (row[statusIndex] == "Paused") {
            continue;
        };
        var childAccount = getAccountId(row[accountIDIndex], emails, row[accountNameIndex]);
        AdsManagerApp.select(childAccount);
        var dates = getDates([row[startDateIndex], row[endDateIndex]], tz, emails, row[accountNameIndex]);
        var combinedQueries = makeQueries(dates, row[campaignNameContainsIndex], row[campaignNameDoesNotContainIndex])
        var budgetData = getBudgetData(combinedQueries, emails, row[accountNameIndex]);
        var accountCurrencyCode = getAccountCurrencyCode();
        var accountDataRow = [row[accountNameIndex], row[accountIDIndex]]
        outputRows = budgetData.map(function (budgetDataRow) {
            return accountDataRow.concat(budgetDataRow.map(function (field) {
                return field.value;
            })).concat([accountCurrencyCode])
        });
        Logger.log(outputRows)
        writeRowsOntoSheet(outputSheet, outputRows);
    }
    setDate(outputSheet, tz);
    Logger.log("Success.")
}

function getBudgetsToChange(sheet) {
    var dataRange = sheet.getRange(OUTPUT_HEADER_ROW, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
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


function updateBudgetOnGoogleAds(budgetToChange, emails) {
    var childAccount = getAccountId(budgetToChange["Account ID"], emails, budgetToChange["Account Name"])
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

function getAccountId(accountId, emails, accountName) {
    var childAccount = AdsManagerApp.accounts().withIds([accountId]).get();
    if (childAccount.hasNext()) {
        return childAccount.next();
    } else {
        MailApp.sendEmail({
            to: emails.join(),
            subject: "Bid Strategy Performance Monitor: error with account " + accountName,
            htmlBody: "Could not find account with ID: " + accountId + "."
        });
        throw ("Could not find account with ID: " + accountId);
    }

}

function clearSheet(sheet) {
    sheet.getRange(OUTPUT_FIRST_DATA_ROW, 1, sheet.getLastRow(), sheet.getLastColumn()).clear({
        contentsOnly: true
    });
}

function getDates(dates, tz, emails, accountName) {
    var validatedDates = dates.map(function (date) {
        if (date.length === 0) {
            var today = new Date()
            return Utilities.formatDate(today, tz, 'yyyyMMdd');
        } else {
            return Utilities.formatDate(new Date(date), tz, 'yyyyMMdd');
        }
    })
    if (validatedDates[0] <= validatedDates[1]) {
        return validatedDates;
    } else {
        MailApp.sendEmail({
            to: emails.join(),
            subject: "Bid Strategy Performance Monitor: error with account " + accountName,
            htmlBody: ("Invalid date ranges (yyyMMdd): End Date: " +
                validatedDates[1] + " precedes Start date: " + validatedDates[0])
        })
        throw ("Invalid date ranges: End Date: " + validatedDates[1] + "precedes Start Date: " + validatedDates[0]);
    }
}

function makeQueries(dates, campaignNameContains, campaignNameDoesNotContain) {
    var campaignNameContains = campaignNameContains.split(',').map(function (item) {
        return item.trim();
    });
    var campaignNameDoesNotContain = campaignNameDoesNotContain.split(',').map(function (item) {
        return item.trim();
    });
    var campaignFilterQueries = makeCampaignFilterStatements(campaignNameContains, campaignNameDoesNotContain, ignorePausedCampaigns);
    var combinedQueries = combineQueries(dates, campaignFilterQueries);
    return combinedQueries;
}

function makeCampaignFilterStatements(campaignNameContains, campaignNameDoesNotContain, ignorePausedCampaigns) {
    var whereStatement = "WHERE BudgetStatus != REMOVED ";
    var whereStatementsArray = [];


    if (ignorePausedCampaigns) {
        whereStatement += "AND AssociatedCampaignStatus = ENABLED ";
    } else {
        whereStatement += "AND AssociatedCampaignStatus IN ['ENABLED','PAUSED'] ";
    }

    for (var i = 0; i < campaignNameDoesNotContain.length; i++) {
        if (campaignNameDoesNotContain == "") {
            break;;
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


function combineQueries(dates, campaignFilterQueries) {
    var combinedQueries = []
    for (var i = 0; i < campaignFilterQueries.length; i++) {
        combinedQueries.push(campaignFilterQueries[i]
            .concat(" DURING " + dates[0] + "," + dates[1]));
    }
    return combinedQueries;
}

function getAccountCurrencyCode() {
    var report = AdsApp.report("SELECT AccountCurrencyCode FROM ACCOUNT_PERFORMANCE_REPORT");
    var reportRow = report.rows().next();
    return reportRow["AccountCurrencyCode"]
}

function getBudgetData(queries, emails, accountName) {
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
            MailApp.sendEmail({
                to: emails.join(),
                subject: "Bid Strategy Performance Monitor: error with account " + accountName,
                htmlBody: "No campaigns found with the given settings: " + queries[i]
            });
        }
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
    var now = Utilities.formatDate(new Date(), tz, 'dd-MM-yyyy HH:mm:ss');
    sheet.getRange("H2").setValue(now);
}
