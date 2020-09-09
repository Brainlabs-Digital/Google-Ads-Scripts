// ID: 1394f371467113cb76547199d4caf78f
/**
 * Ad Copy Length Analysis
 *
 * Download an ad performance report for the account and break up the
 * information and aggregate by component lengths. This will create a sheet for
 * Headline1, Headline2, Headline3, Description1, Description2, Path1, Path2
 * and Headline/Description/Path, which concatenates the respective components.
 *
 * Google Ads Script
 * @author Brainlabs
 */
function main() {
  const spreadsheetUrl = "YOUR_SPREADSHEET_URL_HERE";
  const dateRange = "LAST_30_DAYS";

  const attributes = [
    "AdType",
    "Headline",
    "Description1",
    "Description2",
    "HeadlinePart1",
    "HeadlinePart2",
    "ExpandedTextAdHeadlinePart3",
    "Description",
    "ExpandedTextAdDescription2",
    "ExpandedDynamicSearchCreativeDescription2",
    "Path1",
    "Path2"
  ];

  const metrics = [
    "Clicks",
    "Impressions",
    "Cost",
    "Conversions"
  ];

  const calculatedMetrics = {
    CPC: function (d) {
      return d.Cost / d.Clicks;
    },
    CTR: function (d) {
      return d.Clicks / d.Impressions;
    },
    CPA: function (d) {
      return d.Cost / d.Conversions;
    }
  };

  const validAdTypes = [
    "EXPANDED_TEXT_AD",
    "TEXT_AD",
    "EXPANDED_DYNAMIC_SEARCH_AD",
    "DYNAMIC_SEARCH_AD",
  ];

  const query = _buildQuery(attributes.concat(metrics), validAdTypes, dateRange);
  const report = AdsApp.report(query, {
    includeZeroImpressions: false
  });

  const ads = [];
  const rows = report.rows();
  while (rows.hasNext()) {
    var row = rows.next();
    ads.push(_normalised(row));
  }

  /**
   * The variables affecting performance:
   */
  const variables = [
    "Headline",
    "Headline1",
    "Headline2",
    "Headline3",
    "Description",
    "Description1",
    "Description2",
    "Path",
    "Path1",
    "Path2"
  ];

  var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);

  const groupSummer = GroupSummer(ads, metrics);
  const formatter = Formatter("# chars", ["# ads"].concat(metrics), calculatedMetrics);

  const numColumns = 2 + metrics.length + Object.keys(calculatedMetrics).length;

  variables.forEach(function (varname) {
    const table = formatter(groupSummer(varname));
    const sheet = spreadsheet.getSheetByName(varname) || spreadsheet.insertSheet(varname);

    const range = sheet.getRange(1, 1, table.length, numColumns);
    range.setValues(table);

    const maxRows = sheet.getMaxRows();
    const maxCols = sheet.getMaxColumns();

    // Prune the sheet.
    if (maxRows > table.length) {
      sheet.deleteRows(table.length + 1, maxRows - table.length);
    }
    if (maxCols > numColumns) {
      sheet.deleteColumns(numColumns + 1, maxCols - numColumns);
    }
  });
}

/**
 * @param {string[]} fields Fields to include in the report
 * @param {string[]} validAdTypes Ad types to filter by
 * @param {string} dateRange Date range for metrics
 */
function _buildQuery(fields, validAdTypes, dateRange) {
  return "SELECT " + fields.join(", ")
    + " FROM AD_PERFORMANCE_REPORT"
    + " WHERE AdType IN [" + validAdTypes.join(", ") + "]"
    + " AND Impressions > 0"
    + " DURING " + dateRange;
}

function Formatter(keyName, metrics, calculations) {
  var calculatedMetrics = Object.keys(calculations);
  var header = [keyName].concat(metrics, calculatedMetrics);

  /**
   * Format the aggregated data from GroupSummer into a table as a 2d array.
   */
  return function (aggregate) {

    // Get the number of characters in increasing order.
    var keys = Object.keys(aggregate);
    keys.sort(function (i, j) {
      return i - j;
    });

    var rows = keys.map(function (key) {
      var data = aggregate[key];

      var performanceData = metrics.map(function (m) {
        return data[m];
      });

      var calculatedData = calculatedMetrics.map(function (c) {
        return calculations[c](data);
      });

      return [key].concat(performanceData, calculatedData);
    });

    return [header].concat(rows);
  };
}

function GroupSummer(ads, metrics) {
  /**
  * Get the sum of all the metrics, grouped by the length of the number
  * of characters in `field`.
  */
  return function (field) {
    function reducer(result, ad) {
      const numCharacters = ad[field].length;

      const aggregate = result[numCharacters] || {
        "# ads": 0
      };

      aggregate["# ads"] += 1;

      metrics.forEach(function (m) {
        aggregate[m] = parseFloat(ad[m]) + (aggregate[m] || 0);
      });

      result[numCharacters] = aggregate;
      return result;
    }

    const result = ads.reduce(reducer, {});
    return result;
  };
}

/**
 * Convert a row from an AD_PERFORMANCE_REPORT into a normalised structure
 * for an ad.
 */
function _normalised(row) {
  const ad = Object.create(row);

  ad.Headline1 = row.HeadlinePart1 || row.Headline;
  ad.Headline2 = row.HeadlinePart2 || "";
  ad.Headline3 = row.ExpandedTextAdHeadlinePart3 || "";
  ad.Description1 = row.Description || row.Description1 || "";
  ad.Description2 = row.Description2 || row.ExpandedTextAdDescription2 || row.ExpandedDynamicSearchCreativeDescription2 || "";

  ad.Headline = ad.Headline1 + ad.Headline2 + ad.Headline3;
  ad.Description = ad.Description1 + ad.Description2;
  ad.Path = ad.Path1 + ad.Path2;

  return ad;
}
