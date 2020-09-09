// ID: 3ebf0d21c98263edc9e4ff2fb77284bf
/**
* Copying Labels From Keywords To Ads Or Vice-Versa
*
* If a certain percentage of keywords (or ads) are labelled with a particular
* label within an ad group, the script applies the label to all ads (or
* keywords) in that ad group.
*
* Version: 1.0
* Google AdWords Script maintained on brainlabsdigital.com
*/

//***************************************************************************//
//***************************************************************************//

var labelNames = ['Label 1', 'Label 2'];
// Set which labels should be copied.
// For example, ["January Only", "February Only"] would only copy
// the labels 'January Only' and 'February Only'.

var copyLabelsFrom = 'Keyword';
// Set which type of entity the labels should be copied from.
// This can take any of two possible values: "Ad" and "Keyword".

var copyLabelsTo = 'Ad';
// Set which type of entity the labels should be copied to.
// This can take any of two possible values: "Ad" and "Keyword",
// and it can't have the same value as copyLabelsFrom.

var threshold = 0.5;
// The proportion of entities of the type copyLabelsFrom that must be labelled for the
// entities of the type copyLabelsTo to be labelled.
// For instance, if copyLabelsTo is "Keyword" and copyLabelsFrom is "Ad", then 1 means
// the keywords are only labelled if all ads are labelled.
// 0.9 means the keywords are labelled if at least 90% of ads are labelled.
// 0 means the keywords are labelled if at least one ad is labelled.

var campaignNameDoesNotContain = [];
// Use this if you want to exclude some campaigns.
// For example ["Display"] would ignore any campaigns with 'Display' in the name,
// while ["Display","Shopping"] would ignore any campaigns with 'Display' or
// 'Shopping' in the name.
// Leave as [] to not exclude any campaigns.

var campaignNameContains = [];
// Use this if you only want to look at some campaigns.
// For example ["Brand"] would only look at campaigns with 'Brand' in the name,
// while ["Brand","Generic"] would only look at campaigns with 'Brand' or 'Generic'
// in the name.
// Leave as [] to include all campaigns.

var ignorePausedCampaigns = true;
// Set this to true to only look at currently active campaigns.
// Set to false to also include campaigns that are currently paused.

var ignorePausedAdGroups = true;
// Set this to true to only look at currently active ad groups.
// Set to false to also include ad groups that are currently paused.

var ignorePausedAdsAndKeywords = true;
// Set this to true to only look at currently active keywords and ads.
// Set to false to also include keywords and ads that are currently paused.

//***************************************************************************//
//***************************************************************************//

var countLabelledEntities = {};
var labelChecks = {};
labelNames.forEach(function(labelName) {
  labelChecks[labelName] = false;
});

function main()
{
  validateEntityTypes(copyLabelsFrom, copyLabelsTo);
  validateNumber("threshold", threshold, 0, 1);
  validateLabelNames(labelNames);
  copyLabels();
  checkLabelsAreNotUseless();
}

/**
 * Works out which proportion of entities are labelled and labels accordingly.
 * @return void
 */
function copyLabels()
{
  var campaignIds = getEntityIds('Campaign', [], []);
  var adGroupIds = getEntityIds('AdGroup', campaignIds, []);
  Logger.log('Looking at which entities have which labels...');
  for (var i = 0; i < adGroupIds.length; i += 10000) {
    var batchOfAdGroupIds = adGroupIds.slice(i, i + 10000);
    var reportForCopyLabelsFrom = downloadBottomLevelReport(
      copyLabelsFrom,
      batchOfAdGroupIds
    );
    var counts = getCounts(reportForCopyLabelsFrom);
    updateLabelChecks(counts);
    var ratios = getRatios(counts);
    
    Logger.log('Labelling ' + copyLabelsTo.toLowerCase() + 's, if appropriate...');
    labelEntities(ratios);
    logWhatHasBeenLabelled();
  }
}

/**
 * @param  Report report
 * @return object (keyed by ad group IDs and then by label name)
 */
function getCounts(report)
{
  var counts = {};
  var rows = report.rows();
  while (rows.hasNext()) {
    var row = rows.next();
    var adGroupId = row['AdGroupId'];
    if (!(adGroupId in counts)) {
      counts[adGroupId] = {};
      counts[adGroupId]['Total'] = 0;
    }
    counts[adGroupId]['Total'] += 1;    

    if (row['Labels'] === "--") {
      var labelsThatTheEntityHas = [];
    } else {
      var labelsThatTheEntityHas = JSON.parse(row['Labels']);
    }

    labelsThatTheEntityHas.forEach(function(entityLabelName) {
      if (labelNames.indexOf(entityLabelName) > -1) {
        if (!(entityLabelName in counts[adGroupId])) {
          counts[adGroupId][entityLabelName] = 0;
        }
        counts[adGroupId][entityLabelName] += 1;
      }
    });
  }

  return cleanUpCounts(counts);
}

