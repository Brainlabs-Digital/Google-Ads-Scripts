// ID: f6968d978b5224437d419868c7ef3687
/**
*
* Heat Map Creation Tool - with Devices
*
* This script calculates the smoothed average performance of each hour of each day
* of the week, and outputs this into a heat map and graph in a Google Sheet. This
* can be done for all data and for device data. It also suggests ad schedules and
* device bid adjustments based on conversion rates.
*
* Version: 2.0
* Google AdWords Script maintained on brainlabsdigital.com
*
*/


// ////////////////////////////////////////////////////////////////////////////
// Options

var spreadsheetUrl = 'https://docs.google.com/YOUR-SPREADSHEET-URL-HERE';
// The URL of the Google Doc the results will be put into.
// Copy the template at https://docs.google.com/spreadsheets/d/19OsCHG5JE_TqHHCZK1HNXyHizrJZ0_iT6dpqUOzvRB4/edit#gid=1022438191
// so you have the correct formatting and charts set up.

var dateRanges = ['2016-09-01,2016-10-31'];
// The start and end date of the date range for your data
// You can have multiple ranges, eg ["2016-06-01,2016-07-31","2016-09-01,2016-10-31"]
// would get data from June, July, September and October 2015.
// Format for each range is "yyyy-mm-dd,yyyy-mm-dd" (where the first date is the
// start of the range and the second is the end).

var ignoreDates = [];
// List any single days that are within your date range but whose data you do not
// want to use in calculations, for instance if they had atypical performance or
// there were technical issues with your site.
// eg ["2016-02-14","2016-03-27"] would mean data from Valentine's Day and Easter
// 2016 would be ignored.
// Format for each day is "yyyy-mm-dd"
// Leave as [] if unwanted.

var fields = ['Impressions', 'Clicks', 'Conversions'];
// Make heat maps of these fields.
// Allowed values: "Impressions", "Clicks", "Cost", "Conversions",
// "ConversionValue"

var calculatedFields = ['Clicks/Impressions', 'Conversions/Clicks'];
// Make heat maps of a stat calculated by dividing one field by another.
// For example "Clicks/Impressions" will give the average clicks divided by the
// average impressions (ie the CTR).
// Allowed fields: "Impressions", "Clicks", "Cost", "Conversions",
// "ConversionValue"

var devices = ['Mobile'];
// Make heat maps and bid modifier suggestions for these devices
// Allowed fields: "Mobile", "Tablet", "Desktop"

var suggestAdSchedules = true;
// If true, the script will suggest hourly ad schedules, based on conversion rate.

var suggestDeviceBidModifiers = true;
// If true, the script will suggest bid modifiers for the devices specified above,
// based on the devices' conversion rates.

var baseDeviceModifiersOnBiddingMultiplier = true;
// If true, then the device bid modifiers given will be adjusted to take into
// account the suggested ad schedules.
// For example suppose that at a certain hour device bids should be increased by
// 30%, and the suggested ad schedule for that hour is 10%.
// If this is false, the the device modifier will be given as 30%.
// If this is true, then the device modifier will be given as 18%, because when
// this and the 10% ad schedules are applied this increases the bid by 30%.

var campaignNameDoesNotContain = [];
// Use this if you want to exclude some campaigns.
// For example ["Display"] would ignore any campaigns with 'Display' in the name,
// while ["Display","Competitors"] would ignore any campaigns with 'display' or
// 'competitors' in the name. Case insensitive.
// Leave as [] to not exclude any campaigns.

var campaignNameContains = [];
// Use this if you only want to look at some campaigns.
// For example ["Brand"] would only look at campaigns with 'Brand' in the name,
// while ["Brand","Generic"] would only look at campaigns with 'brand' or 'generic'
// in the name. Case insensitive.
// Leave as [] to include all campaigns.

var ignorePausedCampaigns = true;
// Set this to true to only look at currently active campaigns.
// Set to false to include campaigns that had impressions but are currently paused.


// ////////////////////////////////////////////////////////////////////////////
// Advanced settings.

