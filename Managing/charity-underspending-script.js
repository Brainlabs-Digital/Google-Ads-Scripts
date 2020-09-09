// ID: 44565c93d4079a9d9e22b5d238ee27bc
/**
 *
 * This tool prevents your account from underspending by enabling a set of
 * labelled keywords when the account's spending is below budget.
 * If the account begins to spend over budget, these keywords are paused.
 *
 */

function main() {

  ///////////////   Options   /////////////////

  var extraKeywordsLabel = "inefficient";
  // The label you use for your extra keywords.

  var monthlyBudget = 10000;
  // The account's monthly budget in whole units (pounds, dollars, etc).

  var tolerance = 0.05;
  // The proportion above or below budget the account should be before extra keywords are enabled or paused.
  // 0.05 allows the account to be 5% above or below budget without changes being made.

  var emails = [];
  // Email addresses to receive notifications.
  // Emails should be in double quotes and comma separated, eg
  // ["hermione@griffindor.ac.uk", "luna@ravenclaw.ac.uk"]
  // Set to [] if you do not wish to receive emails.

  var errorSubject = "Error in underspending script";
  // The subject line to use for error emails.

  var hourlyTargets = {
    "0": 0.04,
    "1": 0.08,
    "2": 0.12,
    "3": 0.16,
    "4": 0.20,
    "5": 0.25,
    "6": 0.29,
    "7": 0.33,
    "8": 0.37,
    "9": 0.41,
    "10": 0.45,
    "11": 0.50,
    "12": 0.54,
    "13": 0.58,
    "14": 0.62,
    "15": 0.66,
    "16": 0.70,
    "17": 0.75,
    "18": 0.79,
    "19": 0.83,
    "20": 0.87,
    "21": 0.91,
    "22": 0.95,
    "23": 1.00
  };
  // The proportion of the budget that should have been spent by the end of each hour.
  // The values are cumulative, Start: 00:00-00:59; end: 23:00-23:59.
  // The default values give a linear spread of ad spend throughout the day.

  //////////////   End of Options   /////////////////

  try {
    var today = new Date();
    var timeZone = AdsApp.currentAccount().getTimeZone();

    if (getHours(today, timeZone) == 0) {
      changeKeywordsStatus(extraKeywordsLabel, "PAUSED", emails, null, null);
      Logger.log("Keywords with label " + extraKeywordsLabel + " paused because it's the beginning of the day");
    }

    var budget = getDailyBudget(today, timeZone, monthlyBudget);
    var targetProportion = getTargetSpendProportion(hourlyTargets, today, timeZone);
    var currentProportion = getCurrentSpendProportion(budget);

    Logger.log("Current spend is " + (currentProportion * 100) + "% of the budget, target spend is " + (targetProportion * 100) + "%");

    if (currentProportion > targetProportion + tolerance) {
      Logger.log("Keywords with label " + extraKeywordsLabel + " will be paused");
      changeKeywordsStatus(extraKeywordsLabel, "PAUSED", emails, targetProportion, currentProportion);
    } else if (currentProportion < targetProportion - tolerance) {
      Logger.log("Keywords with label " + extraKeywordsLabel + " will be enabled");
      changeKeywordsStatus(extraKeywordsLabel, "ENABLED", emails, targetProportion, currentProportion);
    } else {
      Logger.log("Spending is within an acceptable range. No actions.");
    }

  } catch (e) {
    var message = "Exception on line " + e.lineNumber + ": " + e.message;
    var recipients = emails.join();
    if (recipients !== "") {
      MailApp.sendEmail(recipients, errorSubject, message);
    }
    throw new Error(message);
  }
}

function changeKeywordsStatus(label, newStatus, emails, targetProportion, currentProportion) {
  var changed = false;
  var keywords = AdsApp.keywords()
    .withCondition("LabelNames CONTAINS_ALL ['" + label + "']")
    .get();
  if (keywords.totalNumEntities() === 0) {
    throw new Error("No keywords were found with the label " + label);
  }
  while (keywords.hasNext()) {
    var keyword = keywords.next();
    if (newStatus === "PAUSED") {
      changed = pauseKeyword(keyword);
    } else if (newStatus === "ENABLED") {
      changed = enableKeyword(keyword);
    }
  }
  var recipients = emails.join();
  if (changed === true && recipients !== "") {
    if (targetProportion === null) {
      MailApp.sendEmail(
        recipients,
        "Keywords " + newStatus.toLowerCase() + " in your account",
        "Keywords with label " + label + " have been " + newStatus.toLowerCase()
        + " as it is the start of the day."
      );
    } else {
      var percentagePointsDifference = (targetProportion - currentProportion) * 100;
      percentagePointsDifference = percentagePointsDifference.toFixed(1);
      var subject = "Keywords " + newStatus.toLowerCase() + " in your account";
      var message = "Your account has spent " + (currentProportion * 100) + "% of its budget.\nThis is ";
      if (percentagePointsDifference > 0) {
        message += percentagePointsDifference + " percentage points below ";
      } else {
        message += (percentagePointsDifference * -1) + " percentage points above ";
      }
      message += " the target of " + (targetProportion * 100) + "%\n"
        + "Keywords with label " + label + " have been " + newStatus.toLowerCase() + ".\n";
      MailApp.sendEmail(recipients, subject, message);
    }
  }
}

function enableKeyword(keyword) {
  if (keyword.isPaused()) {
    keyword.enable();
    return true;
  }
  return false;
}

function pauseKeyword(keyword) {
  if (keyword.isEnabled()) {
    keyword.pause();
    return true;
  }
  return false;
}

function getDailyBudget(date, timeZone, monthlyBudget) {
  var daysInMonth = daysInCurrentMonth(date, timeZone);
  return monthlyBudget / daysInMonth;
}

function daysInCurrentMonth(date, timeZone) {
  var year = parseInt(Utilities.formatDate(date, timeZone, "yyyy"), 10);
  var month = parseInt(Utilities.formatDate(date, timeZone, "MM"), 10);
  var lastDayOfMonth = new Date(year, month, 0);
  return lastDayOfMonth.getDate();
}

function getCurrentSpendProportion(accountBudget) {
  var account = AdsApp.currentAccount();
  var stats = account.getStatsFor("TODAY");
  var cost = stats.getCost();
  return cost / accountBudget;
}

function getTargetSpendProportion(hourlyTargets, date, timeZone) {
  var hours = getHours(date, timeZone);
  var minutes = getMinutes(date, timeZone);
  var end = hourlyTargets[hours];
  var start = hours > 0 ? hourlyTargets[hours - 1] : 0;
  if (start > end) {
    throw new Error(
      "Hourly targets are not cumulative. "
      + "Target at " + (hours - 1) + " is higher than target at " + hours + "."
    );
  }
  var proportionOfHour = minutes / 60;
  var targetThisHour = (end - start) * proportionOfHour;
  return start + targetThisHour;
}

function getHours(date, timeZone) {
  return parseInt(Utilities.formatDate(date, timeZone, "HH"), 10);
}

function getMinutes(date, timeZone) {
  return parseInt(Utilities.formatDate(date, timeZone, "mm"), 10);
}