/**
 * Removes any values keyed by an ad group ID whose ad group
 * does not have any of the relevant labels
 * @param  object counts
 * @return counts
 */
function cleanUpCounts(counts)
{
  for (var adGroupId in counts) {
    var hasSomeLabel = false;
    labelNames.forEach(function(labelName) {
      if (labelName in counts[adGroupId]) {
        hasSomeLabel = true;
      } 
    });
    if (!hasSomeLabel) {
      delete counts[adGroupId];
    }
  }
  return counts;
}

/**
 * Calculates ratios from counts
 * @param  object counts (keyed by ad group IDs and then by label name)
 * @return object (keyed in the same way) 
 */
function getRatios(counts)
{
  var ratios = {};
  for (var adGroupId in counts) {
    ratios[adGroupId] = {};
    labelNames.forEach(function(labelName) {
      if (labelName in counts[adGroupId]) {
        ratios[adGroupId][labelName] = counts[adGroupId][labelName] / counts[adGroupId]['Total'];
      }
    });
  }
  return ratios;
}

/**
 * Breaks everything that needs to be labelled into
 * manageable batches and then labels it
 * @param  object ratios (keyed by ad group IDs and then by label name)
 * @return void
 */
function labelEntities(ratios)
{
  var batchOfAdGroupIds = Object.keys(ratios);
  var batchOfIdsToLabel = getEntityIds(
    copyLabelsTo,
    batchOfAdGroupIds,
    []
  );
  for (var j = 0; j < batchOfIdsToLabel.length; j += 10000) {
    var subBatchOfIdsToLabel = batchOfIdsToLabel.slice(j, j + 10000);
    labelBatchOfEntities(subBatchOfIdsToLabel, ratios);
  }
}

/**
 * Labels a batch of entities
 * @param  array batchOfIds
 * @param  object ratios (keyed by ad group IDs and then by label name)
 * @return void
 */
function labelBatchOfEntities(batchOfIds, ratios)
{
  var selector = getSelector(copyLabelsTo, batchOfIds);
  labelNames.forEach(function(labelName) {
    selector = selector.withCondition("LabelNames CONTAINS_NONE ['" + labelName + "']");
    var iterator = selector.get();
    while (iterator.hasNext()) {
      var entity = iterator.next();
      var adGroupId = entity.getAdGroup().getId();
      if (adGroupId in ratios && labelName in ratios[adGroupId]) {
        if (ratios[adGroupId][labelName] > threshold) {
          entity.applyLabel(labelName);
          countLabelledEntities[labelName] += 1;
        }
      }
    } 
  });
}

/**
 * Looks at the current state of countLabelledEntities
 * and prints a message with this information
 * @return void
 */
function logWhatHasBeenLabelled()
{
  for (var labelName in countLabelledEntities) {
    var message = countLabelledEntities[labelName] + " " + copyLabelsTo.toLowerCase() + "s";
    message += " have been labelled with the label '" + labelName + "'.";
    Logger.log(message);
  }
}

/**
 * Looks through the current counts and updates labelChecks
 * if something has been labelled with one of the relevant labels
 * @param  object counts (keyed by ad group IDs and then by label name)
 * @return void
 */
function updateLabelChecks(counts)
{
  labelNames.forEach(function(labelName) {
    for (var adGroupId in counts) {
      if (counts[adGroupId][labelName] > 0) {
        labelChecks[labelName] = true;
      }
    }
  });
}

/**
 * Checks, for each label provided, whether there is
 * something labelled with it; if not, it logs a warning message
 * @return void
 */
function checkLabelsAreNotUseless()
{
  labelNames.forEach(function(labelName) {
    if (!labelChecks[labelName]) {
      var message = "Warning: there do not seem to be any " + copyLabelsFrom.toLowerCase() + "s";
      message += " labelled with the label name '" + labelName + "'.";
      Logger.log(message);
    }
  });
}

/**
 * Downloads a report either for ads or for keywords
 * @param  string entityType (will be passed copyLabelsFrom)
 * @param  array adGroupIds
 * @return Report
 */
