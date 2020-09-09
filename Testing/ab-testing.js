// ID: d5719c37aa3d4ffcef565d39eb3c8d68
/**
 * Brainlabs A/B Testing Tool with Statistical Relevance Calculator
 *
 * This script will pause and activate campaigns and shopping campaigns every hour.
 * The script will calculate the statistical relevance of the results and email
 * if a sufficient confidence is achieved.
 *
 * Version: 2.2
 * AdWords script maintained on brainlabsdigital.com
 */

function main() {
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  // The A/B testing

  // Labels used for the Search/Display campaigns being tested
  // Leave as blank, "", to skip
  var campaignLabelA = 'Control';
  var campaignLabelB = 'Experiment';

  // Labels used for Shopping campaigns being tested
  // Leave as blank, "", to skip
  var shoppingLabelA = 'Shopping Control';
  var shoppingLabelB = 'Shopping Experiment';

  // The confidence levels at which to reject the null hypothesis for the trials
  // Set to a number between 0 and 1
  // We recommend 0.95
  var confidenceThreshold = 0.95;

  // Date range over which to take data for statistical relevance calculation
  // Choose from TODAY, YESTERDAY, LAST_7_DAYS, THIS_WEEK_SUN_TODAY, LAST_WEEK, LAST_14_DAYS,
  // LAST_30_DAYS, LAST_BUSINESS_WEEK, LAST_WEEK_SUN_SAT, THIS_MONTH, LAST_MONTH, ALL_TIME
  // To skip leave as "" and add in a start date below.
  var reportDate = 'LAST_30_DAYS';

  // Rather than use a preset date range, give the start date for your experiment.
  // The script will make a date range starting on that day and ending on today.
  // Format is "yyyy-mm-dd". Leave as "" to skip.
  var startDate = '2015-10-01';

  // People who will be alerted when statistical significance is achieved
  // Separate multiple recipients with a comma
  // Leave blank, "", to skip sending emails
  var emailRecipients = 'eve@example.com'; // e.g. "alice@example.com, bob@example.com"

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  if (reportDate == '') {
    reportDate = [startDate.replace(/-/g, ''), Utilities.formatDate(new Date(), 'UTC', 'yyyyMMdd')];
    Logger.log('Using date range ' + startDate + ' to ' + Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd'));
  } else {
    Logger.log('Using date range ' + reportDate);
  }

  var campaignCTR = {
    campaignType: 'campaigns',
    metricA: 'Impressions',
    metricB: 'Clicks',
    rateName: 'CTR',
    testName: 'campaign CTR',
    labelA: campaignLabelA,
    labelB: campaignLabelB,
    confidenceThreshold: confidenceThreshold,
    reportDate: reportDate
  };

  var campaignConversionRate = {
    campaignType: 'campaigns',
    metricA: 'Clicks',
    metricB: 'Conversions',
    rateName: 'conversion rate',
    testName: 'campaign conversion rate',
    labelA: campaignLabelA,
    labelB: campaignLabelB,
    confidenceThreshold: confidenceThreshold,
    reportDate: reportDate
  };

  var shoppingCTR = {
    campaignType: 'shoppingCampaigns',
    metricA: 'Impressions',
    metricB: 'Clicks',
    rateName: 'CTR',
    testName: 'shopping campaign CTR',
    labelA: shoppingLabelA,
    labelB: shoppingLabelB,
    confidenceThreshold: confidenceThreshold,
    reportDate: reportDate
  };

  var shoppingConversionRate = {
    campaignType: 'shoppingCampaigns',
    metricA: 'Clicks',
    metricB: 'Conversions',
    rateName: 'conversion rate',
    testName: 'shopping campaign conversion rate',
    labelA: shoppingLabelA,
    labelB: shoppingLabelB,
    confidenceThreshold: confidenceThreshold,
    reportDate: reportDate
  };

  var objects = [campaignCTR, campaignConversionRate, shoppingCTR, shoppingConversionRate];

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  // date info
  var days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  var date = new Date();
  var timeZone = AdWordsApp.currentAccount().getTimeZone();
  var month = parseInt(Utilities.formatDate(date, timeZone, 'MM'), 10) - 1;
  var dayOfMonth = parseInt(Utilities.formatDate(date, timeZone, 'dd'), 10);
  var hour = parseInt(Utilities.formatDate(date, timeZone, 'HH'), 10);
  var year = parseInt(Utilities.formatDate(date, timeZone, 'YYYY'), 10);

  if (leapYear(year)) days[1] = 29;

  var totalDays = 0;

  for (var i = 0; i < month; i++) {
    totalDays += days[i];
  }

  totalDays += dayOfMonth;

  Logger.log('Day of year: ' + totalDays);

  Logger.log('hour: ' + hour);

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  var campaignTypeArray = [];

  for (var i = 0; i < objects.length; i++) {
    if (objects[i].labelA !== '' && objects[i].labelB !== '') {
      if (campaignTypeArray.indexOf(objects[i].campaignType) === -1) {
        enable_pause(objects[i], totalDays, hour);
        campaignTypeArray.push(objects[i].campaignType);
      }
    }
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  for (var i = 0; i < objects.length; i++) {
    if (objects[i].confidenceThreshold >= 0 && objects[i].confidenceThreshold <= 1) {
      if (objects[i].labelA !== '' && objects[i].labelB !== '') {
        objects[i].results = allStats(objects[i]);
        objects[i].confidenceLevelData = calculation(objects[i].results);
        objects[i].confidenceLevel = objects[i].confidenceLevelData.confidence;
        Logger.log('Experiment: ' + objects[i].testName + ' Result: ' + objects[i].confidenceLevel);
      }
    }
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  var accountName = AdWordsApp.currentAccount().getName();
  var emailSubject = 'AdWords - ' + accountName + ' - A/B test results';
  var emailBody = 'The A/B tests in the AdWords account ' + accountName + ' have statistically significant results:\n\n\n';

  var trigger = 0;

  for (var i = 0; i < objects.length; i++) {
    if (objects[i].hasOwnProperty('confidenceLevel')) {
      if (objects[i].confidenceLevel >= objects[i].confidenceThreshold) {
        trigger = 1;

        // Create properties for the campaign group with the better rate
        winnerStats(objects[i]);

        emailBody += 'The test for ' + objects[i].testName + ' shows statistically significant results. ';
        emailBody += 'The null hypothesis - that the control and experiment have the same rate - can be rejected ';
        emailBody += 'with ' + percent(objects[i].confidenceLevel, 2) + ' certainty. ';

        emailBody += 'The winner is campaigns labelled with "' + objects[i].winner.label + '" which have ';
        emailBody += 'a ' + objects[i].rateName + ' of ' + objects[i].winner.rate + '. ';
        emailBody += 'The loser is campaigns labelled with "' + objects[i].loser.label + '" which have ';
        emailBody += 'a ' + objects[i].rateName + ' of ' + objects[i].loser.rate + '.\n\n';
      }
    }
  }

  if (trigger === 1 && emailRecipients !== '') {
    MailApp.sendEmail(emailRecipients, emailSubject, emailBody);
  }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Reporting functions

/**
 * Returns stats for campaign experiment type
 *
 * @param object campaignExperiment the object housing the details
 * @return object the results
 */
function allStats(object) {
  var results = {};

  results.control = getStats(object, object.labelA);
  results.experiment = getStats(object, object.labelB);

  return results;
}

/**
 * Returns stats for campaign experiment type
 *
 * @param object campaignExperiment the object housing the details
 * @param object the results
 * @return object the results
 */
function getStats(object, label) {
  var campaignType = object.campaignType;
  var date = object.reportDate;
  var metricA = object.metricA;
  var metricB = object.metricB;

  var results = {
    metricA: 0,
    metricB: 0
  };

  var iterator = eval(objectIterator(campaignType, label));
  while (iterator.hasNext()) {
    var object = iterator.next();
    if (typeof date === 'object') {
      var stats = object.getStatsFor(date[0], date[1]);
    } else {
      var stats = object.getStatsFor(date);
    }
    results.metricA += eval('stats.get' + metricA + '();');
    results.metricB += eval('stats.get' + metricB + '();');
  }

  return results;
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Management functions

/**
 * Determine which campaign group has a better rate once statistical significance has been established
 *
 * @param object campaignExperiment the object housing the details
 */
function winnerStats(campaignExperiment) {
  var controlRate = campaignExperiment.results.control.metricB / campaignExperiment.results.control.metricA;
  var experimentRate = campaignExperiment.results.experiment.metricB / campaignExperiment.results.experiment.metricA;

  var controlRatePercent = percent(controlRate, 2);
  var experimentRatePercent = percent(experimentRate, 2);

  if (controlRate >= experimentRate) {
    campaignExperiment.winner = {
      label: campaignExperiment.labelA,
      rate: controlRatePercent
    };
    campaignExperiment.loser = {
      label: campaignExperiment.labelB,
      rate: experimentRatePercent
    };
  } else {
    campaignExperiment.loser = {
      label: campaignExperiment.labelA,
      rate: controlRatePercent
    };
    campaignExperiment.winner = {
      label: campaignExperiment.labelB,
      rate: experimentRatePercent
    };
  }
}

/**
 * Returns true if leap year, false otherwise
 *
 * @param int year the object housing the details
 * @return bool is current year a leap year
 */
function leapYear(year) {
  return ((year % 4 == 0) && (year % 100 != 0)) || (year % 400 == 0);
}

/**
 * Will pause or enable campaigns based on labels
 *
 * @param object campaignExperiment the object housing the details
 * @param int totalDays the number of days since Jan 1st
 * @param int hour the hour of the day
 */

function enable_pause(campaignExperiment, totalDays, hour) {
  var campaignType = campaignExperiment.campaignType;
  var labelA = campaignExperiment.labelA;
  var labelB = campaignExperiment.labelB;

  if (totalDays % 2 === 0) {
    if (hour % 2 === 0) {
      EnableCampaigns(campaignType, labelA);
      PauseCampaigns(campaignType, labelB);
    } else {
      EnableCampaigns(campaignType, labelB);
      PauseCampaigns(campaignType, labelA);
    }
  } else if (hour % 2 === 0) {
    EnableCampaigns(campaignType, labelB);
    PauseCampaigns(campaignType, labelA);
  } else {
    EnableCampaigns(campaignType, labelA);
    PauseCampaigns(campaignType, labelB);
  }
}

/**
 * Produces string which can be passed to eval() to create an iterator object.
 * Allows dynamic creation of iterators for different types of object.
 *
 * @param String campaignType the type of iterator to produce e.g "campaigns" or "shoppingCampaigns"
 * @param String label for filtering
 * @return String Correctly parsed AdWords iterator object
 */
function objectIterator(campaignType, label) {
  var iterator = 'AdWordsApp.' + campaignType + '()';
  iterator += ".withCondition('LabelNames CONTAINS_ANY " + '["' + label + '"]' + "')";
  iterator += '.get();';

  return iterator;
}

/**
 * Pause all campaigns of specific type which have a specific label
 *
 * @param String campaignType the type of campaign to change
 * @param String label for filtering
 */
function PauseCampaigns(campaignType, label) {
  var iterator = eval(objectIterator(campaignType, label));
  if (!iterator.hasNext()) {
    Logger.log('Warning: no ' + campaignType + " found with the label '" + label + "'. No campaigns paused.");
  }
  while (iterator.hasNext()) {
    var object = iterator.next();
    object.pause();
  }
}

/**
 * Enable all campaigns of specific type which have a specific label
 *
 * @param String campaignType the type of campaign to change
 * @param String label for filtering
 */
function EnableCampaigns(campaignType, label) {
  var iterator = eval(objectIterator(campaignType, label));
  if (!iterator.hasNext()) {
    Logger.log('Warning: no ' + campaignType + " found with the label '" + label + "'. No campaigns enabled.");
  }
  while (iterator.hasNext()) {
    var object = iterator.next();
    object.enable();
  }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Statistical analysis functions

/**
 * Return a confidence level for rejecting the null hypothesis that the two sets of
 * results are not statistically distinguishable. Takes an object of the form:
 *
 * var results = {
 * control: {metricA: xxx, metricB: xxx},
 * experiment: {metricA: xxx, metricB: xxx}
 * }
 *
 * @param Object results the data to analyse
 * @return Object outcome the confidence for rejecting null hypothesis
 */
function calculation(results) {
  var e1a = results.control.metricA;
  var e1b = results.control.metricB;

  var e2a = results.experiment.metricA;
  var e2b = results.experiment.metricB;

  var e1r = e1b / e1a;
  var e2r = e2b / e2a;

  var p1_p2 = Math.abs(e1r - e2r);
  var p = (e1b + e2b) / (e1a + e2a);

  var se_p = Math.sqrt(p * (1 - p) * ((1 / e1a) + (1 / e2a)));

  var z = p1_p2 / se_p;

  // The confidence for rejecting the null hypothesis
  var rejectNullConfidence = normDist(z);
  // The range of values at the null hypothesis rejection confience level
  var top = topInverse(rejectNullConfidence);
  var bottom = bottomInverse(rejectNullConfidence);

  var outcome = {
    confidence: rejectNullConfidence,
    top: top,
    bottom: bottom
  };

  return outcome;

  /**
   * Find the top and bottom limit of the range. Within parent function
   * scope to take advantage of closure. Referencing variables: p1_p2, se_p
   *
   * @param float cdf the number to parse as a percentage
   * @return string the range bound
   */
  function topInverse(cdf) {
    return percent(p1_p2 + baseInverse(cdf) * se_p, 2);
  }

  function bottomInverse(cdf) {
    return percent(p1_p2 - baseInverse(cdf) * se_p, 2);
  }
}

/**
 * Parse number as percentage with dec digits after the decimal point
 *
 * @param float x the number to parse as a percentage
 * @param int dec the number of digits after the decimal place
 * @return string the parameter number parsed as a percentage string
 */
function percent(x, dec) {
  return Math.round(x * 100 * Math.pow(10, dec)) / Math.pow(10, dec) + '%';
}

/**
 * The inverse of the CDF
 *
 * @param float cdf the CDF for the normal distribution
 * @return float the CDF inverse
 */
// Inverse confidence level
function baseInverse(cdf) {
  return normal_cdf_inverse(1 - ((1 - cdf) / 2));
}

// Source: http://picomath.org/javascript/normal_cdf_inverse.js.html
function rational_approximation(t) {
  // Abramowitz and Stegun formula 26.2.23.
  // The absolute value of the error should be less than 4.5 e-4.
  var c = [2.515517, 0.802853, 0.010328];
  var d = [1.432788, 0.189269, 0.001308];
  var numerator = (c[2] * t + c[1]) * t + c[0];
  var denominator = ((d[2] * t + d[1]) * t + d[0]) * t + 1.0;
  return t - numerator / denominator;
}

// Source: http://picomath.org/javascript/normal_cdf_inverse.js.html
function normal_cdf_inverse(p) {
  // See article above for explanation of this section.
  if (p < 0.5) {
    // F^-1(p) = - G^-1(p)
    return -rational_approximation(Math.sqrt(-2.0 * Math.log(p)));
  }
  // F^-1(p) = G^-1(1-p)
  return rational_approximation(Math.sqrt(-2.0 * Math.log(1.0 - p)));
}

// Source: http://picomath.org/javascript/erf.js.html
function erf(x) {
  // constants
  var a1 = 0.254829592;
  var a2 = -0.284496736;
  var a3 = 1.421413741;
  var a4 = -1.453152027;
  var a5 = 1.061405429;
  var p = 0.3275911;

  // Save the sign of x
  var sign = 1;
  if (x < 0) {
    sign = -1;
  }
  x = Math.abs(x);

  // A&S formula 7.1.26
  var t = 1.0 / (1.0 + p * x);
  var y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

/**
 * Find the CDF from the normal distribution
 *
 * @param float z the z-score of the distribution
 * @return float the CDF
 */
function normDistCDF(z) {
  var cdf = (0.5 * (1.0 + erf(Math.abs(z) / Math.sqrt(2))));
  return cdf;
}

/**
 * Parse CDF as a confidence level
 *
 * @param float cdf the CDF for the normal distribution
 * @return float the confidence level
 */
function normDist(z) {
  return 1 - 2 * (1 - normDistCDF(z));
}
