// ID: fc3fa40cf15e4a627f4c80daf840f8d0
/**
 *
 * Ad Extensions Reporter
 *
 * Outputs to a spreadsheet all the ad extensions in an account
 *
 * Version: 1.0
 * Google Ads Script maintained on brainlabsdigital.com
 *
 **/

////////////////////////////////////////////////////////////////////////////////
// Options

var spreadsheetUrl = "https://docs.google.com/YOUR-SPREADSHEET-URL-HERE";
// The URL of the Google Doc the results will be put into.

var includeExtensionsWithZeroImpressions = true;
// Keep as true if you also want to see the extensions that aren't being shown. This is the default,
// and recommended if you are using this script to get an overview of all the extensions in your account.
// (In accounts with a very large number of extensions, this script is too slow, so you can change this to 
// false to speed it up. That will exclude extensions with no impressions today.)


////////////////////////////////////////////////////////////////////////////////
// Variables used to get what each ID in the report refers to. Current as of March 2020.

// Placeholder Tables (mapping for Attribute IDs)
var sitelink = {
    name: 'Sitelink',
    1: 'TEXT',
    3: 'LINE 2',
    4: 'LINE 3',
    5: 'FINAL URLS',
    6: 'FINAL MOBILE URLS',
    7: 'TRACKING URL',
    8: 'FINAL URL SUFFIX'
}

var call = {
    name: 'Call',
    1: 'PHONE NUMBER',
    2: 'COUNTRY CODE',
    3: 'TRACKED',
    6: 'CONVERSION TYPE ID'
}

var app = {
    name: 'App',
    1: 'STORE',
    2: 'ID',
    3: 'LINK TEXT',
    4: 'URL',
    5: 'FINAL URLS',
    6: 'FINAL MOBILE URLS',
    7: 'TRACKING URL',
    8: 'FINAL URL SUFFIX'
}

var location = {
    name: 'Location',
    1: 'BUSINESS NAME',
    2: 'ADDRESS LINE 1',
    3: 'ADDRESS LINE 2',
    4: 'CITY',
    5: 'PROVINCE',
    6: 'POSTAL CODE',
    7: 'COUNTRY CODE',
    8: 'PHONE NUMBER'
}

var callout = {
    name: 'Callout',
    1: 'CALLOUT TEXT'
}

var structuredSnippet = {
    name: 'StructuredSnippet',
    1: 'HEADER',
    2: 'VALUES'
}

var affiliateLocation = {
    name: 'AffiliateLocation',
    1: 'BUSINESS NAME',
    2: 'ADDRESS LINE 1',
    3: 'ADDRESS LINE 2',
    4: 'CITY',
    5: 'PROVINCE',
    6: 'POSTAL CODE',
    7: 'COUNTRY CODE',
    8: 'PHONE NUMBER',
    9: 'LANGUAGE CODE',
    10: 'CHAIN ID',
    11: 'CHAIN NAME'
}

var message = {
    name: 'Message',
    1: 'BUSINESS NAME',
    2: 'COUNTRY CODE',
    3: 'PHONE NUMBER',
    4: 'MESSAGE EXTENSION TEXT',
    5: 'MESSAGE TEXT'
}