function downloadBottomLevelReport(entityType, adGroupIds)
{
  var whereStatement = "WHERE ";
  var idForReport = "Id";
  whereStatement += "AdGroupId IN [" + adGroupIds.join(",") + "] AND ";
  if (ignorePausedAdsAndKeywords) {
    whereStatement += "Status = ENABLED ";
  } else {
    whereStatement += "Status IN ['ENABLED','PAUSED'] ";
  }

  var query = "SELECT ";
  query += idForReport + "," + "AdGroupId,Labels ";
  query += "FROM " + getReportType(entityType) + " ";
  query += whereStatement;
  query += "DURING LAST_30_DAYS";
  
  var report = AdWordsApp.report(query);
  return report;
}

/**
 * This function is pretty general. It gets entity IDs with possible filters.
 * @param  string entityType     any of 'Campaign', 'AdGroup', 'Keyword', 'Ad' 
 * @param  array  oneLevelUpIds  array of IDs to filter by, one level above.
 *                               Pass it an empty array if no filter is required.
 * @param  array  twoLevelsUpIds array of IDs to filter by, two levels above.
 *                               It only makes sense to use this for ads
 *                               and for keywords, and even then only if
 *                               oneLevelUpIds has been passed an empty array.
 *                               Pass it an empty array if no filter is required.
 * @return array
 * @throws error if entity type is not recognised
 *               or if no entity IDs pass the filters.
 */
