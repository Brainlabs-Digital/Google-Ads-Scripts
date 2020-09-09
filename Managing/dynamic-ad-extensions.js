// ID: bb65be1b8dfe58a70985f6b118552557
/**
*
* Dynamic Ad Extensions
*
* Script to dynamically add and/or update sitelinks and callouts and apply them to
* all campaigns or ad groups, based on definitions and variables in a Google Sheet.
*
* Version: 1.0
* Google AdWords Script maintained on brainlabsdigital.com
*
*/


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Options

var spreadsheetUrl = 'https://docs.google.com/YOUR-SPREADSHEET-URL-HERE';
// The URL of the Google Sheet with the extension definitions
// Should be a copy of https://docs.google.com/spreadsheets/d/1ROGMwhpIaZXuIsThZ6yaVKkO0Txa5aaYgNG0oM5qYgk/edit#gid=0

var emailRecipients = [];
// If set, these addresses will be emailed if there are errors when the script runs.
// Enter like ["a@b.com"] or ["a@b.com","c@d.com","e@g.co.uk"]
// Leave as [] to skip.


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

function main() {
  // This array is used to store any errors to be emailed
  var problems = {};
  problems.general = [];
  problems.sitelink = [];
  problems.callout = [];

  // Check the spreadsheet URL works
  try {
    var spreadsheet = checkSpreadsheet(spreadsheetUrl, 'the spreadsheet');
  } catch (e) {
    problems.general.push(e);
    var subject = 'Dynamic Ad Extensions - Could Not Open Spreadsheet';
    notify(problems, emailRecipients, subject);
    throw (e);
  }

  // Process sitelinks
  try {
    var charLimits = {
      hl: 25, dl1: 35, dl2: 35, url: 2048
    };
    var slSheet = spreadsheet.getSheetByName('Sitelinks');
    generateSitelinks(slSheet, charLimits, problems.sitelink);
    refreshSitelinks(slSheet, charLimits, problems.sitelink);
    applyExtensions(slSheet, 'sitelink', problems.sitelink);
  } catch (e) {
    Logger.log(e);
    problems.general.push(e);
  }

  // Process callouts
  try {
    charLimits = { callout: 25 };
    var coSheet = spreadsheet.getSheetByName('Callouts');
    generateCallouts(coSheet, charLimits, problems.callout);
    refreshCallouts(coSheet, charLimits, problems.callout);
    applyExtensions(coSheet, 'callout', problems.callout);
  } catch (e) {
    Logger.log(e);
    problems.general.push(e);
  }

  // Send error emails
  var subject = 'Dynamic Ad Extensions - problems encountered';
  notify(problems, emailRecipients, subject);

  Logger.log('Finished.');
}

/**
* Checks the spreadsheet URL has been entered, and that it works
*
* @param String  spreadsheetUrl       URL of a Google Sheet
* @param String spreadsheetName  Name of the sheet, for use in error messages
*
* @return void
*/
function checkSpreadsheet(spreadsheetUrl, spreadsheetName) {
  if (spreadsheetUrl.replace(/[AEIOU]/g, 'X') == 'https://docs.google.com/YXXR-SPRXXDSHXXT-XRL-HXRX') {
    throw ('Problem with ' + spreadsheetName + " URL: make sure you've replaced the default with a valid spreadsheet URL.");
  }
  try {
    var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
    return spreadsheet;
  } catch (e) {
    throw ('Problem with ' + spreadsheetName + " URL: '" + e + "'");
  }
}