var price = {
    name: 'Price',
    1: 'TYPE',
    2: 'PRICE_QUALIFIER',
    3: 'TRACKING TEMPLATE',
    4: 'LANGUAGE',
    5: 'FINAL URL SUFFIX',
    100: 'ITEM_1_HEADER',
    101: 'ITEM_1_DESCRIPTION',
    102: 'ITEM_1_PRICE',
    103: 'ITEM_1_UNIT',
    104: 'ITEM_1_FINAL_URL',
    105: 'ITEM_1_FINAL_MOBILE_URL',
    200: 'ITEM_2_HEADER',
    201: 'ITEM_2_DESCRIPTION',
    202: 'ITEM_2_PRICE',
    203: 'ITEM_2_UNIT',
    204: 'ITEM_2_FINAL_URL',
    205: 'ITEM_2_FINAL_MOBILE_URL',
    300: 'ITEM_3_HEADER',
    301: 'ITEM_3_DESCRIPTION',
    302: 'ITEM_3_PRICE',
    303: 'ITEM_3_UNIT',
    304: 'ITEM_3_FINAL_URL',
    305: 'ITEM_3_FINAL_MOBILE_URL',
    400: 'ITEM_4_HEADER',
    401: 'ITEM_4_DESCRIPTION',
    402: 'ITEM_4_PRICE',
    403: 'ITEM_4_UNIT',
    404: 'ITEM_4_FINAL_URL',
    405: 'ITEM_4_FINAL_MOBILE_URL',
    500: 'ITEM_5_HEADER',
    501: 'ITEM_5_DESCRIPTION',
    502: 'ITEM_5_PRICE',
    503: 'ITEM_5_UNIT',
    504: 'ITEM_5_FINAL_URL',
    505: 'ITEM_5_FINAL_MOBILE_URL',
    600: 'ITEM_6_HEADER',
    601: 'ITEM_6_DESCRIPTION',
    602: 'ITEM_6_PRICE',
    603: 'ITEM_6_UNIT',
    604: 'ITEM_6_FINAL_URL',
    605: 'ITEM_6_FINAL_MOBILE_URL',
    700: 'ITEM_7_HEADER',
    701: 'ITEM_7_DESCRIPTION',
    702: 'ITEM_7_PRICE',
    703: 'ITEM_7_UNIT',
    704: 'ITEM_7_FINAL_URL',
    705: 'ITEM_7_FINAL_MOBILE_URL',
    800: 'ITEM_8_HEADER',
    801: 'ITEM_8_DESCRIPTION',
    802: 'ITEM_8_PRICE',
    803: 'ITEM_8_UNIT',
    804: 'ITEM_8_FINAL_URL',
    805: 'ITEM_8_FINAL_MOBILE_URL'
}

var promotion = {
    name: 'Promotion',
    1: 'PROMOTION TARGET',
    2: 'DISCOUNT MODIFIER',
    3: 'PERCENT OFF',
    4: 'MONEY AMOUNT OFF',
    5: 'PROMOTION CODE',
    6: 'ORDERS OVER AMOUNT',
    7: 'PROMOTION START',
    8: 'PROMOTION END',
    9: 'OCCASION',
    10: 'FINAL URLS',
    11: 'FINAL MOBILE URLS',
    12: 'TRACKING URL',
    13: 'LANGUAGE',
    14: 'FINAL URL SUFFIX'
}

var extensionTypeToPlaceholderTables = {
    1: sitelink,
    2: call,
    3: app,
    7: location,
    17: callout,
    24: structuredSnippet,
    30: affiliateLocation,
    31: message,
    35: price,
    38: promotion
}


////////////////////////////////////////////////////////////////////////////////
// Functions

