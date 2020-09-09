// ID: 6ebc498a9290007f5e794c8f73fe7009
/**
 * A simple script to provide you with conversion rates.
 * You need an an API Key from https://fixer.io/product.
 */

function main() {
  var originalCurrency = 'GBP'; // 3 letter currency code for starting currency
  var targetCurrency = 'USD'; // 3 letter currency code for target currency
  var customDate = '2019-05-01'; // Date of exchange rate in form 'yyyy-MM-dd'. Leave as blank string for current exchange rates. Dates for fixer.io are valid from 2000 onwards only
  var apiKey = ''; // Get an API Key from https://fixer.io/product

  var exchangeRate = GetExchangeRate(originalCurrency, targetCurrency, customDate, apiKey);
  Logger.log(exchangeRate);
}

function GetExchangeRate(originalCurrency, targetCurrency, customDate, apiKey) {
  if (originalCurrency == targetCurrency) {
    return 1;
  }

  var url = ConstructUrl(customDate, apiKey);

  try {
    var jsonResponseString = UrlFetchApp.fetch(url).getContentText();
  } catch (err) {
    var errorMessage = 'Error has occurred. Unable to Access URL. Please check input parameters';
    Logger.log(errorMessage);
    return errorMessage;
  }

  var jsonResponseObject = JSON.parse(jsonResponseString);
  var exchangeRates = jsonResponseObject.rates;

  if (!(originalCurrency in exchangeRates)) {
    throw originalCurrency + ' not a valid currency';
  }

  if (!(targetCurrency in exchangeRates)) {
    throw targetCurrency + ' not a valid currency';
  }

  var exchangeRateToOriginalCurrency = exchangeRates[originalCurrency];
  var exchangeRateToTargetCurrency = exchangeRates[targetCurrency];

  var exchangeRate = exchangeRateToTargetCurrency / exchangeRateToOriginalCurrency;

  return exchangeRate;
}

function ConstructUrl(customDate, apiKey) {
  var baseUrl = 'http://data.fixer.io/';
  if (customDate === '') {
    customDate = 'latest';
  }
  var finalUrl = baseUrl + customDate;
  finalUrl = finalUrl + '?access_key=' + apiKey;
  return finalUrl;
}