/**
* Searches sheet for any Sitelink entries without an ID and creates them
* Inputs their IDs into Column A for future reference
*
* @param Sheet  sheet       Sheet object containing Sitelink details
* @param Object charLimits  Character limits of each entity
*
* @return void
*/
function generateSitelinks(sheet, charLimits, problems) {
  var lastRow = sheet.getLastRow();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idIndex = headers.indexOf('ID') + 1;
  var ids = sheet.getRange(2, idIndex, lastRow - 1, 1).getValues();

  // Array of row numbers missing ids
  var missingIds = [];
  for (var i = 0; i < ids.length; i++) if (ids[i][0] == '') missingIds.push(i + 2);

  Logger.log('Creating ' + missingIds.length + ' new sitelinks');

  for (var i = 0; i < missingIds.length; i++) {
    var rowNum = missingIds[i];
    var details = getSitelinkDetails(sheet, rowNum, headers, charLimits);

    // Check char limits
    var legit = true;
    var entities = ['hl', 'dl1', 'dl2', 'url'];
    for (var e in entities) if (details[entities[e]].length > charLimits[entities[e]]) legit = false;

    if (legit) {
      var builder = AdWordsApp.extensions().newSitelinkBuilder();
      var sl = builder
        .withLinkText(details.hl)
        .withDescription1(details.dl1)
        .withDescription2(details.dl2)
        .withFinalUrl(details.url)
        .withMobilePreferred(details.mobPref);

      sl = sl.build().getResult();

	  // If the script is being previewed, the sitelink won't be made,
	  // so we don't write the ID into the sheet
      if (AdWordsApp.getExecutionInfo().isPreview() || sl == null) ;
      else sheet.getRange(rowNum, 1).setValue(sl.getId());
    } else {
      Logger.log('Sitelink text too long in row ' + rowNum + ' - extension not created.');
      Logger.log(details);
      problems.push('Sitelink text too long in row ' + rowNum + ' - extension not created.');
    }
  }
}

/**
* Searches sheet for any Callout entries without an ID and creates them
* Inputs their IDs into Column A for future reference
*
* @param Sheet  sheet       Sheet object containing Callout details
* @param Object charLimits  Character limits of each entity
*
* @return void
*/
function generateCallouts(sheet, charLimits, problems) {
  var lastRow = sheet.getLastRow();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idIndex = headers.indexOf('ID') + 1;
  var ids = sheet.getRange(2, idIndex, lastRow - 1, 1).getValues();

  // Array of row numbers missing ids
  var missingIds = [];
  for (var i = 0; i < ids.length; i++) if (ids[i][0] == '') missingIds.push(i + 2);

  Logger.log('Creating ' + missingIds.length + ' new callouts');

  for (var i = 0; i < missingIds.length; i++) {
    var rowNum = missingIds[i];
    var details = getCalloutDetails(sheet, rowNum, headers, charLimits);

    // Check char limits
    var legit = details.callout.length <= charLimits.callout;

    if (legit) {
      var builder = AdWordsApp.extensions().newCalloutBuilder();
      var co = builder
        .withText(details.callout)
        .withMobilePreferred(details.mobPref);

      var callout = co.build().getResult();

	  // If the script is being previewed, the callout won't be made,
	  // so we don't write the ID into the sheet
      if (AdWordsApp.getExecutionInfo().isPreview() || callout == null) ;
      else sheet.getRange(rowNum, 1).setValue(callout.getId());
    } else {
      Logger.log('Callout text too long in row ' + rowNum + ' - extension not created.');
      problems.push('Callout text too long in row ' + rowNum + ' - extension not created.');
    }
  }
}

