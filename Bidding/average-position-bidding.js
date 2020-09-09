// ID: fc0e24f9577d1f8f2279b1e5d4ee50f9
/**
 *
 * Average Position Bidding Tool
 *
 * This script changes keyword bids so that they target specified positions,
 * based on recent performance.
 *
 * Version: 1.5
 * Updated 2015-09-28 to correct for report column name changes
 * Updated 2016-02-05 to correct label reading, add extra checks and
 * be able to adjust maximum bid increases and decreases separately
 * Updated 2016-08-30 to correct label reading from reports
 * Updated 2016-09-14 to update keywords in batches
 * Updated 2016-10-26 to avoid DriveApp bug
 * Google AdWords Script maintained on brainlabsdigital.com
 *
 */

// Options

var maxBid = 3.00;
// Bids will not be increased past this maximum.

var minBid = 0.15;
// Bids will not be decreased below this minimum.

var firstPageMaxBid = 0.90;
// The script avoids reducing a keyword's bid below its first page bid estimate. If you think
// Google's first page bid estimates are too high then use this to overrule them.

var dataFile = 'AveragePositionData.txt';
// This name is used to create a file in your Google Drive to store today's performance so far,
// for reference the next time the script is run.

var useFirstPageBidsOnKeywordsWithNoImpressions = false;
// If this is true, then if a keyword has had no impressions since the last time the script was run
// its bid will be increased to the first page bid estimate (or the firsPageMaxBid if that is smaller).
// If this is false, keywords with no recent impressions will be left alone.

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

// Advanced Options
var bidIncreaseProportion = 0.2;
var bidDecreaseProportion = 0.2;
var targetPositionTolerance = 0.3;

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