function main() {
    var spreadsheet = checkSpreadsheet(spreadsheetUrl, "Output Spreadsheet");

    Logger.log("Preparing spreadsheet");
    prepareSpreadsheet(spreadsheet);

    // Get report
    Logger.log("Getting report");
    if (typeof includeExtensionsWithZeroImpressions === 'undefined') {
        Logger.log("Warning: options variable includeExtensionsWithZeroImpressions not found. " +
            "Continuing, and by default including extensions that have had no impressions today."
        );
        impressionsCondition = '';
    } else {
        impressionsCondition = getZeroImpressionsCondition(includeExtensionsWithZeroImpressions);
    }
    var placeholderFeedItemReport = AdsApp.report(
        'SELECT PlaceholderType, AttributeValues, DisapprovalShortNames ' +
        'FROM PLACEHOLDER_FEED_ITEM_REPORT ' +
        impressionsCondition +
        'DURING TODAY'
    );
    var reportRows = placeholderFeedItemReport.rows();

    // Process report data, to prepare for outputting to the spreadsheet
    Logger.log("Processing report data");

    var extensionsByType = {};
    while (reportRows.hasNext()) {
        var row = reportRows.next();

        var placeholderTypeId = row['PlaceholderType']
        if (!(placeholderTypeId in extensionTypeToPlaceholderTables)) {
            continue;
        }
        if (!(placeholderTypeId in extensionsByType)) {
            extensionsByType[placeholderTypeId] = {};
        }

        var jsonAttributes = row['AttributeValues'];
        var disapprovalNames = getDisapprovalNamesFromJson(row['DisapprovalShortNames']);

        if (!(jsonAttributes in extensionsByType[placeholderTypeId])) {
            extensionsByType[placeholderTypeId][jsonAttributes] = {};
            extensionsByType[placeholderTypeId][jsonAttributes]['Disapprovals'] = disapprovalNames;
            extensionsByType[placeholderTypeId][jsonAttributes]['FeedItemCount'] = 1;
        } else {
            extensionsByType[placeholderTypeId][jsonAttributes]['FeedItemCount'] += 1;
            updateDisapprovalNamesForExtension(disapprovalNames, extensionsByType[placeholderTypeId][jsonAttributes]);
        }
    }

    // Create a spreadsheet tab for each extension type, and output its data
    Logger.log("Outputting data to spreadsheet");
    for (var placeholderTypeId in extensionsByType) {
        var placeholderTable = extensionTypeToPlaceholderTables[placeholderTypeId];
        var orderedAttributeIds = Object.keys(placeholderTable).sort();
        removeNameFromArray(orderedAttributeIds);

        var newSheet = spreadsheet.insertSheet(placeholderTable.name);
        var headerRowValues = orderedAttributeIds.map(
            function (attributeId) { return placeholderTable[attributeId]; }
        );
        headerRowValues.push("Feed Item Count", "Reasons for Disapproval");
        newSheet.appendRow(headerRowValues).getRange(1, 1, 1, headerRowValues.length).setWrap(true);

        var extensionsOfType = extensionsByType[placeholderTypeId];
        var sheetOutput = [];
        for (var extension in extensionsOfType) {
            var disapprovalNames = extensionsOfType[extension]['Disapprovals'];
            var feedItemCount = extensionsOfType[extension]['FeedItemCount'];
            var rowValues = getExtensionAttributes(extension, orderedAttributeIds);
            rowValues.push(feedItemCount, disapprovalNames.join(','));
            sheetOutput.push(rowValues);
        }

        // Sort extension rows by Feed Item Count, the penultimate value in each row
        sheetOutput.sort(function (rowValuesA, rowValuesB) {
            if (parseInt(rowValuesA.slice(-2)) > parseInt(rowValuesB.slice(-2))) {
                return -1;
            } else if (parseInt(rowValuesA.slice(-2)) < parseInt(rowValuesB.slice(-2))) {
                return 1;
            } else {
                return 0;
            }
        })
        newSheet.getRange(2, 1, sheetOutput.length, sheetOutput[0].length).setValues(sheetOutput);
    }

    // Output overall data to All Extensions tab
    var allExtensionsSheet = spreadsheet.getSheetByName("All Extensions");
    allExtensionsSheet.appendRow(["Extension Type", "Feed Item Count"]);
    var overallExtensionUse = getOverallExtensionUse(extensionsByType, extensionTypeToPlaceholderTables);
    var outputRange = allExtensionsSheet.getRange(2, 1, overallExtensionUse.length, 2);
    outputRange.setValues(overallExtensionUse);

    Logger.log("Done");
}

// Check the spreadsheet URL has been entered, and that it works
function checkSpreadsheet(spreadsheetUrl, spreadsheetName) {
    if (spreadsheetUrl.replace(/[AEIOU]/g, "X") == "https://docs.google.com/YXXR-SPRXXDSHXXT-XRL-HXRX") {
        throw ("Problem with " + spreadsheetName + " URL: make sure you've replaced the default with a valid spreadsheet URL.");
    }
    try {
        var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);

        // Checks if you can edit the spreadsheet
        var sheet = spreadsheet.getSheets()[0];
        var sheetName = sheet.getName();
        sheet.setName(sheetName);

        return spreadsheet;
    } catch (e) {
        throw ("Problem with " + spreadsheetName + " URL: '" + e + "'");
    }
}

