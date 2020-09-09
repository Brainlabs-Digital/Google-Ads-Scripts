// ID: 49b262a518e68d401b6a69f62ddf5d05
/**
 * Brainlabs Auctions Insights Report Generator
 *
 * This script will take data from an Auctions Insights reports and create reports
 * and charts showing the changes over time for your your domain and selected
 * competitors over time.
 *
 * Version: 3.0
 * Google Apps Script maintained on brainlabsdigital.com
 */


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Information about the different columns of the Auctions Insights report
// (Will only be included  if column names are given in English)
var subtitle = {};
subtitle['Impr. share'] = 'How often a participant received an impression, as a proportion of the auctions in which you were also competing.';
subtitle['Avg. position'] = 'The average position on the search results page for the participant’s ads when they received an impression.';
subtitle['Overlap rate'] = "How often another participant's ad received an impression when your ad also received an impression.";
subtitle['Position above rate'] = 'When you and another participant received an impression in the same auctions, % when participant’s ad was shown in a higher position.';
subtitle['Top of page rate'] = 'When a participant’s ads received impressions, how often it appeared at the top of the page above the search results.';
subtitle['Outranking share'] = "How often your ad ranked higher in the auction than another participant's ad, or your ad showed when theirs did not.";


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// The function to keep the prefills in the setting sheet up-to-date
function onEdit() {
  // Find the sheets that give settings and data
  var settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');

  if (settingsSheet == null) {
    return;
  }

  var totalSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Auction Insights');
  var byDeviceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Auction Insights By Device');

  if (totalSheet != null) {
    // Get the column names and copy to the settings sheet
    var columnHeaders = getHeaders(totalSheet);
    if (columnHeaders[0] != '') {
      settingsSheet.getRange('ColumnNames').setValues([columnHeaders.concat(['', '', '', '', '', '']).slice(2, 8)]);
    }

    if (settingsSheet.getRange('competitorListAutoRefresh').getValue().toLowerCase() == 'yes') {
      listCompetitors();
    }
  }

  // Get the device names, and copy to the settings sheet
  if (byDeviceSheet != null && byDeviceSheet.getLastRow() > 1) {
    var columnHeaders = getHeaders(byDeviceSheet).map(function (a) {
      return a.toLowerCase();
    });
    var deviceColumnName = settingsSheet.getRange('deviceColumnName').getValue().toLowerCase();
    var deviceIndex = columnHeaders.indexOf(deviceColumnName);
    if (deviceColumnName != '' && deviceIndex != -1) {
      var deviceNames = [];
      var deviceNamesInColumn = [];
      var allDeviceNames = byDeviceSheet.getRange(3, deviceIndex + 1, 100, 1).getValues();
      for (var d = 0; d < allDeviceNames.length; d++) {
        if (allDeviceNames[d][0].toString() == '' || allDeviceNames[d][0].toString().toLowerCase() == deviceColumnName) {
          continue;
        }
        if (deviceNames.indexOf(allDeviceNames[d][0]) == -1) {
          deviceNames.push(allDeviceNames[d][0]);
          deviceNamesInColumn.push([allDeviceNames[d][0]]);
        }
        Logger.log(allDeviceNames[d][0]);
        if (deviceNamesInColumn.length >= 3) {
          break;
        }
      }
      Logger.log(deviceNamesInColumn);
      settingsSheet.getRange('DeviceNames').setValues(deviceNamesInColumn.slice(0, 3));
    }
  }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// This function takes the competitor names from the totals sheet,
// and lists them in the Settings sheet.
function listCompetitors() {
  var settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  var totalSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Auction Insights');

  if (settingsSheet == null || totalSheet == null) {
    return;
  }

  // Get the column names and copy to the settings sheet
  var columnHeaders = getHeaders(totalSheet).map(function (a) {
    return a.toLowerCase();
  });
  var displayDomainColumnName = settingsSheet.getRange('displayDomainColumnName').getValue();
  var domainIndex = columnHeaders.indexOf(displayDomainColumnName.toLowerCase());
  if (displayDomainColumnName != '' && domainIndex != -1) {
    var namesInColumn = getCompetitorsByMaxImprShare(settingsSheet, totalSheet, domainIndex);
    settingsSheet.getRange('CompetitorNames').setValues(namesInColumn);
  }
}


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// This function removes any existing report sheets
function deleteReports() {
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();

  var nonReportSheetNames = ['Settings', 'Auction Insights', 'Auction Insights By Device', 'Performance Data'];

  for (var i = 0; i < sheets.length; i++) {
    if (nonReportSheetNames.indexOf(sheets[i].getName()) < 0) {
      SpreadsheetApp.getActiveSpreadsheet().deleteSheet(sheets[i]);
    }
  }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// This function goes through the Settings sheet to find the reports to make,
// and makes them
function generateReports() {
  // Find the sheets that give settings and data
  var sheetNames = ['Settings', 'Auction Insights', 'Auction Insights By Device', 'Performance Data'];
  var sheet = {};
  for (var i = 0; i < sheetNames.length; i++) {
    sheet[sheetNames[i]] = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetNames[i]);
    if (sheet[sheetNames[i]] == null) {
      Browser.msgBox('The ' + sheetNames[i] + ' sheet could not be found. Please check you have not deleted or renamed it.');
      return;
    }
  }

  var youName = sheet.Settings.getRange('youName').getValue();
  var dateName = sheet.Settings.getRange('dateColumnName').getValue();
  var domainName = sheet.Settings.getRange('displayDomainColumnName').getValue();

  if (youName == '') {
    Browser.msgBox('You name is blank. Please make sure you have entered the name that the report uses when giving your performance.');
    return;
  }
  if (dateName == '') {
    Browser.msgBox('Date column name is blank. Please make sure you have entered a name for the date column.');
    return;
  }
  if (domainName == '') {
    Browser.msgBox('Display URL Domain column name is blank. Please make sure you have entered a name for the Display URL Domain column.');
    return;
  }


  // Get a list of competitors

  var allCompetitorNames = sheet.Settings.getRange('CompetitorNames').getValues();
  var competitorNameSelection = sheet.Settings.getRange('CompetitorNameSelection').getValues();
  var competitors = [];
  var orderedCompetitors = {};
  for (var i = 0; i < allCompetitorNames.length; i++) {
    if (competitorNameSelection[i][0] != '' && allCompetitorNames[i][0] != '') {
      competitors.push(allCompetitorNames[i][0]);
      if (!isNaN(competitorNameSelection[i][0])) {
        orderedCompetitors[allCompetitorNames[i][0]] = competitorNameSelection[i][0];
      }
    }
  }

  var includeAllCompetitors = sheet.Settings.getRange('includeAllCompetitors').getValue().toLowerCase();
  if (includeAllCompetitors == 'yes') {
    competitors = getAllCompetitors(sheet['Auction Insights'], youName, domainName);
  }

  // Get list of stats
  var statsToReport = [];
  var statsInChart = [];
  var statsToReportTable = sheet.Settings.getRange('StatsToReport').getValues();
  for (var i = 0; i < statsToReportTable.length; i++) {
    if (statsToReportTable[i][1].toLowerCase() == 'yes') {
      statsToReport.push(statsToReportTable[i][0]);
    }
    if (statsToReportTable[i][2].toLowerCase() == 'yes' && statsInChart.length < 2) {
      statsInChart.push(statsToReportTable[i][0]);
      if (statsToReportTable[i][1].toLowerCase() != 'yes') {
        statsToReport.push(statsToReportTable[i][0]);
      }
    }
  }

  if (statsToReport.length > 0) {
    var statsReadable = sheet['Performance Data'].getLastColumn() > 0;

    if (statsReadable) {
      var statNames = [];
      statNames.Clicks = sheet.Settings.getRange('clicksColumnName').getValue();
      statNames.Impressions = sheet.Settings.getRange('impressionsColumnName').getValue();
      statNames.Cost = sheet.Settings.getRange('costColumnName').getValue();

      for (var statName in statNames) {
        if (statNames[statName] == '') {
          Browser.msgBox(statName + ' column name is blank. Please make sure you have entered a name for the ' + statName.toLowerCase() + ' column if you want stats to be reported.');
          statsReadable = false;
          break;
        }
      }
    }

    if (statsReadable) {
      var statHeaders = getHeaders(sheet['Performance Data']).map(function (a) {
        return a.toLowerCase();
      });
      var nonBlankHeaders = statHeaders.filter(function (a) {
        return a != '';
      });
      if (nonBlankHeaders.length == 0) {
        Browser.msgBox("No headers found in the 'Performance Data' sheet. Please make sure you have copied in your data if you want stats to be reported.");
        statsReadable = false;
      }
    }

    if (statsReadable) {
      if (statHeaders.indexOf(statNames.Impressions.toLowerCase()) < 0
        && statHeaders.indexOf('impr.') >= 0) {
        statNames.Impressions = 'impr.';
      }


      for (var statName in statNames) {
        if (statHeaders.indexOf(statNames[statName].toLowerCase()) < 0) {
          if (statName == 'Impressions' && getStatColumnIndex(sheet.Settings, statHeaders, 'impressionsColumnName') >= 0) {
            continue;
          } else if (statName == 'Clicks' && getStatColumnIndex(sheet.Settings, statHeaders, 'clicksColumnName') >= 0) {
            continue;
          }

          Browser.msgBox('Could not find the ' + statName.toLowerCase() + " column '" + statNames[statName] + "'. Please check it is typed correctly if you want stats to be reported.");
          statsReadable = false;
          break;
        }
      }
    }

    if (!statsReadable) {
      statsToReport = [];
      statsInChart = [];
    }
  }

  var deviceNames = sheet.Settings.getRange('DeviceNames').getValues();
  var columnNames = sheet.Settings.getRange('ColumnNames').getValues()[0];
  var reportsToBeMadeTable = sheet.Settings.getRange('ReportsToMake').getValues();
  var reportCount = 0;

  // Reports for 'Total'
  var totalSheetChecked = false;
  for (var j = 0; j < columnNames.length; j++) {
    if (reportsToBeMadeTable[0][j].toLowerCase() == 'yes' && columnNames[j] != '') {
      reportCount++;
      if (!totalSheetChecked) {
        var totalSheetFilledIn = checkSheetIsFilledIn(sheet.Settings, sheet['Auction Insights'], 'Auction Insights', dateName, domainName, youName);
        if (totalSheetFilledIn) {
          totalSheetChecked = true;
        } else {
          totalSheetChecked = null;
          break;
        }
      }
      makeReport(columnNames[j], 'Total', competitors, orderedCompetitors, statsToReport, statsInChart);
    }
  }

  // Reports for each device
  var deviceSheetChecked = false;
  for (var i = 0; i < deviceNames.length; i++) {
    for (var j = 0; j < columnNames.length; j++) {
      if (reportsToBeMadeTable[i + 1][j].toLowerCase() == 'yes' && columnNames[j] != '') {
        reportCount++;
        if (!deviceSheetChecked) {
          var deviceSheetFilledIn = checkSheetIsFilledIn(sheet.Settings, sheet['Auction Insights By Device'], 'Auction Insights By Device', dateName, domainName, youName);
          if (deviceSheetFilledIn) {
            deviceSheetChecked = true;
          } else {
            deviceSheetChecked = null;
            break;
          }
        }
        makeReport(columnNames[j], deviceNames[i][0], competitors, orderedCompetitors, statsToReport, statsInChart);
      }
    }
  }

  if (totalSheetChecked == null || deviceSheetChecked == null) {
    return;
  }

  // 'Compare All Devices' reports
  for (var j = 0; j < columnNames.length; j++) {
    if (reportsToBeMadeTable[4][j].toLowerCase() == 'yes' && columnNames[j] != '') {
      reportCount++;
      if (!totalSheetChecked) {
        var totalSheetFilledIn = checkSheetIsFilledIn(sheet.Settings, sheet['Auction Insights'], 'Auction Insights', dateName, domainName, youName);
        if (totalSheetFilledIn) {
          totalSheetChecked = true;
        } else {
          break;
        }
      }
      if (!deviceSheetChecked) {
        var deviceSheetFilledIn = checkSheetIsFilledIn(sheet.Settings, sheet['Auction Insights By Device'], 'Auction Insights By Device', dateName, domainName, youName);
        if (deviceSheetFilledIn) {
          deviceSheetChecked = true;
        } else {
          break;
        }
      }
      makeAllDeviceReport(columnNames[j], statsToReport, statsInChart);
    }
  }

  if (reportCount == 0) {
    Browser.msgBox('No reports requested to be made.');
  }
}


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// The function to make reports comparing domains for a particular column header
// 'device' is a string indicating which device the report is for
// 'competitors' is an array of competitor names to include
// 'statsToReport' is an array of the stats to add to the data table
// 'statsInChart' is an array of the stats to add to the chart
function makeReport(columnHeader, device, competitors, orderedCompetitors, statsToReport, statsInChart) {
  var displayColumnHeader = getDisplayName(columnHeader);
  var displayDevice = getDisplayName(device);

  // If the report's sheet exists, delete it
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(displayColumnHeader + ' - ' + displayDevice);
  if (sheet != null) {
    SpreadsheetApp.getActiveSpreadsheet().deleteSheet(sheet);
  }

  // Create a new sheet for the report
  var sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(displayColumnHeader + ' - ' + displayDevice);

  // Get the existing sheets for the settings and data
  var settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  var performanceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Performance Data');
  if (device == 'Total') {
    var dataSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Auction Insights');
  } else {
    var dataSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Auction Insights By Device');
  }

  var youName = settingsSheet.getRange('youName').getValue();
  var youNameLowerCase = youName.toLowerCase();
  var data = getDataByDate(settingsSheet, dataSheet, columnHeader, device, competitors, youNameLowerCase, false);
  var dates = data.dates;
  var domains = data.data;
  var domainNames = data.domainNames;

  if (statsToReport.indexOf('Searches') != -1) {
    var allColumnHeaders = settingsSheet.getRange('ColumnNames').getValues()[0];
    var imprShareName = allColumnHeaders[0];
    var imprShareData = getDataByDate(settingsSheet, dataSheet, imprShareName, device, [], youNameLowerCase, false).data;
  } else {
    var imprShareData = {};
  }

  var statData = getStatByDate(settingsSheet, performanceSheet, statsToReport, device);
  // Get the total impressions, cost and clicks to calculate CPC, etc

  dates.sort();
  // Sorts the dates alphabetically - as they're in bigendian format, this means they are sorted oldest to newest

  domainNames.sort(compareDomainNames);
  // Sorts the domain names by their highest impression share, using the function below

  function compareDomainNames(a, b) {
    // user defined ordering has priority
    var aHasOrder = orderedCompetitors[a] != undefined;
    var bHasOrder = orderedCompetitors[b] != undefined;

    if (aHasOrder && !bHasOrder) {
      return -1;
    } if (!aHasOrder && bHasOrder) {
      return 1;
    } if (aHasOrder && bHasOrder) {
      return orderedCompetitors[a] - orderedCompetitors[b];
    }

    // otherwise use max impression share
    var aIsString = typeof (domains[a]['Max Impr Share']) === 'string';
    var bIsString = typeof (domains[b]['Max Impr Share']) === 'string';
    if (aIsString && !bIsString) {
      return 1;
    } if (!aIsString && bIsString) {
      return -1;
    } if (!aIsString && !bIsString && domains[a]['Max Impr Share'] != domains[b]['Max Impr Share']) {
      // If the max impression shares are different, the domain with the highest is put first
      return domains[b]['Max Impr Share'] - domains[a]['Max Impr Share'];
    }
    // If both domains have the same max impression share, the one with data for the most dates is put first
    return Object.keys(domains[b]).length - Object.keys(domains[a]).length;
  }

  var includeYou = false;
  for (var i = 0; i < dates.length; i++) {
    if (domains[youNameLowerCase] != undefined && domains[youNameLowerCase][dates[i]] != undefined && domains[youNameLowerCase][dates[i]] != '--') {
      includeYou = true;
      break;
    }
  }

  domainNames.splice(domainNames.indexOf(youNameLowerCase), 1);
  // Removes "You" from the array

  if (includeYou) {
    // If this graph is supposed to include 'You', then it's added to the start of the array
    domainNames.unshift(youName);
  }

  // The first row of the report sheet is the column name
  if (device == 'Total') {
    sheet.getRange('A1').setValue(displayColumnHeader);
  } else {
    sheet.getRange('A1').setValue(displayColumnHeader + ' - ' + displayDevice);
  }
  sheet.getRange('A1').setFontWeight('bold');

  // Check there is data
  if (!includeYou && competitors.length == 0) {
    sheet.getRange('A2').setValue('No competitors are selected, so there is no data to show.');
    Browser.msgBox("No competitors are selected, so there is no data to show in the '" + displayColumnHeader + ' - ' + displayDevice + "' report.");
    return;
  }
  if (domainNames.length == 0) {
    sheet.getRange('A2').setValue('No data was found for this report.');
    return;
  }

  // The second row of the report sheet is the headings
  var outputHeaders = ['Date'];
  for (var i = 0; i < statsToReport.length; i++) {
    outputHeaders.push(getDisplayName(statsToReport[i]));
  }
  for (var d = 0; d < domainNames.length; d++) {
    outputHeaders.push(getDisplayName(domainNames[d]));
  }
  sheet.getRange(2, 1, 1, outputHeaders.length).setValues([outputHeaders]);
  sheet.getRange(2, 1, 1, outputHeaders.length).setFontWeight('bold');

  // 'output' is a multi-dimensional array that will become the rest of the cells in the spreadsheet
  var output = [];

  // We loop though the dates to make their lines of output
  // (the date, the CPC, then each domain's metric)
  for (var i = 0; i < dates.length; i++) {
    output[i] = [stringToDate(dates[i])];

    for (var j = 0; j < statsToReport.length; j++) {
      output[i].push(calculateStat(statsToReport[j], statData, dates[i], imprShareData[youNameLowerCase]));
    }

    for (var d = 0; d < domainNames.length; d++) {
      if (domains[domainNames[d].toLowerCase()][dates[i]] === undefined || domains[domainNames[d].toLowerCase()][dates[i]] === '--') {
        if (columnHeader.toLowerCase() == 'avg. position') {
          output[i].push('');
        } else {
          output[i].push(0);
        }
      } else {
        output[i].push(domains[domainNames[d].toLowerCase()][dates[i]]);
      }
    }
  }

  // Write the data to the sheet
  sheet.getRange(3, 1, output.length, output[0].length).setValues(output);

  // Format the tables
  var dateFormat = settingsSheet.getRange('dateFormat').getValue();
  var currencySymbol = settingsSheet.getRange('currencySymbol').getValue();
  for (var i = 0; i < outputHeaders.length; i++) {
    if (outputHeaders[i] == 'Date') {
      sheet.getRange(3, i + 1, output.length).setNumberFormat(dateFormat);
    } else if (outputHeaders[i] == 'CPC') {
      sheet.getRange(3, i + 1, output.length).setNumberFormat(currencySymbol + '0.00');
    } else if (outputHeaders[i] == 'Impressions' || outputHeaders[i] == 'Searches') {
      sheet.getRange(3, i + 1, output.length).setNumberFormat('#,###,##0');
    } else if (outputHeaders[i].substr(-3) == 'CTR') {
      sheet.getRange(3, i + 1, output.length).setNumberFormat('0.00%');
    } else if (columnHeader == 'Avg. position' || sheet.getRange(4, i + 1).getValue() >= 1) {
      // average position is not a percentage
      sheet.getRange(3, i + 1, output.length).setNumberFormat('0.0');
    } else {
      sheet.getRange(3, i + 1, output.length).setNumberFormat('0.00%');
    }
  }

  // Centralise the data
  sheet.getRange(2, 1, output.length + 1, output[0].length).setHorizontalAlignment('center');

  // Make the chart
  // Get the width in pixels for the chart, so the chart is 11 columns wide
  var width = 0;
  for (var i = 1; i < 12; i++) {
    width += sheet.getColumnWidth(i);
  }

  // Remove stat columns if there's no impressions, as that suggests there's
  // a problem with the data (and the graph will be flat anyway)
  if (statData.zeroImpressions) {
    statsInChart = [];
  }

  // Creates the chart
  var chartTitle = displayColumnHeader;
  if (typeof subtitle[columnHeader] !== 'undefined') {
    chartTitle = displayColumnHeader + ' - ' + subtitle[columnHeader];
  }

  var chartBuilder = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)

    .setOption('chartArea', {
      left: '10%',
      top: '15%',
      width: '80%',
      height: '70%'
    })
    .setPosition(4 + output.length, 1, 0, 0)
    .setOption('width', width)
    .setOption('height', 500)
    .setOption('title', chartTitle)
    .setOption('legend', {
      position: 'top'
    });

  var statFormat = {
    CPC: 'currency',
    CTR: 'percent',
    Impressions: 'decimal',
    Searches: 'decimal'
  };

  if (statsInChart.length == 0) {
    chartBuilder.setOption('vAxes', {
      // Adds titles to the axis.
      0: {
        title: displayColumnHeader
      }
    });
  } else if (statsInChart.length == 1) {
    chartBuilder.setOption('vAxes', {
      // Adds titles to both axes.
      0: {
        title: displayColumnHeader
      },
      1: {
        title: statsInChart[0],
        format: statFormat[statsInChart[0]]
      }
    });
  } else {
    chartBuilder.setOption('vAxes', {
      // Adds title to the first axis, blanks the others.
      0: {
        title: displayColumnHeader
      },
      1: {
        format: statFormat[statsInChart[0]],
        textPosition: 'in'
      },
      2: {
        format: statFormat[statsInChart[1]],
        textPosition: 'out'
      },
      3: {
        textStyle: {
          color: 'white'
        }
      }
    });
  }

  var seriesOptions = [];
  var statColours = ['#999999', '#a2c4c9']; // grey, grey-blue
  var statDashStyles = [
    [10, 5],
    [3, 3]
  ]; // dashed, dotted
  var regularColours = ['#3366cc', '#dc3912', '#ff9900', '#109618', '#994499', '#ea9999']; // blue, red, yellow, green, purple, pink

  chartBuilder.addRange(sheet.getRange(2, 1, output.length + 1, 1)); // Date
  for (var j = 0; j < statsToReport.length; j++) {
    var statIndex = statsInChart.indexOf(statsToReport[j]);
    if (statIndex != -1) {
      chartBuilder.addRange(sheet.getRange(2, j + 2, output.length + 1, 1));
      seriesOptions.push({
        targetAxisIndex: statIndex + 1,
        lineDashStyle: statDashStyles[statIndex],
        color: statColours[statIndex]
      });
    }
  }

  if (domainNames.length < regularColours.length) {
    var numberOfColumns = domainNames.length;
  } else {
    var numberOfColumns = regularColours.length;
  }
  if (includeYou) {
    numberOfColumns++;
  }

  chartBuilder.addRange(sheet.getRange(2, statsToReport.length + 2, output.length + 1, numberOfColumns)); // You and Competitors

  if (includeYou) {
    // Format the 'You' line to be black and thicker
    seriesOptions.push({
      targetAxisIndex: 0,
      color: '#000000',
      lineWidth: 4
    });
  }

  // Format the competitor lines
  for (var i = 0; i < output[0].length - statsToReport.length - 2 && i < regularColours.length; i++) {
    seriesOptions.push({
      targetAxisIndex: 0,
      color: regularColours[i]
    });
  }

  chartBuilder.setOption('series', seriesOptions);

  var chart = chartBuilder.build();
  sheet.insertChart(chart);
}


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// The function to make reports comparing your performance on different devices for
// a particular column header
function makeAllDeviceReport(columnHeader, statsToReport, statsInChart) {
  var displayColumnHeader = getDisplayName(columnHeader);

  // If the report's sheet exists, delete it
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(displayColumnHeader + ' - All Devices');
  if (sheet != null) {
    SpreadsheetApp.getActiveSpreadsheet().deleteSheet(sheet);
  }
  // Create a new sheet for the report
  var sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(displayColumnHeader + ' - All Devices');

  // Find the sheets that give settings and data
  var settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  var totalSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Auction Insights');
  var byDeviceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Auction Insights By Device');
  var performanceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Performance Data');

  var youName = settingsSheet.getRange('youName').getValue();
  var youNameLowerCase = youName.toLowerCase();
  var totalData = getDataByDate(settingsSheet, totalSheet, columnHeader, 'Total', [], youNameLowerCase, false);
  var deviceData = getDataByDate(settingsSheet, byDeviceSheet, columnHeader, 'Total', [], youNameLowerCase, true);

  var dates = totalData.dates;
  for (var i = 0; i < deviceData.dates.length; i++) {
    if (dates.indexOf(deviceData.dates[i]) == -1) {
      dates.push(deviceData.dates[i]);
    }
  }

  // Get the other stats from the performance sheet
  var totalStats = getStatByDate(settingsSheet, performanceSheet, statsToReport, 'Total');
  var deviceStats = {};
  for (var d = 0; d < deviceData.domainNames.length && d < 6; d++) {
    deviceStats[deviceData.domainNames[d]] = getStatByDate(settingsSheet, performanceSheet, statsToReport, deviceData.domainNames[d]);
  }

  if (statsToReport.indexOf('Searches') != -1) {
    var totalImprShare = getDataByDate(settingsSheet, totalSheet, 'Impr. share', 'Total', [], youNameLowerCase, false).data;
    var deviceImprShare = getDataByDate(settingsSheet, byDeviceSheet, 'Impr. share', 'Total', [], youNameLowerCase, true).data;
  } else {
    var deviceImprShare = {};
    var totalImprShare = {};
  }

  dates.sort();
  // Sorts the dates alphabetically - as they're in bigendian format, this means they are sorted oldest to newest


  var deviceDisplayNames = [];
  for (var d = 0; d < deviceData.domainNames.length; d++) {
    deviceDisplayNames[d] = getDisplayName(deviceData.domainNames[d]);
  }
  var statDisplayNames = [];
  for (var i = 0; i < statsToReport.length; i++) {
    statDisplayNames[i] = getDisplayName(statsToReport[i]);
  }

  // The first row of the report sheet is the report name
  sheet.getRange('A1').setValue(displayColumnHeader + ' - All Devices');
  sheet.getRange('A1').setFontWeight('bold');

  // The second row of the report sheet is the headings
  var outputHeaders = ['Date'];
  for (var i = 0; i < statDisplayNames.length; i++) {
    outputHeaders.push('Total ' + statDisplayNames[i]);
    for (var d = 0; d < deviceDisplayNames.length; d++) {
      outputHeaders.push(deviceDisplayNames[d] + ' ' + statDisplayNames[i]);
    }
  }
  outputHeaders.push('Total ' + columnHeader);
  for (var d = 0; d < deviceDisplayNames.length; d++) {
    outputHeaders.push(deviceDisplayNames[d] + ' ' + displayColumnHeader);
  }
  sheet.getRange(2, 1, 1, outputHeaders.length).setValues([outputHeaders]);
  sheet.getRange(2, 1, 1, outputHeaders.length).setFontWeight('bold');

  // 'output' is a multi-dimensional array that will become the rest of the cells in the spreadsheet
  var output = [];

  // We loop though the dates to make their lines of output
  for (var i = 0; i < dates.length; i++) {
    output[i] = [stringToDate(dates[i])];

    for (var j = 0; j < statsToReport.length; j++) {
      output[i].push(calculateStat(statsToReport[j], totalStats, dates[i], totalImprShare[youNameLowerCase]));
      for (var d = 0; d < deviceData.domainNames.length; d++) {
        output[i].push(calculateStat(statsToReport[j], deviceStats[deviceData.domainNames[d]], dates[i], deviceImprShare[deviceData.domainNames[d]]));
      }
    }

    if (totalData.data[youNameLowerCase][dates[i]] === undefined || totalData.data[youNameLowerCase][dates[i]] == '--') {
      if (columnHeader.toLowerCase() == 'avg. position') {
        output[i].push('');
      } else {
        output[i].push(0);
      }
    } else {
      output[i].push(totalData.data[youNameLowerCase][dates[i]]);
    }

    for (var d = 0; d < deviceData.domainNames.length; d++) {
      if (deviceData.data[deviceData.domainNames[d]][dates[i]] === undefined || deviceData.data[deviceData.domainNames[d]][dates[i]] === '--') {
        if (columnHeader.toLowerCase() == 'avg. position') {
          output[i].push('');
        } else {
          output[i].push(0);
        }
      } else {
        output[i].push(deviceData.data[deviceData.domainNames[d]][dates[i]]);
      }
    }
  }

  // Write the data to the sheet
  sheet.getRange(3, 1, output.length, output[0].length).setValues(output);

  // Format the tables
  var dateFormat = settingsSheet.getRange('dateFormat').getValue();
  var currencySymbol = settingsSheet.getRange('currencySymbol').getValue();
  for (var i = 0; i < outputHeaders.length; i++) {
    if (outputHeaders[i] == 'Date') {
      sheet.getRange(3, i + 1, output.length).setNumberFormat(dateFormat);
    } else if (outputHeaders[i].substr(-3) == 'CPC') {
      sheet.getRange(3, i + 1, output.length).setNumberFormat(currencySymbol + '0.00');
    } else if (outputHeaders[i].substr(-11) == 'Impressions' || outputHeaders[i].substr(-11) == 'Impr.' || outputHeaders[i].substr(-8) == 'Searches') {
      sheet.getRange(3, i + 1, output.length).setNumberFormat('#,###,##0');
    } else if (outputHeaders[i].substr(-3) == 'CTR') {
      sheet.getRange(3, i + 1, output.length).setNumberFormat('0.00%');
    } else if (columnHeader == 'Avg. position' || sheet.getRange(4, i + 1).getValue() >= 1) {
      // must be average position
      sheet.getRange(3, i + 1, output.length).setNumberFormat('0.0');
    } else {
      sheet.getRange(3, i + 1, output.length).setNumberFormat('0.00%');
    }
  }

  // Centralise the data
  sheet.getRange(3, 1, output.length, output[0].length).setHorizontalAlignment('center');

  // Make the chart
  // Get the width in pixels for the chart, so the chart is 11 columns wide
  var width = 0;
  for (var i = 1; i < 12; i++) {
    width += sheet.getColumnWidth(i);
  }

  // Remove stat columns if there's no impressions, as that suggests there's
  // a problem with the data (and the graph will be flat anyway)
  if (totalStats.zeroImpressions) {
    statsInChart = [];
  }

  // Creates the chart
  var chartTitle = displayColumnHeader;
  if (typeof subtitle[columnHeader] !== 'undefined') {
    chartTitle = chartTitle + ' - ' + subtitle[columnHeader];
  }
  var chartBuilder = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .setOption('chartArea', {
      left: '10%',
      top: '15%',
      width: '80%',
      height: '70%'
    })
    .setPosition(4 + output.length, 1, 0, 0)
    .setOption('width', width)
    .setOption('height', 500)
    .setOption('title', chartTitle)
    .setOption('legend', {
      position: 'top'
    });

  var statFormat = {
    CPC: 'currency',
    CTR: 'percentage',
    Impressions: 'decimal',
    Searches: 'decimal'
  };

  if (statsInChart.length == 0) {
    chartBuilder.setOption('vAxes', {
      // Adds titles to the axis.
      0: {
        title: displayColumnHeader
      }
    });
  } else if (statsInChart.length == 1) {
    chartBuilder.setOption('vAxes', {
      // Adds titles to both axes.
      0: {
        title: displayColumnHeader
      },
      1: {
        title: statDisplayNames[0],
        format: statFormat[statsInChart[0]]
      }
    });
  } else {
    chartBuilder.setOption('vAxes', {
      // Adds title to the first axis, blanks the others.
      0: {
        title: displayColumnHeader
      },
      1: {
        textStyle: {
          color: 'white'
        }
      },
      2: {
        title: statDisplayNames[1],
        format: statFormat[statsInChart[1]]
      },
      3: {
        textStyle: {
          color: 'white'
        }
      }
    });
  }

  var seriesOptions = [];
  var colours = [];
  colours.push(['#3366cc', '#dc3912', '#ff9900', '#109618']); // blue, red, yellow, green
  colours.push(['#9fc5e8', '#ea9999', '#f9cb9c', '#b6d7a8']);

  var lineDashStyles = [];
  lineDashStyles.push([10, 5]);
  lineDashStyles.push([3, 3]);

  chartBuilder.addRange(sheet.getRange(2, 1, output.length + 1, 1)); // Date

  for (var j = 0; j < statsToReport.length; j++) {
    var statIndex = statsInChart.indexOf(statsToReport[j]);
    if (statIndex != -1) {
      chartBuilder.addRange(sheet.getRange(2, (4 * j) + 2, output.length + 1, 4));
      for (var x = 0; x < 4; x++) {
        seriesOptions.push({
          targetAxisIndex: statIndex + 1,
          lineDashStyle: lineDashStyles[statIndex],
          color: colours[statIndex][x]
        });
      }
    }
  }
  chartBuilder.addRange(sheet.getRange(2, (4 * statsToReport.length) + 2, output.length + 1, 4));
  for (var x = 0; x < 4; x++) {
    seriesOptions.push({
      targetAxisIndex: 0,
      color: colours[0][x]
    });
  }

  chartBuilder.setOption('series', seriesOptions);

  var chart = chartBuilder.build();
  sheet.insertChart(chart);
}


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// The function calculates a stat, or returns 0 if there is no data or that stat would
// involve dividing by zero
function calculateStat(stat, statData, date, imprShareData) {
  switch (stat) {
    case 'CPC':
      if (statData.cost[date] == undefined || statData.clicks[date] == undefined || statData.clicks[date] == 0) {
        return 0;
      }
      return statData.cost[date] / statData.clicks[date];

      break;

    case 'CTR':
      if (statData.impr[date] == undefined || statData.clicks[date] == undefined || statData.impr[date] == 0) {
        return 0;
      }
      return statData.clicks[date] / statData.impr[date];

      break;

    case 'Impressions':
      if (statData.impr[date] == undefined) {
        return 0;
      }
      return statData.impr[date];

      break;

    case 'Searches':
      if (statData.impr[date] == undefined || imprShareData[date] == undefined || imprShareData[date] == 0) {
        return 0;
      }
      return statData.impr[date] / imprShareData[date];

      break;
  }
}


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// The function to take the data from the data sheet organised by date and by domain
// name or (if recordDeviceAsDomain is true) by device
function getDataByDate(settingsSheet, dataSheet, columnHeader, device, competitors, youName, recordDeviceAsDomain) {
  // Dates are stored as bigendian date strings, then converted back to dates at the end
  var bigendianDate = 'yyyy-MM-dd';
  // The timezone is used to convert them back
  var timezone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

  var domains = {};
  var dates = [];
  var domainNames = [];

  // Headers are made lowercase so that the column headers can be case insensitive
  var headers = getHeaders(dataSheet).map(function (a) {
    return a.toLowerCase();
  });

  var dateIndex = headers.indexOf(settingsSheet.getRange('dateColumnName').getValue().toLowerCase());
  var domainIndex = headers.indexOf(settingsSheet.getRange('displayDomainColumnName').getValue().toLowerCase());
  var deviceIndex = headers.indexOf(settingsSheet.getRange('deviceColumnName').getValue().toLowerCase());

  var under10Percent = settingsSheet.getRange('under10Percent').getValue();

  if (settingsSheet.getRange('deviceColumnName') == '' || deviceIndex == -1) {
    // If there is no device column, the impression share column is 2
    var imprShareIndex = 2;
  } else {
    // If there *is* a device column, then the impr share column is bumped up to 3
    var imprShareIndex = 3;
  }

  if (columnHeader == 'Impr. share') {
    var columnIndex = imprShareIndex;
  } else {
    var columnIndex = headers.indexOf(columnHeader.toLowerCase());
    // The index of the required stat
  }

  var dataTable = dataSheet.getRange(2, 1, dataSheet.getLastRow(), dataSheet.getLastColumn()).getValues();
  if (dataTable[0][0].toString().toLowerCase() == headers[0]) {
    // First row of data is the headers and can be removed
    dataTable.shift();
  }

  // First we record the stats for each domain, by month
  // and record each domain's highest impression share
  for (var i = 0; i < dataTable.length; i++) {
    // auditInsights is a multi-dimensional array containing the values of the auditInsights cells.
    // So auditInsights[i] is a row on the Auction Insights report
    // The loop starts at 2 as auditInsights[0] is the title and auditInsights[1] is the headers.

    var date = dataTable[i][dateIndex];

    if (!date) {
      // If the date field is blank, there isn't data on this row
      continue;
    }

    if (deviceIndex != -1 && device != 'Total' && dataTable[i][deviceIndex] != device) {
      continue;
    }

    var domainName = dataTable[i][domainIndex].toLowerCase();
    if (domainName != youName && competitors.indexOf(domainName) == -1) {
      continue;
    }
    if (recordDeviceAsDomain) {
      domainName = dataTable[i][deviceIndex];
    }

    if (typeof date !== 'string') {
      // The date is converted into a string
      date = Utilities.formatDate(date, timezone, bigendianDate);
    }

    if (Utilities.formatDate(stringToDate(date), 'UTC', bigendianDate) == '1970-01-01') {
      // This means it isn't a proper date, so the row is skipped
      continue;
    }

    if (dates.indexOf(date) < 0) {
      // If the current row's date isn't in the dates array, it's added
      dates.push(date);
    }

    var imprShare = dataTable[i][imprShareIndex]; // the impression share
    if (imprShare == '< 10%') {
      // If the impression share is "< 10%" (a string) it is changed to the value given
      // in the Settings sheet, so it can be displayed in the graph.
      imprShare = under10Percent;
    }

    if (domains[domainName] == undefined) {
      // If the current row's domain name isn't in the domainNames array, it is added,
      // and an entry for it is entered into the domains object.
      domainNames.push(domainName);
      domains[domainName] = {};
      domains[domainName]['Max Impr Share'] = imprShare;
    }

    // If the stat is impression share, we recorded it
    if (columnIndex == imprShareIndex) {
      domains[domainName][date] = imprShare;
    } else {
      // Otherwise the value of the row with the right column header is recorded
      domains[domainName][date] = dataTable[i][columnIndex];
    }

    if (typeof (domains[domainName]['Max Impr Share']) === 'string' || imprShare > domains[domainName]['Max Impr Share']) {
      // If the current imprShare is bigger than the last recorded max impr share,
      // the current one is recorded as being the max
      domains[domainName]['Max Impr Share'] = imprShare;
    }
  } // end of for loop

  return {
    data: domains,
    domainNames: domainNames,
    dates: dates
  };
}


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// This function takes the cost, clicks and impression data and organises it by date
// Can be filtered by device
function getStatByDate(settingsSheet, performanceSheet, statsToReport, device) {
  var costTotals = [];
  var clicksTotals = [];
  var imprTotals = [];

  var zeroImpressions = true;

  // If there are data in the performance sheet, and extra metrics are wanted
  if (statsToReport.length > 0) {
    var headers = getHeaders(performanceSheet).map(function (a) {
      return a.toLowerCase();
    });
    var deviceIndex = headers.indexOf(settingsSheet.getRange('deviceColumnName').getValue().toLowerCase());

    if (deviceIndex > -1 || device == 'Total') {
      var dateIndex = getStatColumnIndex(settingsSheet, headers, 'dateColumnName');
      var costIndex = getStatColumnIndex(settingsSheet, headers, 'costColumnName');
      var clicksIndex = getStatColumnIndex(settingsSheet, headers, 'clicksColumnName');
      var imprIndex = getStatColumnIndex(settingsSheet, headers, 'impressionsColumnName');

      // Dates are stored as bigendian date strings, then converted back to dates at the end
      var bigendianDate = 'yyyy-MM-dd';
      // The timezone is used to convert them back
      var timezone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

      var performance = performanceSheet.getRange(2, 1, performanceSheet.getLastRow(), performanceSheet.getLastColumn()).getValues();
      if (performance[0][0].toString().toLowerCase() == headers[0]) {
        // First row of data is the headers and can be removed
        performance.shift();
      }

      for (var i = 0; i < performance.length; i++) {
        var date = performance[i][dateIndex];

        Logger.log(date + ' - ' + performance[i][imprIndex] + ' - ' + performance[i][deviceIndex]);

        if (!date) {
          // If there's no date there's no data on this row, or (in reports
          // from the new interface) this is the start of the totals rows.
          if (i < 3) {
            continue;
          } else {
            break;
          }
        }

        if (device != 'Total' && performance[i][deviceIndex] != device) {
          continue;
        }

        if (typeof date !== 'string') {
          // If the date isn't a string, convert it into one
          date = Utilities.formatDate(date, timezone, bigendianDate);
        }

        if (costTotals[date] == undefined) {
          costTotals[date] = performance[i][costIndex];
          clicksTotals[date] = performance[i][clicksIndex];
          imprTotals[date] = performance[i][imprIndex];
        } else {
          costTotals[date] += performance[i][costIndex];
          clicksTotals[date] += performance[i][clicksIndex];
          imprTotals[date] += performance[i][imprIndex];
        }

        if (zeroImpressions && performance[i][imprIndex] > 0) {
          zeroImpressions = false;
        }
      } // end of for loop
    }
  }

  return {
    cost: costTotals,
    clicks: clicksTotals,
    impr: imprTotals,
    zeroImpressions: zeroImpressions
  };
}


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// This function finds the index of stat columns in the Performance sheet. It tries
// alternative (English) names for impressions and clicks if the given name is not found.
// NB: If 'Interactions' is found instead of 'Clicks', this may include Engagements
// from shopping showcase ads as well as clicks
function getStatColumnIndex(settingsSheet, headers, columnRangeName) {
  var possibleNames = [settingsSheet.getRange(columnRangeName).getValue().toLowerCase()];

  switch (columnRangeName) {
    case 'clicksColumnName':
      possibleNames.push('interactions'); // Used when different interaction types are available
      break;

    case 'impressionsColumnName':
      possibleNames.push('impr.'); // New interface
      possibleNames.push('impressions'); // Old interface
      break;

    default:
      break;
  }

  for (var i = 0; i < possibleNames.length; i++) {
    var index = headers.indexOf(possibleNames[i]);
    if (index >= 0) {
      return index;
    }
  }
  return -1;
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// This function lists the top competitors in order of thier maximum impression share.
function getCompetitorsByMaxImprShare(settingsSheet, dataSheet, domainIndex) {
  var competitorImprShare = {};
  var competitorAppearances = {};

  var youName = settingsSheet.getRange('youName').getValue().toLowerCase();
  var columnHeaders = getHeaders(dataSheet).map(function (a) {
    return a.toLowerCase();
  });
  var imprShareIndex = 2;

  var dataTable = dataSheet.getRange(2, 1, dataSheet.getLastRow(), 9).getValues();

  for (var i = 0; i < dataTable.length; i++) {
    var cellValue = dataTable[i][0].toString().toLowerCase();
    if (cellValue == columnHeaders[0] || cellValue == '') {
      continue;
    }

    var competitor = dataTable[i][domainIndex].toLowerCase();

    if (competitor == youName) {
      continue;
    }

    var imprShare = dataTable[i][imprShareIndex];
    if (imprShare == '< 10%') {
      imprShare = 0.05;
    }

    if (competitorImprShare[competitor] == undefined) {
      competitorImprShare[competitor] = imprShare;
      competitorAppearances[competitor] = 0;
    } else if (competitorImprShare[competitor] < imprShare) {
      competitorImprShare[competitor] = imprShare;
    }
    competitorAppearances[competitor]++;
  }

  var competitorNames = Object.keys(competitorImprShare);

  competitorNames.sort(function (a, b) {
    if (competitorImprShare[a] != competitorImprShare[b]) {
      return competitorImprShare[b] - competitorImprShare[a];
    }
    return competitorAppearances[b] - competitorAppearances[a];
  });

  var numberOfCompetitorsRequired = settingsSheet.getRange('CompetitorNames').getValues().length;

  for (var i = competitorNames.length; i < numberOfCompetitorsRequired; i++) {
    competitorNames.push(['']); // pads out the array
  }

  for (var i = 0; i < competitorNames.length; i++) {
    competitorNames[i] = [competitorNames[i]];
  }

  return competitorNames.slice(0, numberOfCompetitorsRequired);
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// This function lists all competitors
function getAllCompetitors(dataSheet, youName, domainName) {
  var competitorsKeyed = {};

  var columnHeaders = getHeaders(dataSheet).map(function (a) {
    return a.toLowerCase();
  });
  var domainIndex = columnHeaders.indexOf(domainName.toLowerCase());
  Logger.log(domainName);
  Logger.log(columnHeaders);
  Logger.log(2 + ', ' + domainIndex + 1 + ', ' + dataSheet.getLastRow() + ', ' + 1);
  var dataTable = dataSheet.getRange(2, domainIndex + 1, dataSheet.getLastRow(), 1).getValues();
  youName = youName.toLowerCase();

  for (var i = 0; i < dataTable.length; i++) {
    var competitor = dataTable[i][0].toString().toLowerCase();
    if (competitor == columnHeaders[domainIndex] || competitor == '' || competitor == youName) {
      continue;
    }
    competitorsKeyed[competitor] = true;
  }

  return Object.keys(competitorsKeyed);
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// This function converts date-strings back into dates
function stringToDate(string) {
  var dateBits = string.split('-');

  var date = new Date(dateBits[0], parseInt(dateBits[1], 10) - 1, parseInt(dateBits[2], 10), 1, 1, 1, 1);

  return date;
}


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// This function removes leading and trailing spaces, and line breaks
// (because the Computer device name tends to include a line break)
function getDisplayName(rawName) {
  var displayName = rawName.trim();
  displayName = displayName.replace(/(\n|\r)/g, '');
  return displayName;
}


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Find the headers from the copied reports
// (which could be the first or second row depending how the data has been pasted in)
function getHeaders(sheet) {
  if (sheet.getLastColumn() == 0) {
    // no data in sheet yet
    return [''];
  }

  var numberOfRowsToCheck = 3;
  var topOfPageData = sheet.getRange(1, 1, numberOfRowsToCheck, sheet.getLastColumn()).getValues();

  if (topOfPageData[1][0] == '') {
    // no data in sheet yet
    return [''];
  }

  for (var i = 0; i < topOfPageData.length; i++) {
    if (topOfPageData[i][1] != '') {
      // if this cell isn't blank, it should be a header
      Logger.log('i is ' + i + ', cell 1 is ' + topOfPageData[i][1]);
      return topOfPageData[i];
    }
  }

  return [''];
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// This function checks that a data sheet is filled in and has the required headings
function checkSheetIsFilledIn(settingsSheet, dataSheet, sheetName, dateName, domainName, youName) {
  var headers = getHeaders(dataSheet).map(function (a) {
    return a.toLowerCase();
  });

  // Check the required column headers are not blank
  var nonBlankHeaders = headers.filter(function (a) {
    return a != '';
  });
  if (nonBlankHeaders.length == 0) {
    Browser.msgBox("No headers found in the '" + sheetName + "' sheet. Please make sure you have copied in your data.");
    return false;
  }

  if (sheetName == 'Auction Insights By Device') {
    var deviceColumnName = settingsSheet.getRange('deviceColumnName').getValue();
    if (deviceColumnName == '') {
      Browser.msgBox('Device column name is blank. Please make sure you have entered a name for the device column.');
      return false;
    }
    var deviceIndex = headers.indexOf(deviceColumnName.toLowerCase());
    if (deviceIndex == -1) {
      Browser.msgBox("Could not find the Device column '" + deviceColumnName + "' in the '" + sheetName + "' sheet. Please check it is typed correctly.");
      return false;
    }
  }

  var dateIndex = headers.indexOf(dateName.toLowerCase());
  var domainIndex = headers.indexOf(domainName.toLowerCase());

  if (dateIndex == -1) {
    Browser.msgBox("Could not find the date column '" + dateName + "' in the '" + sheetName + "' sheet. Please check it is typed correctly.");
    return false;
  }
  if (domainIndex == -1) {
    Browser.msgBox("Could not find the Display URL Domain column '" + domainName + "' in the '" + sheetName + "' sheet. Please check it is typed correctly.");
    return false;
  }

  // Check there are no dates which read "########"
  var allDates = dataSheet.getRange(3, dateIndex + 1, dataSheet.getLastRow(), 1).getValues();
  var badDates = allDates.filter(function (a) {
    return typeof a[0] === 'string' && a[0].substr(0, 1) == '#';
  });
  if (badDates.length > 0) {
    Browser.msgBox(badDates.length + " dates in the '" + sheetName + "' sheet contain #s. Please check they were copied correctly.");
    return false;
  }

  // Check there is data for the given You name
  var allDomains = dataSheet.getRange(3, domainIndex + 1, dataSheet.getLastRow(), 1).getValues();
  var youNameLowerCase = youName.toLowerCase();
  var badDomains = allDomains.filter(function (a) {
    return a[0].toLowerCase() == youNameLowerCase;
  });
  if (badDomains.length == 0) {
    Browser.msgBox("No rows found in the '" + sheetName + "' sheet with the domain '" + youName + "'. Please check you have entered the You name correctly.");
    return false;
  }

  return true;
}