/**
* Pulls the existing sitelinks, substitutes vars
* If it can update existing sitelinks it does
*
* @param Sheet  sheet       Sheet object containing Sitelink details
* @param Object charLimits  Character limits of each entity
*
* @return void
*/
function refreshSitelinks(sheet, charLimits, problems) {
  var lr = sheet.getLastRow();
  var idsArray = sheet.getRange(2, 1, lr - 1).getValues();

  // Flatten ids
  var ids = [];
  for (var i = 0; i < idsArray.length; i++) {
    if (idsArray[i][0] !== undefined) ids.push(idsArray[i][0]);
    else ids.push('');
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var startIndex = headers.indexOf('Headline') + 1;

  Logger.log('Updating ' + ids.length + ' sitelinks');

  for (var i = 0; i < ids.length; i++) {
    var idString = ids[i].toString();
    var idArray = idString.split('^');
    for (var j = 0; j < idArray.length; j++) {
      var id = idArray[j];
      if (id == '') continue;

      var rowNum = i + 2;
      var details = getSitelinkDetails(sheet, rowNum, headers, charLimits);

      var sl = AdWordsApp.extensions().sitelinks().withIds([id]).get();

      // Check char limits
      var legit = true;
      var entities = ['hl', 'dl1', 'dl2', 'url'];
      for (var e in entities) if (details[entities[e]].length > charLimits[entities[e]]) legit = false;

      if (!legit) {
        // Can't update the sitelink as the new text is invalid
        Logger.log('Sitelink text too long in row ' + rowNum + ' - extension not updated.');
        problems.push('Sitelink text too long in row ' + rowNum + ' - extension not updated.');
      } else if (sl.hasNext()) {
        sl = sl.next();
        if (sl.getLinkText() !== details.hl) sl.setLinkText(details.hl);
        if (details.dl1 == '') sl.clearDescription1();
        else if (sl.getDescription1() !== details.dl1) sl.setDescription1(details.dl1);
        if (details.dl2 == '') sl.clearDescription2();
        else if (sl.getDescription2() !== details.dl2) sl.setDescription2(details.dl2);
        if (sl.urls().getFinalUrl() !== details.url) sl.urls().setFinalUrl(details.url);
        sl.setMobilePreferred(details.mobPref);

        var vals = [sl.getLinkText(), sl.getDescription1(), sl.getDescription2(), sl.urls().getFinalUrl()];
        sheet.getRange(rowNum, startIndex, 1, 4).setValues([vals]);
      } else {
        // Can't find sitelink, so clear the ID and preview from the sheet
        sheet.getRange(rowNum, 1).clear();
        sheet.getRange(rowNum, startIndex, 1, 4).clear();
      }
    }
  }
}

/**
* Pulls the existing callouts, substitutes vars
* If it can update existing callout it does
*
* @param Sheet  sheet       Sheet object containing callout details
* @param Object charLimits  Character limits of each entity
*
* @return void
*/
function refreshCallouts(sheet, charLimits, problems) {
  var lr = sheet.getLastRow();
  var idsArray = sheet.getRange(2, 1, lr - 1).getValues();

  // Flatten ids
  var ids = [];
  for (var i = 0; i < idsArray.length; i++) {
    if (idsArray[i][0] !== undefined) ids.push(idsArray[i][0]);
    else ids.push('');
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var startIndex = headers.indexOf('Callout') + 1;

  Logger.log('Updating ' + ids.length + ' callouts');

  for (var i = 0; i < ids.length; i++) {
    var idString = ids[i].toString();
    var idArray = idString.split('^');
    for (var j = 0; j < idArray.length; j++) {
      var id = idArray[j];
      if (id == '') continue;

      var rowNum = i + 2;
      var details = getCalloutDetails(sheet, rowNum, headers, charLimits);
      var callout = AdWordsApp.extensions().callouts().withIds([id]).get();

      // Check char limits
      var legit = details.callout.length <= charLimits.callout;

      if (!legit) {
        // Can't update the callout as the new text is invalid
        Logger.log('Callout text too long in row ' + rowNum + ' - extension not updated.');
        problems.push('Callout text too long in row ' + rowNum + ' - extension not updated.');
      } else if (callout.hasNext()) {
        callout = callout.next();
        if (callout.getText() !== details.callout) callout.setText(details.callout);
        callout.setMobilePreferred(details.mobPref);

        var vals = [callout.getText()];
        sheet.getRange(rowNum, startIndex).setValues([vals]);
      } else {
        // Can't find the callout so clear ID and preview from the sheet
        sheet.getRange(rowNum, 1).clear();
        sheet.getRange(rowNum, startIndex).clear();
      }
    }
  }
}

/**
* Reads the sitelink info on a row and returns it as an object
*
* @param Sheet sheet     Sheet object containing Sitelink details
* @param Int   rowNum    The row number to fetch
* @param Array headers   The header row loaded as array, used to get correct columns
* @param Object charLimits  Character limits of each entity
*
* @return Object          Object keyed by sitelink properties
*/
function getSitelinkDetails(sheet, rowNum, headers, charLimits) {
  var startIndex = headers.indexOf('Dynamic Headline');
  var row = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
  var hl = row[startIndex].toString();
  var dl1 = row[++startIndex].toString();
  var dl2 = row[++startIndex].toString();
  var url = row[++startIndex].toString();
  var mobPref = row[++startIndex];

  hl = subParamValues(hl, row, headers, charLimits.hl);
  dl1 = subParamValues(dl1, row, headers, charLimits.dl1);
  dl2 = subParamValues(dl2, row, headers, charLimits.dl2);
  url = subParamValues(url, row, headers, charLimits.url);
  mobPref = !(mobPref == 'No');

  return {
    hl: hl,
    dl1: dl1,
    dl2: dl2,
    url: url,
    mobPref: mobPref
  };
}

/**
* Reads the callout info on a row and returns it as an object
*
* @param Sheet sheet        Sheet object containing callout details
* @param Int   rowNum       The row number to fetch
* @param Array headers      The header row loaded as array, used to get correct columns
* @param Object charLimits  Character limits of each entity
*
* @return Object          Object keyed by callout properties
*/
function getCalloutDetails(sheet, rowNum, headers, charLimits) {
  var startIndex = headers.indexOf('Dynamic Callout');
  var row = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
  var callout = row[startIndex].toString();
  var mobPref = row[++startIndex];

  callout = subParamValues(callout, row, headers, charLimits.callout);
  mobPref = !(mobPref == 'No');

  return { callout: callout, mobPref: mobPref };
}

/**
* Searches the string for what vars to lookup
* Puts in var value if exists, default value otherwise
* If subbed value is too long, reverts to default
*
* @param String search   String to search
* @param Int   row       The row the extension is on
* @param Array headers   The header row loaded as array, used to get correct columns
* @param Int   limit     The character limit for the field
*
* @return String         The final string value
*/
function subParamValues(search, row, headers, limit) {
  var regex = /{var[1-9]+:[^}]*}/g;
  var matches = search.match(regex);

  var ans = search;
  for (var i = 0; matches !== null && i < matches.length; i++) {
    var match = matches[i].split('{')[1].split('}')[0].split(':');
    var varx = match[0];
    var def = match[1];
    var val = row[headers.indexOf(varx)];

    var ans = search.replace(matches[i], def);
    if (val != '') {
      var ans = search.replace(matches[i], val);
      if (ans.length <= limit) search = ans;
      else {
        ans = search.replace(matches[i], def);
        search = ans.trim();
      }
    }
  }
  return ans;
}

/**
* Creates a selector, reads sheet to apply appropriate conditions
* Applies extension to appropriate entities
* Does row by row, so new selector for each extension
*
* @param Sheet  sheet       Sheet object containing extension details
* @param Strin  type        Type of extension to add
*
* @return void
*/
function applyExtensions(sheet, type, problems) {
  var lr = sheet.getLastRow();
  var lc = sheet.getLastColumn();

  var headers = sheet.getRange(1, 1, 1, lc).getValues()[0];
  var levelIndex = headers.indexOf('Entity level');
  var includesIndex = headers.indexOf('Entity name contains');
  var excludesIndex = headers.indexOf('Entity name excludes');
  var parentIncludesIndex = headers.indexOf('Parent contains');
  var parentExcludesIndex = headers.indexOf('Parent excludes');
  var parentIsIndex = headers.indexOf('Parent is');
  var isIndex = headers.indexOf('Entity name is');
  var labelIndex = headers.indexOf('Entity has label');

  var vals = sheet.getRange(1, 1, lr, lc).getValues();

  Logger.log('Applying ' + type + 's to campaigns / ad groups');

  rows:
  for (var i = 1; i < vals.length; i++) {
    var row = vals[i];
    if (row[0] === '' && !AdWordsApp.getExecutionInfo().isPreview()) {
      Logger.log('Failed to generate ' + type + ' from row ' + i);
      problems.push('Failed to generate ' + type + ' from row ' + i);
      continue;
    }

    // Make the campaign/ad group selector
    var selector;
    var level = row[levelIndex];
    switch (level) {
      case 'Campaign':
        selector = AdWordsApp.campaigns();
        break;
      case 'Ad Group':
        selector = AdWordsApp.adGroups();
        break;
      default:
        Logger.log('Invalid level for ' + type + ' on row ' + (i + 1));
        problems.push('Invalid level for ' + type + ' on row ' + (i + 1));
        continue rows;
    }

    var is = row[isIndex].toString().split("'").join("\'");
    if (is !== '') {
      selector.withCondition("Name = '" + is + "'");
    } else {
      var includes = row[includesIndex].toString().split("'").join("\'");
      var excludes = row[excludesIndex].toString().split("'").join("\'");
      var label = row[labelIndex].toString().split("'").join("\'");

      if (includes !== '') selector.withCondition("Name CONTAINS '" + includes + "'");
      if (excludes !== '') selector.withCondition("Name DOES_NOT_CONTAIN '" + excludes + "'");
      if (label !== '') selector.withCondition("LabelNames CONTAINS_ANY ['" + label + "']");
    }

    if (level == 'Ad Group') {
      var parentIs = row[parentIsIndex].toString().split("'").join("\'");
      if (parentIs !== '') {
        selector.withCondition("CampaignName = '" + parentIs + "'");
      } else {
        var parentInclude = row[parentIncludesIndex].toString().split("'").join("\'");
        var parentExclude = row[parentExcludesIndex].toString().split("'").join("\'");

        if (parentInclude !== '') selector.withCondition("CampaignName CONTAINS '" + parentInclude + "'");
        if (parentExclude !== '') selector.withCondition("CampaignName DOES_NOT_CONTAIN '" + parentInclude + "'");
      }
    }

    // Get the extension to apply
    var ids = row[0].toString().split('^');
    for (var j = 0; j < ids.length; j++) {
      var id = ids[j];
      if (id == '') continue;

      switch (type) {
        case 'sitelink':
          var extension = AdWordsApp.extensions().sitelinks().withIds([id]).get()
            .next();
          break;
        case 'callout':
          var extension = AdWordsApp.extensions().callouts().withIds([id]).get()
            .next();
          break;
        default:
          Logger.log('Invalid type ' + type + ' inputed in applyExtensions');
          return;
      }

	  // Apply the extension to the campaigns/ad groups in the selector
      var entities = selector.get();
      while (entities.hasNext()) {
        var entity = entities.next();
        if (type == 'sitelink') entity.addSitelink(extension);
        else entity.addCallout(extension);
      }
    }
  }
}

/**
* Emails the problems that occurred during the script to the relevent recipients
*
* @param Object problems       {type : [problems]}
* @param Array email           Array of email addresses
* @param String subject        Email subject line
*
* @return void
*/
function notify(problems, recipients, subject) {
  if (recipients.length == 0) {
    // No one wants an email
    return;
  }

  var message = '';

  for (var type in problems) {
    var list = problems[type];
    for (var i = 0; i < list.length; i++) {
      message += type + ':\t' + list[i] + '\n';
    }
  }

  if (message == '') {
    Logger.log('No problems to report.');
    return;
  }

  message = 'The following problems were encountered during the script:\n' + message;

  MailApp.sendEmail(recipients.join(','), subject, message);
  Logger.log('Error email sent to ' + recipients.join(', '));
}
