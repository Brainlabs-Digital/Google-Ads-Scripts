// ID: 1ffca02c22a55e164350b80c28aa2d77
/**
 *
 * GMC Disapproval Checker
 *
 * This script checks your Google Merchant Centre for disapproved products. It will send you emails if the percentage of
 * disapproved products exceeds a specified threshold. You need to select the Shopping Content api in the Advanced Apis
 * section to run this script.
 *
 * Google AdWords Script maintained on brainlabsdigital.com
 *
 */


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Options

var merchantId = 1234567;
// Replace this with your Merchant Center ID.

var threshold = 30;
// Percentage of disapproved products you would like to be alerted by.
// Do NOT include the percentage sign in this variable.

var email = ['aa@example.com'];
// Email addresses to send the disapproval alert to.
// If there is more than one email they should be comma separated
// - e.g. ["aa@example.com", "bb@example.com"]

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Filters
// These two variables store the product ID's that we want to filter by.
// The ID's need to be in string format e.g. productIdToInclude = ["123"];
// These are actually substrings of the productId so be careful not to use
// strings which are not reasonably specific.

var productIdToInclude = [];
var productIdToExclude = [];

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Functions

function main() {

  var pageToken;
  var maxResults = 250;
  // These variables are used to fetch all the products (maximum of 250) on a page
  // in the merchant centre. We can then iterate over the pages by using the next
  // page token which is given as part of the response to our request.

  var totalProducts = 0;
  var numberDisapprovedProducts = 0;

  do {
    // This is a quick check to see if the filters supplied are valid
    checkFiltersDontContradict(productIdToInclude, productIdToExclude);

    var productStatuses = ShoppingContent.Productstatuses.list(merchantId, {
      pageToken: pageToken,
      maxResults: maxResults
    });

    // If the 'approvalStatus' of our product is not 'approved' then we say it is disapproved.
    if (productStatuses.resources) {
      for (var i = 0; i < productStatuses.resources.length; i++) {
        product = productStatuses.resources[i];
        if (satisfiesAllFilters(product)) {
          totalProducts += 1;
          if (product['destinationStatuses'][0]['approvalStatus'] == 'disapproved') {
            numberDisapprovedProducts++;
          }
        }
      }
    } else {
      Logger.log('No more products in account ' + merchantId);
    }
    // We then pull our next PageToken from our response and use it to make a new request.
    // If there is no next PageToken then we exit our iteration.
    pageToken = productStatuses.nextPageToken;
  } while (pageToken);

  disapprovalPercentage = (numberDisapprovedProducts * 100) / totalProducts;
  Logger.log(numberDisapprovedProducts + ' of ' + totalProducts
    + ' products in your account were disapproved - '
    + disapprovalPercentage.toFixed(2) + '%')

  // If our threshold is exceeded then we assemble an email with details of the alert and send it to our contact emails.
  if (disapprovalPercentage >= threshold) {

    var subject = merchantId + ' GMC Disapproval Alert Email';
    var message = numberDisapprovedProducts + ' of ' + totalProducts
      + ' products in your GMC (' + merchantId + ') were disapproved - '
      + disapprovalPercentage.toFixed(2) + '%' + '\n';

    MailApp.sendEmail(email.join(','), subject, message);
    Logger.log('Message to ' + email.join(',') + ' sent.');
  }
}

function checkFiltersDontContradict(productIdToInclude, productIdToExclude) {
  if (productIdToInclude.length && productIdToExclude.length) {
    for (var i in productIdToInclude) {
      if (productIdToExclude.indexOf(productIdToInclude[i]) > -1) {
        throw "Filters have shared values - can not include and exclude simultaneously";
      }
    }
  } else {
    return true;
  }
}

function satisfiesAllFilters(product) {
  return (satisfiesIdIncludeFilters(productIdToInclude, product)
    && satisfiesIdExcludeFilters(productIdToExclude, product));
}

function satisfiesIdIncludeFilters(productIdToInclude, product) {
  if (productIdToInclude.length) {
    for (index = 0; index < productIdToInclude.length; ++index) {
      if (product['productId'].indexOf(productIdToInclude[index]) !== -1) {
        return true;
      }
    }
    return false;
  }
  else {
    return true;
  }
}

function satisfiesIdExcludeFilters(productIdToExclude, product) {
  if (productIdToExclude.length) {
    for (index = 0; index < productIdToExclude.length; ++index) {
      if (product['productId'].indexOf(productIdToExclude[index]) == -1) {
        return true;
      }
    }
    return false;
  }
  else {
    return true;
  }
}