function main() {
  var fieldJoin = ',';
  var lineJoin = '$';
  var idJoin = '#';

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  var files = DriveApp.getFilesByName(dataFile);
  if (!files.hasNext()) {
    var file = DriveApp.createFile(dataFile, '\n');
    Logger.log("File '" + dataFile + "' has been created.");
  } else {
    var file = files.next();
    if (files.hasNext()) {
      Logger.log("Error - more than one file named '" + dataFile + "'");
      return;
    }
    Logger.log("File '" + dataFile + "' has been read.");
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  var labelIds = [];

  var labelIterator = AdWordsApp.labels()
    .withCondition('KeywordsCount > 0')
    .withCondition("LabelName CONTAINS_IGNORE_CASE 'Position '")
    .get();

  while (labelIterator.hasNext()) {
    var label = labelIterator.next();
    if (label.getName().substr(0, 'position '.length).toLowerCase() == 'position ') {
      labelIds.push(label.getId());
    }
  }

  if (labelIds.length == 0) {
    Logger.log('No position labels found.');
    return;
  }
  Logger.log(labelIds.length + ' position labels have been found.');

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  var keywordData = {
    // UniqueId1: {LastHour: {Impressions: , AveragePosition: }, ThisHour: {Impressions: , AveragePosition: },
    // CpcBid: , FirstPageCpc: , MaxBid, MinBid, FirstPageMaxBid, PositionTarget: , CurrentAveragePosition:,
    // Criteria: }
  };

  var ids = [];
  var uniqueIds = [];

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  var report = AdWordsApp.report(
    'SELECT Id, Criteria, AdGroupId, AdGroupName, CampaignName, Impressions, AveragePosition, CpcBid, FirstPageCpc, Labels, BiddingStrategyType '
    + 'FROM KEYWORDS_PERFORMANCE_REPORT '
    + 'WHERE Status = ENABLED AND AdGroupStatus = ENABLED AND CampaignStatus = ENABLED '
    + 'AND LabelIds CONTAINS_ANY [' + labelIds.join(',') + '] '
    + 'AND AdNetworkType2 = SEARCH '
    + 'AND Device NOT_IN ["HIGH_END_MOBILE"] '
    + 'DURING TODAY'
  );

  var rows = report.rows();

  while (rows.hasNext()) {
    var row = rows.next();

    if (row.BiddingStrategyType != 'cpc') {
      if (row.BiddingStrategyType == 'Enhanced CPC'
        || row.BiddingStrategyType == 'Target search page location'
        || row.BiddingStrategyType == 'Target Outranking Share'
        || row.BiddingStrategyType == 'None'
        || row.BiddingStrategyType == 'unknown') {
        Logger.log('Warning: keyword ' + row.Criteria + "' in campaign '" + row.CampaignName
          + "' uses '" + row.BiddingStrategyType + "' rather than manual CPC. This may overrule keyword bids and interfere with the script working.");
      } else {
        Logger.log('Warning: keyword ' + row.Criteria + "' in campaign '" + row.CampaignName
          + "' uses the bidding strategy '" + row.BiddingStrategyType + "' rather than manual CPC. This keyword will be skipped.");
        continue;
      }
    }

    var positionTarget = '';

    if (row.Labels.trim() == '--') {
      continue;
    }
    var labels = JSON.parse(row.Labels.toLowerCase()); // Labels are returned as a JSON formatted string

    for (var i = 0; i < labels.length; i++) {
      if (labels[i].substr(0, 'position '.length) == 'position ') {
        var positionTarget = parseFloat(labels[i].substr('position '.length - 1).replace(/,/g, '.'), 10);
        break;
      }
    }
    if (positionTarget == '') {
      continue;
    }
    if (integrityCheck(positionTarget) == -1) {
      Logger.log("Invalid position target '" + positionTarget + "' for keyword '" + row.Criteria + "' in campaign '" + row.CampaignName + "'");
      continue;
    }

    ids.push(parseFloat(row.Id, 10));
    var uniqueId = row.AdGroupId + idJoin + row.Id;
    uniqueIds.push(uniqueId);

    keywordData[uniqueId] = {};
    keywordData[uniqueId].Criteria = row.Criteria;
    keywordData[uniqueId].ThisHour = {};

    keywordData[uniqueId].ThisHour.Impressions = parseFloat(row.Impressions.replace(/,/g, ''), 10);
    keywordData[uniqueId].ThisHour.AveragePosition = parseFloat(row.AveragePosition.replace(/,/g, ''), 10);

    keywordData[uniqueId].CpcBid = parseFloat(row.CpcBid.replace(/,/g, ''), 10);
    keywordData[uniqueId].FirstPageCpc = parseFloat(row.FirstPageCpc.replace(/,/g, ''), 10);

    setPositionTargets(uniqueId, positionTarget);
  }

  Logger.log(uniqueIds.length + ' labelled keywords found');

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  setBidChange();
  setMinMaxBids();

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  var currentHour = parseInt(Utilities.formatDate(new Date(), AdWordsApp.currentAccount().getTimeZone(), 'HH'), 10);

  if (currentHour != 0) {
    var data = file.getBlob().getDataAsString();
    var data = data.split(lineJoin);
    for (var i = 0; i < data.length; i++) {
      data[i] = data[i].split(fieldJoin);
      var uniqueId = data[i][0];
      if (keywordData.hasOwnProperty(uniqueId)) {
        keywordData[uniqueId].LastHour = {};
        keywordData[uniqueId].LastHour.Impressions = parseFloat(data[i][1], 10);
        keywordData[uniqueId].LastHour.AveragePosition = parseFloat(data[i][2], 10);
      }
    }
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  findCurrentAveragePosition();

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  // Batch the keyword IDs, as the iterator can't take them all at once
  var idBatches = [];
  var batchSize = 5000;
  for (var i = 0; i < uniqueIds.length; i += batchSize) {
    idBatches.push(uniqueIds.slice(i, i + batchSize));
  }

  Logger.log('Updating keywords');

  // Update each batch
  for (var i = 0; i < idBatches.length; i++) {
    try {
      updateKeywords(idBatches[i]);
    } catch (e) {
      Logger.log('Error updating keywords: ' + e);
      Logger.log('Retrying after one minute.');
      Utilities.sleep(60000);
      updateKeywords(idBatches[i]);
    }
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  Logger.log('Writing file.');
  var content = resultsString();
  file.setContent(content);

  Logger.log('Finished.');

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  // Functions

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  function integrityCheck(target) {
    var n = parseFloat(target, 10);
    if (!isNaN(n) && n >= 1) {
      return n;
    }
    return -1;
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  function setPositionTargets(uniqueId, target) {
    if (target !== -1) {
      keywordData[uniqueId].HigherPositionTarget = Math.max(target - targetPositionTolerance, 1);
      keywordData[uniqueId].LowerPositionTarget = target + targetPositionTolerance;
    } else {
      keywordData[uniqueId].HigherPositionTarget = -1;
      keywordData[uniqueId].LowerPositionTarget = -1;
    }
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  function bidChange(uniqueId) {
    var newBid = -1;
    if (keywordData[uniqueId].HigherPositionTarget === -1) {
      return newBid;
    }

    var cpcBid = keywordData[uniqueId].CpcBid;
    var minBid = keywordData[uniqueId].MinBid;
    var maxBid = keywordData[uniqueId].MaxBid;

    if (isNaN(keywordData[uniqueId].FirstPageCpc)) {
      Logger.log("Warning: first page CPC estimate is not a number for keyword '" + keywordData[uniqueId].Criteria + "'. This keyword will be skipped");
      return -1;
    }

    var firstPageBid = Math.min(keywordData[uniqueId].FirstPageCpc, keywordData[uniqueId].FirstPageMaxBid, maxBid);

    var currentPosition = keywordData[uniqueId].CurrentAveragePosition;
    var higherPositionTarget = keywordData[uniqueId].HigherPositionTarget;
    var lowerPositionTarget = keywordData[uniqueId].LowerPositionTarget;

    var bidIncrease = keywordData[uniqueId].BidIncrease;
    var bidDecrease = keywordData[uniqueId].BidDecrease;

    if ((currentPosition > lowerPositionTarget) && (currentPosition !== 0)) {
      var linearBidModel = Math.min(2 * bidIncrease, (2 * bidIncrease / lowerPositionTarget) * (currentPosition - lowerPositionTarget));
      var newBid = Math.min((cpcBid + linearBidModel), maxBid);
    }
    if ((currentPosition < higherPositionTarget) && (currentPosition !== 0)) {
      var linearBidModel = Math.min(2 * bidDecrease, ((-4) * bidDecrease / higherPositionTarget) * (currentPosition - higherPositionTarget));
      var newBid = Math.max((cpcBid - linearBidModel), minBid);
      if (cpcBid > firstPageBid) {
        var newBid = Math.max(firstPageBid, newBid);
      }
    }
    if ((currentPosition === 0) && useFirstPageBidsOnKeywordsWithNoImpressions && (cpcBid < firstPageBid)) {
      var newBid = firstPageBid;
    }

    if (isNaN(newBid)) {
      Logger.log("Warning: new bid is not a number for keyword '" + keywordData[uniqueId].Criteria + "'. This keyword will be skipped");
      return -1;
    }

    return newBid;
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  function findCurrentAveragePosition() {
    for (var x in keywordData) {
      if (keywordData[x].hasOwnProperty('LastHour')) {
        keywordData[x].CurrentAveragePosition = calculateAveragePosition(keywordData[x]);
      } else {
        keywordData[x].CurrentAveragePosition = keywordData[x].ThisHour.AveragePosition;
      }
    }
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  function calculateAveragePosition(keywordDataElement) {
    var lastHourImpressions = keywordDataElement.LastHour.Impressions;
    var lastHourAveragePosition = keywordDataElement.LastHour.AveragePosition;

    var thisHourImpressions = keywordDataElement.ThisHour.Impressions;
    var thisHourAveragePosition = keywordDataElement.ThisHour.AveragePosition;

    if (thisHourImpressions == lastHourImpressions) {
      return 0;
    }
    var currentPosition = (thisHourImpressions * thisHourAveragePosition - lastHourImpressions * lastHourAveragePosition) / (thisHourImpressions - lastHourImpressions);
    if (currentPosition < 1) {
      return 0;
    }
    return currentPosition;
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  function keywordUniqueId(keyword) {
    var id = keyword.getId();
    var idsIndex = ids.indexOf(id);
    if (idsIndex === ids.lastIndexOf(id)) {
      return uniqueIds[idsIndex];
    }
    var adGroupId = keyword.getAdGroup().getId();
    return adGroupId + idJoin + id;
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  function setMinMaxBids() {
    for (var x in keywordData) {
      keywordData[x].MinBid = minBid;
      keywordData[x].MaxBid = maxBid;
      keywordData[x].FirstPageMaxBid = firstPageMaxBid;
    }
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  function setBidChange() {
    for (var x in keywordData) {
      keywordData[x].BidIncrease = keywordData[x].CpcBid * bidIncreaseProportion / 2;
      keywordData[x].BidDecrease = keywordData[x].CpcBid * bidDecreaseProportion / 2;
    }
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  function updateKeywords(idBatch) {
    var keywordIterator = AdWordsApp.keywords()
      .withIds(idBatch.map(function (str) {
        return str.split(idJoin);
      }))
      .get();
    while (keywordIterator.hasNext()) {
      var keyword = keywordIterator.next();

      var uniqueId = keywordUniqueId(keyword);

      var newBid = bidChange(uniqueId);

      if (newBid !== -1) {
        keyword.setMaxCpc(newBid);
      }
    }
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  function resultsString() {
    var results = [];
    for (var uniqueId in keywordData) {
      var resultsRow = [uniqueId, keywordData[uniqueId].ThisHour.Impressions, keywordData[uniqueId].ThisHour.AveragePosition];
      results.push(resultsRow.join(fieldJoin));
    }

    return results.join(lineJoin);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
}