// Make sure there is a cleared "All Extensions" sheet
// and delete any sheets with the names of extension types
function prepareSpreadsheet(spreadsheet) {
    var allExtensionsSheet = spreadsheet.getSheetByName("All Extensions");
    if (allExtensionsSheet === null) {
        allExtensionsSheet = spreadsheet.insertSheet("All Extensions");
    }
    allExtensionsSheet.clear();

    var extensionNames = Object.keys(extensionTypeToPlaceholderTables).map(
        function (key) { return extensionTypeToPlaceholderTables[key].name }
    )
    var sheets = spreadsheet.getSheets();
    for (var i = 0, n = sheets.length; i < n; i++) {
        if (extensionNames.indexOf(sheets[i].getName()) !== -1) {
            spreadsheet.deleteSheet(sheets[i]);
        }
    }
}

// Get an expression for filtering out zero impressions extensions if desired
function getZeroImpressionsCondition(includeExtensionsWithZeroImpressions) {
    if (includeExtensionsWithZeroImpressions === true) {
        return '';
    } else if (includeExtensionsWithZeroImpressions === false) {
        return 'WHERE Impressions > 0 ';
    } else {
        throw ("Value of options variable includeExtensionsWithZeroImpressions must be a boolean, either true or false. " +
            "Currently, it is: " + includeExtensionsWithZeroImpressions)
    }
}

function getDisapprovalNamesFromJson(jsonDisapprovalNames) {
    if ('' === jsonDisapprovalNames.toString()) {
        return [];
    } else {
        return JSON.parse(jsonDisapprovalNames);
    };
}

// Add any names it doesn't already have to the extension's disapproval names
function updateDisapprovalNamesForExtension(newDisapprovalNames, extension) {
    for (var i = 0, n = newDisapprovalNames.length; i < n; i++) {
        var disapprovalName = newDisapprovalNames[i];
        var previouslyFoundDisapprovalNames = extension['Disapprovals'];
        if (previouslyFoundDisapprovalNames.indexOf(disapprovalName) === -1) {
            extension['Disapprovals'] =
                previouslyFoundDisapprovalNames.concat(disapprovalName);
        }
    }
}

function removeNameFromArray(arrayWithNameKey) {
    var nameIndex = arrayWithNameKey.indexOf('name');
    arrayWithNameKey.splice(nameIndex, 1);
}

function getExtensionAttributes(extensionJson, orderedAttributeIds) {
    var parsedExtension = JSON.parse(extensionJson);
    return orderedAttributeIds.map(
        function (attributeId) {
            if (parsedExtension.hasOwnProperty(attributeId)) {
                return parsedExtension[attributeId].toString();
            } else {
                return '';
            }
        }
    );
}

// Get an array of [ExtensionTypeName, OverallFeedItemCount] pairs
function getOverallExtensionUse(extensionsByType, extensionTypeToPlaceholderTables) {
    var foundExtensionTypeIds = Object.keys(extensionsByType);
    var overallExtensionUse = foundExtensionTypeIds.map(
        function (placeholderTypeId) {
            return [
                extensionTypeToPlaceholderTables[placeholderTypeId].name,
                Object.keys(extensionsByType[placeholderTypeId]).reduce(
                    function (overallCount, extensionJson) {
                        return overallCount + extensionsByType[placeholderTypeId][extensionJson]['FeedItemCount'];
                    }, 0
                )
            ];
        }
    ).sort(
        function (a, b) {
            if (a[1] > b[1]) {
                return -1;
            } else if (a[1] < b[1]) {
                return 1;
            } else {
                return 0;
            }
        }
    );
    for (var placeholderTypeId in extensionTypeToPlaceholderTables) {
        if (foundExtensionTypeIds.indexOf(placeholderTypeId) === -1) {
            overallExtensionUse.push([extensionTypeToPlaceholderTables[placeholderTypeId].name, 0]);
        }
    }
    return overallExtensionUse;
}