var smoothingWindow = [-2, -1, 0, 1, 2];
var smoothingWeight = [0.25, 0.75, 1, 0.75, 0.25];
// The weights used for smoothing.
// The smoothingWindow gives the relative hour (eg 0 means the current hour,
// -2 means 2 hours before the current hour) and the smoothingWeight gives the
// weighting for that hour.

var minBidMultiplierSuggestion = -0.35;
var maxBidMultiplierSuggestion = 0.35;
// The minimum and maximum for the suggested bidding multipliers.


// ////////////////////////////////////////////////////////////////////////////
function main() {
  // Check the spreadsheet works.
  var spreadsheet = checkSpreadsheet(spreadsheetUrl, 'the spreadsheet');


  // Check the field names are correct, and get a list with the correct capitalisation
  var allowedFields = ['Conversions', 'ConversionValue', 'Impressions', 'Clicks', 'Cost'];
  var fieldsToCheck = [];
  for (var i = 0; i < calculatedFields.length; i++) {
    if (calculatedFields[i].indexOf('/') === -1) {
      throw 'Calculated Field ' + calculatedFields[i] + " does not contain '/'";
    }
    var components = calculatedFields[i].split('/');
    fieldsToCheck = fieldsToCheck.concat(components);
    calculatedFields[i] = checkFieldNames(allowedFields, components, 'calculatedFields', false);
  }
  var fieldsToCheck = fieldsToCheck.concat(fields);
  if (suggestAdSchedules || suggestDeviceBidModifiers) {
    var fieldsToCheck = fieldsToCheck.concat(['Clicks', 'Conversions']);
  }
  var allFields = checkFieldNames(allowedFields, fieldsToCheck, 'fields', true);


  // Check there are date ranges and fields
  // - otherwise there'd be no data to put into heat maps
  if (dateRanges.length == 0) {
    throw 'No date ranges given.';
  }
  if (allFields.length == 0) {
    throw 'No fields were specified.';
  }


  // Check the device names are correct, and make WHERE statements for them
  var allowedDevices = ['Mobile', 'Tablet', 'Desktop'];
  devices = checkFieldNames(allowedDevices, devices, 'devices', true);
  var whereStatements = ['']; // The blank one is for all devices
  for (var i = 0; i < devices.length; i++) {
    if (devices[i] == 'Mobile') {
      whereStatements.push('AND Device = HIGH_END_MOBILE ');
    } else {
      whereStatements.push('AND Device = ' + devices[i].toUpperCase() + ' ');
    }
  }

  var dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var dailyData = {};
  var numberDays = {};
  var smoothedData = {};

  var fieldsIncDevice = allFields.slice();
  for (var i = 0; i < devices.length; i++) {
    fieldsIncDevice = fieldsIncDevice.concat(allFields.map(function (a) { return devices[i] + a; }));
  }


  // Initialise data
  for (var d = 0; d < dayNames.length; d++) {
    smoothedData[dayNames[d]] = {};
    numberDays[dayNames[d]] = 0;
    smoothedData[dayNames[d]] = {};

    for (var h = 0; h < 24; h++) {
      smoothedData[dayNames[d]][h + ''] = {};
      for (var f = 0; f < fieldsIncDevice.length; f++) {
        smoothedData[dayNames[d]][h + ''][fieldsIncDevice[f]] = 0;
      }
    }
  }


  // Get all the campaign IDs (based on campaignNameDoesNotContain, campaignNameContains
  // and ignorePausedCampaigns options).
  var campaignIds = getCampaignIds();


  // Construct the reports
  for (var d = 0; d < dateRanges.length; d++) {
    for (var i = 0; i < whereStatements.length; i++) {
      if (i == 0) {
        var fieldNames = allFields;
      } else {
        var fieldNames = allFields.map(function (a) { return devices[i - 1] + a; });
      }

      var report = AdWordsApp.report('SELECT DayOfWeek, Date, HourOfDay, ' + allFields.join(', ') + ' '
        + 'FROM CAMPAIGN_PERFORMANCE_REPORT '
          + 'WHERE CampaignId IN [' + campaignIds.join(',') + '] '
            + whereStatements[i]
              + 'DURING ' + dateRanges[d].replace(/-/g, ''));

      var rows = report.rows();
      while (rows.hasNext()) {
        var row = rows.next();
        if (ignoreDates.indexOf(row.Date) > -1) {
          continue;
        }
        if (dailyData[row.Date] == undefined) {
          dailyData[row.Date] = {};
          dailyData[row.Date].Day = row.DayOfWeek;
          for (var h = 0; h < 24; h++) {
            dailyData[row.Date][h + ''] = {};
            for (var f = 0; f < fieldsIncDevice.length; f++) {
              dailyData[row.Date][h + ''][fieldsIncDevice[f]] = 0;
            }
          }
        }

        for (var f = 0; f < allFields.length; f++) {
          dailyData[row.Date][row.HourOfDay][fieldNames[f]] += parseInt(row[allFields[f]].replace(/,/g, ''), 10);
        }
      } // end while
    }// end for whereStatements
  }// end for dateRanges


  // Daily data is smoothed and totalled for each day of week
  for (var date in dailyData) {
    var day = dailyData[date].Day;
    numberDays[day]++;

    var dateBits = date.split('-');
    var yesterday = new Date(dateBits[0], parseInt(dateBits[1], 10) - 1, parseInt(dateBits[2], 10) - 1);
    var tomorrow = new Date(dateBits[0], parseInt(dateBits[1], 10) - 1, parseInt(dateBits[2], 10) + 1);
    yesterday = Utilities.formatDate(yesterday, 'UTC', 'yyyy-MM-dd');
    tomorrow = Utilities.formatDate(tomorrow, 'UTC', 'yyyy-MM-dd');

    for (var h = 0; h < 24; h++) {
      for (var f = 0; f < fieldsIncDevice.length; f++) {
        var totalWeight = 0;
        var smoothedTotal = 0;

        for (var w = 0; w < smoothingWindow.length; w++) {
          if (h + smoothingWindow[w] < 0) {
            if (dailyData[yesterday] != undefined) {
              totalWeight += smoothingWeight[w];
              smoothedTotal += smoothingWeight[w] * dailyData[yesterday][(h + smoothingWindow[w] + 24)][fieldsIncDevice[f]];
            }
          } else if (h + smoothingWindow[w] > 23) {
            if (dailyData[tomorrow] != undefined) {
              totalWeight += smoothingWeight[w];
              smoothedTotal += smoothingWeight[w] * dailyData[tomorrow][(h + smoothingWindow[w] - 24)][fieldsIncDevice[f]];
            }
          } else {
            totalWeight += smoothingWeight[w];
            smoothedTotal += smoothingWeight[w] * dailyData[date][(h + smoothingWindow[w])][fieldsIncDevice[f]];
          }
        }
        if (totalWeight != 0) {
          smoothedData[day][h][fieldsIncDevice[f]] += smoothedTotal / totalWeight;
        }
      }
    }
  } // end for dailyData
  Logger.log('Collected daily data.');


  // Calculate the averages from the smoothed data
  var hourlyAvg = {};
  var totalConversions = 0;
  var totalClicks = 0;
  var deviceClicks = {};
  var deviceConversions = {};
  for (var i = 0; i < devices.length; i++) {
    deviceClicks[devices[i]] = 0;
    deviceConversions[devices[i]] = 0;
  }

  for (var d = 0; d < dayNames.length; d++) {
    hourlyAvg[dayNames[d]] = {};
    for (var h = 0; h < 24; h++) {
      hourlyAvg[dayNames[d]][h + ''] = {};

      if (numberDays[dayNames[d]] == 0) {
        for (var f = 0; f < fieldsIncDevice.length; f++) {
          hourlyAvg[dayNames[d]][h + ''][fieldsIncDevice[f]] = '-';
        }
        continue;
      }

      for (var f = 0; f < fieldsIncDevice.length; f++) {
        hourlyAvg[dayNames[d]][h + ''][fieldsIncDevice[f]] = smoothedData[dayNames[d]][h + ''][fieldsIncDevice[f]] / numberDays[dayNames[d]];
      }

      for (var c = 0; c < calculatedFields.length; c++) {
        var multiplier = smoothedData[dayNames[d]][h + ''][calculatedFields[c][0]];
        var divisor = smoothedData[dayNames[d]][h + ''][calculatedFields[c][1]];

        if (divisor == 0 || divisor == '-' || multiplier == '-') {
          hourlyAvg[dayNames[d]][h + ''][calculatedFields[c].join('/')] = '-';
        } else {
          hourlyAvg[dayNames[d]][h + ''][calculatedFields[c].join('/')] = multiplier / divisor;
        }

        for (var i = 0; i < devices.length; i++) {
          var multiplier = smoothedData[dayNames[d]][h + ''][devices[i] + calculatedFields[c][0]];
          var divisor = smoothedData[dayNames[d]][h + ''][devices[i] + calculatedFields[c][1]];

          if (divisor == 0 || divisor == '-' || multiplier == '-') {
            hourlyAvg[dayNames[d]][h + ''][devices[i] + calculatedFields[c].join('/')] = '-';
          } else {
            hourlyAvg[dayNames[d]][h + ''][devices[i] + calculatedFields[c].join('/')] = multiplier / divisor;
          }
        }
      }

      // Add up the clicks and conversions, for generating the suggested ad schedules
      if (suggestAdSchedules || suggestDeviceBidModifiers) {
        totalConversions += smoothedData[dayNames[d]][h + ''].Conversions;
        totalClicks += smoothedData[dayNames[d]][h + ''].Clicks;
        if (suggestDeviceBidModifiers) {
          for (var i = 0; i < devices.length; i++) {
            deviceClicks[devices[i]] += smoothedData[dayNames[d]][h + ''][devices[i] + 'Clicks'];
            deviceConversions[devices[i]] += smoothedData[dayNames[d]][h + ''][devices[i] + 'Conversions'];
          }
        }
      }
    }
  }


  // Calculate suggested ad schedules based on the average conversion rate
  if (suggestAdSchedules || suggestDeviceBidModifiers) {
    if (totalClicks == 0) {
      var meanConvRate = 0;
    } else {
      var meanConvRate = totalConversions / totalClicks;
    }

    for (var d = 0; d < dayNames.length; d++) {
      for (var h = 0; h < 24; h++) {
        if (meanConvRate == 0 || smoothedData[dayNames[d]][h + ''].Clicks == 0) {
          hourlyAvg[dayNames[d]][h + ''].AdSchedules = '-';
        } else {
          var convRate = smoothedData[dayNames[d]][h + ''].Conversions / smoothedData[dayNames[d]][h + ''].Clicks;

          // The suggested multiplier is generated from the mean.
          // It is dampened by taking the square root.
          var multiplier = Math.sqrt(convRate / meanConvRate) - 1;

          if (multiplier > maxBidMultiplierSuggestion) {
            multiplier = maxBidMultiplierSuggestion;
          } else if (multiplier < minBidMultiplierSuggestion) {
            multiplier = minBidMultiplierSuggestion;
          }
          hourlyAvg[dayNames[d]][h + ''].AdSchedules = multiplier;
        }
      }
    }

    // Device level bid modifiers
    if (suggestDeviceBidModifiers) {
      var deviceConvRate = {};
      for (var i = 0; i < devices.length; i++) {
        if (deviceClicks[devices[i]] == 0) {
          deviceConvRate[devices[i]] = 0;
        } else {
          deviceConvRate[devices[i]] = deviceConversions[devices[i]] / deviceClicks[devices[i]];
        }
      }

      for (var d = 0; d < dayNames.length; d++) {
        for (var i = 0; i < devices.length; i++) {
          for (var h = 0; h < 24; h++) {
            if (hourlyAvg[dayNames[d]][h + ''].AdSchedules == '-' || deviceConvRate[i] == 0 || smoothedData[dayNames[d]][h + ''][devices[i] + 'Clicks'] == 0) {
              hourlyAvg[dayNames[d]][h + ''][devices[i] + 'BidModifiers'] = '-';
            } else {
              var convRate = smoothedData[dayNames[d]][h + ''][devices[i] + 'Conversions'] / smoothedData[dayNames[d]][h + ''][devices[i] + 'Clicks'];

              // We calculate the multiplier we want to end up with
              var endMultiplier = Math.sqrt(convRate / deviceConvRate[devices[i]]) - 1;

              if (baseDeviceModifiersOnBiddingMultiplier) {
                // The bid modifier is calculated so that if the bidding multiplier is set up as an
                // ad schedule, this is the correct device bid modifier to get the desired multiplier
                var modifier = ((1 + endMultiplier) / (1 + hourlyAvg[dayNames[d]][h + ''].AdSchedules)) - 1;
              } else {
                var modifier = endMultiplier;
              }

              if (modifier > maxBidMultiplierSuggestion) {
                modifier = maxBidMultiplierSuggestion;
              } else if (modifier < minBidMultiplierSuggestion) {
                modifier = minBidMultiplierSuggestion;
              }
              hourlyAvg[dayNames[d]][h + ''][devices[i] + 'BidModifiers'] = modifier;
            }
          }
        }
      }
    }
  } // end if suggestAdSchedules or suggestDeviceBidModifiers
  Logger.log('Averaged and smoothed data.');


  // Make the heat maps on the spreadsheet
  var sheet0 = spreadsheet.getSheets()[0];
  var calculatedFieldNames = calculatedFields.map(function (arr) { return arr.join('/'); });
  var baseFields = checkFieldNames(allowedFields, fields, '', true).concat(calculatedFieldNames);
  var allFieldNames = baseFields.slice();
  for (var i = 0; i < devices.length; i++) {
    allFieldNames = allFieldNames.concat(baseFields.map(function (a) { return devices[i] + a; }));
  }
  if (suggestAdSchedules) {
    allFieldNames.push('AdSchedules');
  }
  if (suggestDeviceBidModifiers) {
    for (var i = 0; i < devices.length; i++) {
      allFieldNames.push(devices[i] + 'BidModifiers');
    }
  }

  if (sheet0.getName() == 'Template') {
    sheet0.setName(allFieldNames[0].replace(/[A-Z\/]/g, function (x) { return ' ' + x; }).trim());
  }

  for (var f = 0; f < allFieldNames.length; f++) {
    var fieldName = allFieldNames[f].replace(/[A-Z\/]/g, function (x) { return ' ' + x; }).trim();
    var sheet = spreadsheet.getSheetByName(fieldName);
    if (sheet == null) {
      sheet = sheet0.copyTo(spreadsheet);
      sheet.setName(fieldName);
    }
    sheet.getRange(1, 1).setValue(fieldName);

    // Post the heat map data
    var sheetData = [];
    sheetData.push([''].concat(dayNames)); // The header
    var totalValue = 0;
    for (var h = 0; h < 24; h++) {
      var rowData = [h];
      for (var d = 0; d < dayNames.length; d++) {
        if (hourlyAvg[dayNames[d]][h + ''][allFieldNames[f]] == undefined) {
          rowData.push('-');
        } else {
          rowData.push(hourlyAvg[dayNames[d]][h + ''][allFieldNames[f]]);
        }
        totalValue += hourlyAvg[dayNames[d]][h + ''][allFieldNames[f]];
      }
      sheetData.push(rowData);
    }
    sheet.getRange(3, 1, sheetData.length, sheetData[0].length).setValues(sheetData);

    // Work out which format to use and format the numbers in the heat map
    var averageValue = totalValue / (24 * 7);
    if (averageValue < 50) {
      var format = '#,##0.0';
    } else {
      var format = '#,###,##0';
    }
    if (allFieldNames[f].indexOf('/') > -1) {
      var components = allFieldNames[f].split('/');
      var multiplierIsMoney = (components[0] == 'Cost' || components[0] == 'ConversionValue');
      var divisorIsMoney = (components[1] == 'Cost' || components[1] == 'ConversionValue');
      if ((!multiplierIsMoney && !divisorIsMoney) || (multiplierIsMoney && divisorIsMoney)) {
        // If neither component is monetary, or both components are, then the result is a percentage
        format = '#,##0.00%';
      }
    }
    if (allFieldNames[f] == 'AdSchedules' || allFieldNames[f].substr(-12) == 'BidModifiers') {
      format = '#,##0.00%';
    }
    sheet.getRange(4, 2, sheetData.length, sheetData[0].length).setNumberFormat(format);

    // Update the chart title
    var charts = sheet.getCharts();
    if (sheet.getCharts().length === 0) {
      Logger.log('Warning: chart missing from the ' + fieldName + ' sheet.');
    } else {
      var chart = charts[0];
      chart = chart.modify().setOption('title', fieldName).build();
      sheet.updateChart(chart);
    }
  }

  Logger.log('Posted data to spreadsheet.');
  Logger.log('Finished.');
}


