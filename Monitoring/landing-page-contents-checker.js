// ID: ff8f0d610f23882e8e708d497707d4a9
/**
 *
 * AdWords Script for checking the contents of landing pages.
 * Goes to the final URL of keywords or ads, then searches the source code for
 * user defined strings.
 *
 * Version: 1.0
 * Google AdWords Script maintained by brainlabsdigital.com
 *
 */

function main() {
  var messagesToCheckFor = ['hey', 'jude'];
  // What out of stock messages appear on the source code of your landing pages?
  // Enter like ["Out of stock", "<em>0 available</em>"]

  var trimAtQuestionMark = true;
  // Do you want to remove all parameters which occur after the '?' character?
  // Enter true or false

  var type = 'keywords';
  // Choose "keywords" or "ads"
  // Are your final URLs at the keyword or ad level?

  var recipients = ['a@b.com'];
  // If set, these addresses will be emailed with a list of any bad URLs.
  // Enter like ["a@b.com"] or ["a@b.com","c@d.com","e@g.co.uk"]
  // Leave as [] to skip.


  // Optional filtering options
  // Enter like ["hey", "jude"]
  // Leave as [] to skip
  var containsArray = [];
  // If set, only campaigns whose names contain these phrases will be checked

  var excludesArray = [];
  // If set, campaigns whose names contain any of these phrases will be ignored.

  var labelArray = [];
  // If set, only keywords / ads with these labels will be checked
  // Case sensitive.


  // Status options
  // Choose from ["ENABLED"] if you only want enabled entities
  // ["PAUSED"] if you only want paused entities
  // ["ENABLED","PAUSED"] if you want enabled and paused entities
  var campaignStatus = ['ENABLED'];
  // The status of the campaigns

  var adGroupStatus = ['ENABLED'];
  // The status of the ad groups

  var status = ['ENABLED'];
  // The status of the keywords / ads


  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//


  var urls = [];
  var bad_urls = [];
  var urlFetchOptions = {
    muteHttpExceptions: true
  };
  var countEntities = 0;


  var conditions = [];
  if (containsArray.length > 0) {
    conditions.push(' where the campaign name contains ' + containsArray.join(', '));
  }
  if (excludesArray.length > 0) {
    conditions.push(' where the campaign name excludes ' + excludesArray.join(', '));
  }
  if (labelArray.length > 0) {
    conditions.push(' where the ' + type + ' are labelled ' + labelArray.join(', '));
  }

  if (containsArray.length === 0) {
    containsArray.push('');
  }

  for (var i = 0; i < containsArray.length; i++) {
    var string = iteratorConstructor(type, containsArray[i], excludesArray, labelArray, status, campaignStatus, adGroupStatus);
    eval(string);
    countEntities += iterator.totalNumEntities();
    excludesArray.push(containsArray[i]);
    while (iterator.hasNext()) {
      var object = iterator.next();
      var url = object.urls().getFinalUrl();

      if (url == null || url == undefined) {
        url = object.getDestinationUrl();
      }

      if (url !== null && url !== undefined) {
        if (trimAtQuestionMark) {
          url = url.split('?')[0];
        }
        if (urls.indexOf(url) === -1) {
          urls.push(url);
        }
      }
    }
  }

  if (countEntities == 0) {
    throw 'No ' + type + ' found' + conditions.join('; and');
  }
  Logger.log(countEntities + ' ' + type + ' found' + conditions.join('; and'));
  Logger.log(urls.length + ' unique URLs to check.');

  for (var x in urls) {
    var response = UrlFetchApp.fetch(urls[x], urlFetchOptions);
    var code = response.getContentText();
    for (var y = 0; y < messagesToCheckFor.length; y++) {
      var message = messagesToCheckFor[y];
      if (code.indexOf(message) !== -1) {
        bad_urls.push(urls[x]);
        break;
      }
    }
  }

  if (bad_urls.length === 0) {
    Logger.log('No bad URLs found.');
  } else {
    Logger.log(bad_urls.length + ' found:');
    Logger.log(bad_urls.join('\n'));
  }

  if (recipients.length > 0 && bad_urls.length > 0) {
    var name = AdWordsApp.currentAccount().getName();
    var subject = name + ' URL checking';
    var body = 'The following URLs were found to have one of the following phrases in their web page source code. \n\nPhrases:\n"' + messagesToCheckFor.join('",\n"') + '"\n\nURLs:\n';
    body += bad_urls.join('\n');
    MailApp.sendEmail(recipients.join(','), subject, body);
    Logger.log('Email sent to ' + recipients.join(', '));
  }

  function iteratorConstructor(type, containsString, excludesArray, labelArray, status, campaignStatus, adGroupStatus) {
    var string = 'var iterator = AdWordsApp.' + type + '()';
    if (containsString != '') {
      string = string + ".withCondition('CampaignName CONTAINS_IGNORE_CASE " + '"' + containsString + '"' + "')";
    }
    for (var i = 0; i < excludesArray.length; i++) {
      string = string + ".withCondition('CampaignName DOES_NOT_CONTAIN_IGNORE_CASE " + '"' + excludesArray[i] + '"' + "')";
    }
    if (labelArray.length > 0) {
      string = string + ".withCondition('LabelNames CONTAINS_ANY " + '["' + labelArray.join('","') + '"]' + "')";
    }

    string = string + ".withCondition('Status IN [" + status.join(',') + "]')";
    string = string + ".withCondition('CampaignStatus IN [" + campaignStatus.join(',') + "]')";
    string = string + ".withCondition('AdGroupStatus IN [" + adGroupStatus.join(',') + "]')";
    string += ".orderBy('Cost DESC').forDateRange('LAST_30_DAYS')";
    string += '.withLimit(50000)';

    string += '.get();';

    return string;
  }
}
