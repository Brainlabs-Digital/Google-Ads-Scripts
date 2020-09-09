// ID: ff803b2fcb813a43fcff09bbfeff2260
function main() {

  var validCodes = [200, 301, 302];
  //Use commas to separate recipients
  var email_recipients = "userA@example.com, userB@example.com"

  var urls = [];
  var badUrls = [];

  var keywordIterator = AdWordsApp.keywords()
    .withCondition("Status = ENABLED")
    .withCondition("AdGroupStatus = ENABLED")
    .withCondition("CampaignStatus = ENABLED")
    .get();
  while (keywordIterator.hasNext()) {
    var keyword = keywordIterator.next();
    var destinationUrl = keyword.getDestinationUrl();
    if (destinationUrl !== null && destinationUrl !== "") {
      var url = destinationUrl.split('?')[0];
      if (urls.indexOf(url) === -1) {
        urls.push(url);
      }
    }
  }

  var urlFetchOptions = { muteHttpExceptions: true };


  for (var x = 0; x < urls.length; x++) {
    try {
      var response = UrlFetchApp.fetch(urls[x], urlFetchOptions);
      var code = response.getResponseCode();
    }
    catch (err) {
      Logger.log("The Url " + urls[x] + " could not be processed");
    }
    if (validCodes.indexOf(code) === -1) {
      badUrls.push(urls[x]);
      Logger.log(urls[x]);
    }
  }

  if (badUrls.length !== 0) {

    var accountName = AdWordsApp.currentAccount().getName();

    var subject = accountName + " - Broken Destination URLs";
    var body = "The following are broken URLs in the account " + accountName +
      ". Also attached is a CSV file containing the URLs. \n\n" + badUrls.join("\n");
    var options = {
      attachments: [Utilities.newBlob(badUrls.join("\n"), "text/csv", accountName +
        " - Broken destination URLs.csv")]
    };
    MailApp.sendEmail(email_recipients, subject, body, options);
  }
}