// Check the spreadsheet URL has been entered, and that it works
function checkSpreadsheet(spreadsheetUrl, spreadsheetName) {
  if (spreadsheetUrl.replace(/[AEIOU]/g, 'X') == 'https://docs.google.com/YXXR-SPRXXDSHXXT-XRL-HXRX') {
    throw ('Problem with ' + spreadsheetName + " URL: make sure you've replaced the default with a valid spreadsheet URL.");
  }
  try {
    var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);

    // Checks if you can edit the spreadsheet
    var sheet = spreadsheet.getSheets()[0];
    var sheetName = sheet.getName();
    sheet.setName(sheetName);

    return spreadsheet;
  } catch (e) {
    throw ('Problem with ' + spreadsheetName + " URL: '" + e + "'");
  }
}


// Get the IDs of campaigns which match the given options
function getCampaignIds() {
  var whereStatement = 'WHERE ';
  var whereStatementsArray = [];
  var campaignIds = [];

  if (ignorePausedCampaigns) {
    whereStatement += 'CampaignStatus = ENABLED ';
  } else {
    whereStatement += "CampaignStatus IN ['ENABLED','PAUSED'] ";
  }

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
    var report = AdWordsApp.report(
      'SELECT CampaignId '
      + 'FROM   CAMPAIGN_PERFORMANCE_REPORT '
      + whereStatementsArray[i]
      + 'DURING LAST_30_DAYS'
    );

    var rows = report.rows();
    while (rows.hasNext()) {
      var row = rows.next();
      campaignIds.push(row.CampaignId);
    }
  }

  if (campaignIds.length == 0) {
    throw ('No campaigns found with the given settings.');
  }

  return campaignIds;
}


// Verify that all field names are valid, and return a list of them with the
// correct capitalisation. If deduplicate is true, the list is deduplicated
function checkFieldNames(allowedFields, givenFields, souceName, deduplicate) {
  var allowedFieldsLowerCase = allowedFields.map(function (str) { return str.toLowerCase(); });
  var wantedFields = [];
  var unrecognisedFields = [];
  for (var i = 0; i < givenFields.length; i++) {
    var fieldIndex = allowedFieldsLowerCase.indexOf(givenFields[i].toLowerCase().replace(' ', '').trim());
    if (fieldIndex === -1) {
      unrecognisedFields.push(givenFields[i]);
    } else if (!deduplicate || wantedFields.indexOf(allowedFields[fieldIndex]) < 0) {
      wantedFields.push(allowedFields[fieldIndex]);
    }
  }

  if (unrecognisedFields.length > 0) {
    throw unrecognisedFields.length + " field(s) not recognised in '" + souceName + "': '" + unrecognisedFields.join("', '")
      + "'. Please choose from '" + allowedFields.join("', '") + "'.";
  }

  return wantedFields;
}