function getEntityIds(entityType, oneLevelUpIds, twoLevelsUpIds)
{
  var whereStatement = "WHERE ";
  var whereStatementsArray = [];
  var entityIds = [];
  
  switch (entityType) {
    case "Campaign":
      var idForReport = "CampaignId";
      if (ignorePausedCampaigns) {
        whereStatement += "CampaignStatus = ENABLED ";
      } else {
        whereStatement += "CampaignStatus IN ['ENABLED','PAUSED'] ";
      }

      campaignNameDoesNotContain.forEach(function(word) {
        whereStatement += "AND CampaignName DOES_NOT_CONTAIN_IGNORE_CASE '" + word.replace(/"/g,'\\\"') + "' ";
      });
      
      if (campaignNameContains.length === 0) {
          whereStatementsArray = [whereStatement];
      } else {
        campaignNameContains.forEach(function(word) {
          whereStatementsArray.push(whereStatement + 'AND CampaignName CONTAINS_IGNORE_CASE "' + word.replace(/"/g,'\\\"') + '" '); 
        });
      }

      break;

    case "AdGroup":
      var idForReport = "AdGroupId";
      if (oneLevelUpIds.length > 0) {
        var oneLevelUpName = "Campaign";
        whereStatement += oneLevelUpName + "Id IN [" + oneLevelUpIds.join(",") + "] AND ";
      }
      if (ignorePausedAdGroups) {
        whereStatement += "AdGroupStatus = ENABLED ";
      } else {
        whereStatement += "AdGroupStatus IN ['ENABLED','PAUSED'] ";
      }
      whereStatementsArray.push(whereStatement);
      break;
    
    case "Keyword": // Fallthrough
    case "Ad":
      var idForReport = 'Id';
      if (oneLevelUpIds.length > 0) {
        var oneLevelUpName = "AdGroup";
        whereStatement += oneLevelUpName + "Id IN [" + oneLevelUpIds.join(",") + "] AND ";
      }
      if (twoLevelsUpIds.length > 0) {
        var twoLevelsUpName = "Campaign";
        whereStatement += twoLevelsUpName + "Id IN [" + twoLevelsUpIds.join(",") + "] AND ";
      }
      if (ignorePausedAdsAndKeywords) {
        whereStatement += "Status = ENABLED ";
      } else {
        whereStatement += "Status IN ['ENABLED','PAUSED'] ";
      }
      whereStatementsArray.push(whereStatement);
      break;

    default:
      throw new Error("Type " + entityType + " not recognised");
  }
  
  whereStatementsArray.forEach(function(statement) {
    var query = "SELECT ";
    if (entityType === "Keyword" || entityType === "Ad") {
      query += idForReport + "," + "AdGroupId ";
    } else {
      query += idForReport + " ";
    }
    query += "FROM " + getReportType(entityType) + " ";
    query += statement;
    query += "DURING LAST_30_DAYS";
    
    var report = AdWordsApp.report(query);
    var rows = report.rows();
    while (rows.hasNext()) {
      var row = rows.next();
      if (entityType === "Keyword" || entityType === "Ad") {
        entityIds.push([row["AdGroupId"], row[idForReport]]);
      } else {
        entityIds.push(row[idForReport]);
      }
    }
  });
    
  if (entityIds.length == 0) {
    throw new Error("No " + entityType + "s found with the given settings.");
  }
  
  if (entityType === "Campaign") {
    Logger.log("Number of " + entityType.toLowerCase() + "s found: " + entityIds.length);
  }
  return entityIds;
}

/**
 * Returns a selector containing entities with the given IDs
 * @param  string entityType
 * @param  array batchOfIds
 * @return Selector
 * @throws error if entity type is not recognised
 */
function getSelector(entityType, batchOfIds)
{
  switch (entityType) {
    case 'Campaign':
      var selector = AdWordsApp.campaigns();
      break;
    case 'AdGroup':
      var selector = AdWordsApp.adGroups();
      break;
    case 'Ad':
      var selector = AdWordsApp.ads();
      break;
    case 'Keyword':
      var selector = AdWordsApp.keywords();
      break;
    default:
      throw new Error("Type '" + entityType + "' not recognised");
  }
  selector = selector.withIds(batchOfIds);
  return selector;
}

/**
 * Returns the correct name of the report for the given entity
 * @param  string entityType
 * @return string
 * @throws error if entity type is not recognised
 */
function getReportType(entityType) {
  switch(entityType) {
    case "Campaign":
      return "CAMPAIGN_PERFORMANCE_REPORT";
    case "AdGroup":
      return "ADGROUP_PERFORMANCE_REPORT";
    case "Keyword":
      return "KEYWORDS_PERFORMANCE_REPORT";
    case "Ad":
      return "AD_PERFORMANCE_REPORT";
    case "Label":
      return "LABEL_REPORT";
    default:
      throw new Error("Type '" + entityType + "'' not recognised");
  }
}

/**
 * Validates entity types names
 * @param  string copyLabelsFrom
 * @param  string copyLabelsTo
 * @return void
 * @throws error if one of the two entity names is not recognised
 *               or if they are the same
 */
function validateEntityTypes(copyLabelsFrom, copyLabelsTo)
{
  copyLabelsFrom = capitaliseCorrectly(copyLabelsFrom);
  copyLabelsTo = capitaliseCorrectly(copyLabelsTo);
  if (!((copyLabelsFrom === 'Ad' && copyLabelsTo === 'Keyword') ||
      (copyLabelsFrom === 'Keyword' && copyLabelsTo === 'Ad'))
  ) {
    throw new Error("copyLabelsFrom and copyLabelsTo cannot be the same.");
  }
}

/**
 * Makes the entity type name the right capitalisation
 * @param  string entityType
 * @return string
 * @throws error if the entity type name is not recognised
 */
function capitaliseCorrectly(entityType)
{
  var lowerCaseName = entityType.toLowerCase().replace(/ /g,"");
  if (lowerCaseName.substr(-1) == "s") {
    lowerCaseName = lowerCaseName.slice(0,-1);
  }
  var correctCapitalisation = {};
  correctCapitalisation["keyword"] = "Keyword";
  correctCapitalisation["ad"] = "Ad";
  if (!(lowerCaseName in correctCapitalisation)) {
    throw new Error("Level name '" + entityType + "' not recognised.");
  }
  return correctCapitalisation[lowerCaseName];
}

/**
 * Validates a number (to be used for the threshold)
 * @param  string name
 * @param  float number
 * @param  float lowerBound
 * @param  float upperBound
 * @return void
 * @throws error if the threshold isn't right
 */
function validateNumber(name, number, lowerBound, upperBound)
{
  if (isNaN(number)) {
    throw new Error(name + " must be a number, '" + number + "' is not.");
  }
  if (number < lowerBound) {
    throw new Error(name + " must be " + lowerBound + " or greater, '" + number + "' is not.");
  }
  if (number > upperBound) {
    throw new Error(name + " must be " + upperBound + " or lower, '" + number + "' is not.");
  }
}

/**
 * Validates the label names
 * @param  array labelNames
 * @return void
 * @throws error if no label in the account has one of the given label names
 */
function validateLabelNames(labelNames)
{
  var labels = AdWordsApp.labels()
    .withCondition("Name IN ['" + labelNames.join("','") + "']")
    .get();
  var existingLabelNames = [];
  while (labels.hasNext()) {
    var label = labels.next();
    existingLabelNames.push(label.getName());
  }
  labelNames.forEach(function(labelName) {
    if (existingLabelNames.indexOf(labelName) > -1) {
      countLabelledEntities[labelName] = 0;
    } else {
      throw new Error("Could not find the label '" + labelName + "'. Please check it is spelt and capitalised correctly.")
    }
  });
}
