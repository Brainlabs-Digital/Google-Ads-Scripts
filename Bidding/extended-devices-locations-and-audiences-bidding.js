/**
*
* Extended Devices, Locations and Audiences Bidding
*
* Automatically apply modifiers to your devices, locations, in-market and remarketing audiences based on performance.
* It analyses search and display campaigns only.
*
* Version: 1.0
* Google Ads Script maintained on brainlabsdigital.com
*
**/

// Use this if you want to exclude some campaigns. Case insensitive.
// For example ["Brand"] would ignore any campaigns with "brand" in the name,
// while ["Brand","Competitor"] would ignore any campaigns with "brand" or
// "competitor" in the name.
// Leave as [] to not exclude any campaigns.
var CAMPAIGN_NAME_DOES_NOT_CONTAIN = [];

// Use this if you only want to look at some campaigns.  Case insensitive.
// For example ["Brand"] would only look at campaigns with "brand" in the name,
// while ["Brand","Generic"] would only look at campaigns with "brand" or "generic"
// in the name.
// Leave as [] to include all campaigns.
var CAMPAIGN_NAME_CONTAINS = [];

// Set true or false for the following targeting options in order to enable them
var DO_DEVICES = true; // campaign level
var DO_LOCATIONS = true; // campaign level
var DO_IN_MARKET_AUDIENCES = true; // campaign or ad group level
var DO_OTHER_AUDIENCES = true; // campaign or ad group level

// Use this to determine the relevant date range for your data.
// See here for the possible options:
// https://developers.google.com/google-ads/scripts/docs/reference/adwordsapp/adwordsapp_campaignselector#forDateRange_1
var DATE_RANGE = "LAST_30_DAYS";

// Use this to determine the minimum number of impressions, conversions and cost
// a campaign or an ad group should have before being considered.
var MINIMUM_IMPRESSIONS = 0;
var MINIMUM_CONVERSIONS = 0;
var MINIMUM_COST = 0;

// Use this to define the lower and upper bounds that bid modifiers must fall within
var MIN_BID_MODIFIER = -0.4; // -40%
var MAX_BID_MODIFIER = 0.4; // +40%

// Use this to configure bid modifiers' weights with respect to the number
// of specific device, location or audience conversions.
// E.g. if there are 15 conversions through a tablet device over the defined time period DATE_RANGE
// the bid modifier weighted down by multiplying it by 0.8
var CAMPAIGN_BID_MODIFIER_WEIGHTS = [
  {"lower": 0, "upper": 10, "weight": 0.6},
  {"lower": 10, "upper": 20, "weight": 0.8},
  {"lower": 20, "upper": 100000, "weight": 1}
]

var ADGROUP_BID_MODIFIER_WEIGHTS = [
  {"lower": 0, "upper": 10, "weight": 0.6},
  {"lower": 10, "upper": 20, "weight": 0.8},
  {"lower": 20, "upper": 100000, "weight": 1}
]

var AUDIENCE_MAPPING_CSV_DOWNLOAD_URL = "https://developers.google.com/adwords/api/docs/appendix/in-market_categories.csv";

function main() {
  Logger.log("Validating settings...");
  validateInputs();
  Logger.log("Success");

  Logger.log("Getting in-market audience mapping");
  var audienceMapping =
    getInMarketAudienceMapping(AUDIENCE_MAPPING_CSV_DOWNLOAD_URL);

  Logger.log("Getting campaign performance");
  var campaignPerformance = getCampaignPerformance();

  Logger.log("Getting ad group performance");
  var adGroupPerformance = getAdGroupPerformance();

  Logger.log("Starting making operations and applying bids");
  makeOperationsAndApplyBids(
    audienceMapping,
    campaignPerformance,
    adGroupPerformance
  );
}

function validateInputs() {
  if ((typeof(DO_DEVICES) != "boolean") ||
      (typeof(DO_LOCATIONS) != "boolean") ||
      (typeof(DO_IN_MARKET_AUDIENCES) != "boolean") ||
      (typeof(DO_OTHER_AUDIENCES) != "boolean")) {
    throw("DO_DEVICES, DO_LOCATION, DO_IN_MARKET_AUDIENCES and DO_OTHER_AUDIENCES " +
      "variables must be set to either true or false.");
  }

  if ((typeof(MINIMUM_IMPRESSIONS) != "number") ||
      (typeof(MINIMUM_CONVERSIONS) != "number") ||
      (typeof(MINIMUM_COST) != "number")) {
    throw("MINIMUM_IMPRESSIONS, MINIMUM_CONVERSIONS, MINIMUM_COST must be a number, e.g. 0, 1, 15");
  }

  if ((typeof(MIN_BID_MODIFIER) != "number") ||
      (MIN_BID_MODIFIER < -0.9) ||
      (MIN_BID_MODIFIER > 0)) {
    throw("MIN_BID_MODIFIER must be a number between -0.9 and 0, e.g. -0.85, -0.6, -0.3");
  }

  if ((typeof(MAX_BID_MODIFIER) != "number") ||
      (MAX_BID_MODIFIER < 0) ||
      (MAX_BID_MODIFIER > 9)) {
    throw("MAX_BID_MODIFIER must be a number between 0 and 9.0, e.g. 0.6, 1.4, 2.7");
  }

  var weights = [CAMPAIGN_BID_MODIFIER_WEIGHTS, ADGROUP_BID_MODIFIER_WEIGHTS];
  weights.forEach(function(entityWeights) {
    entityWeights.forEach(function(row) {
      var keys = ["lower", "upper", "weight"];
      if (Object.keys(row).toString() !== keys.toString()) {
        throw("CAMPAIGN_BID_MODIFIER_WEIGHTS and AD_GROUP_BID_MODIFIER_WEIGHTS " +
          "rows must be in the following format: " +
          "{\"lower\": number, \"upper\": number, \"weight\": number}");
      }

      keys.forEach(function(key) {
        if (typeof(row[key]) !== "number") {
          throw("\"" + key + "\" value in bid modifiers weights must be a number, e.g. 1, 5, 15");
        }
      });
    });
  });
}

function getInMarketAudienceMapping(downloadCsvUrl) {
  var csv = Utilities.parseCsv(
    UrlFetchApp.fetch(downloadCsvUrl).getContentText()
  );

  var headers = csv[0];
  var indexOfId = headers.indexOf("Criterion ID");
  var indexOfName = headers.indexOf("Category");

  if ((indexOfId === -1) || (indexOfName === -1)) {
    throw new Error("The audience CSV does not have the expected headers");
  }

  var mapping = {};
  for (var i = 1; i < csv.length; i++) {
    var row = csv[i];
    mapping[row[indexOfId]] = row[indexOfName];
  }

  return mapping;
}

function getCampaignPerformance() {
  return getEntityPerformance("CampaignId", "CAMPAIGN_PERFORMANCE_REPORT");
}

function getAdGroupPerformance() {
  return getEntityPerformance("AdGroupId", "ADGROUP_PERFORMANCE_REPORT");
}

function getEntityPerformance(entityIdFieldName, reportName) {
  var performance = {};
  var query = "SELECT " + entityIdFieldName + ", CostPerAllConversion " +
      "FROM " + reportName + " " +
      "WHERE Impressions > " + String(MINIMUM_IMPRESSIONS) + " " +
      "AND Conversions > " + String(MINIMUM_CONVERSIONS) + " " +
      "AND Cost > " + String(MINIMUM_COST) + " "

  CAMPAIGN_NAME_DOES_NOT_CONTAIN.forEach(function(part) {
      query += "AND CampaignName DOES_NOT_CONTAIN_IGNORE_CASE '"
      + part.replace(/"/g,'\\\"') + "' "
  });
  CAMPAIGN_NAME_CONTAINS.forEach(function(part) {
      query += "AND CampaignName CONTAINS_IGNORE_CASE '"
      + part.replace(/"/g,'\\\"') + "' "
  });

  query += "DURING " + DATE_RANGE;

  var rows = AdsApp.report(query).rows();

  while (rows.hasNext()) {
    var row = rows.next();
    performance[row[entityIdFieldName]] = row.CostPerAllConversion;
  }
  return performance;
}

function makeOperationsAndApplyBids(
  audienceMapping,
  campaignPerformance,
  adGroupPerformance
) {
  var devicesAndLocationsOperations = [];
  var audiencesOperations = [];

  var campaignIds = Object.keys(campaignPerformance);
  var campaigns = getEntities(AdsApp.campaigns(), campaignIds);

  while (campaigns.hasNext()) {
    var campaign = campaigns.next();
    Logger.log("");
    Logger.log("Processing campaign " + campaign.getName())

    if (DO_DEVICES) {
      Logger.log("Making devices operations");
      var devicesOperations = makeCampaignDevicesOperations(
        campaign,
        campaignPerformance[campaign.getId()]
      )
      devicesAndLocationsOperations = devicesAndLocationsOperations.concat(devicesOperations);
    }

    if (DO_LOCATIONS) {
      Logger.log("Making locations operations");
      var locationsOperations = makeCampaignLocationsOperations(
        campaign,
        campaignPerformance[campaign.getId()]
      )
      devicesAndLocationsOperations = devicesAndLocationsOperations.concat(locationsOperations);
    }

    if (DO_IN_MARKET_AUDIENCES || DO_OTHER_AUDIENCES) {
      var campaignAudiencesOperations = makeAllAudiencesOperations(
        campaign,
        campaignPerformance[campaign.getId()],
        adGroupPerformance,
        audienceMapping
      )
      audiencesOperations = audiencesOperations.concat(campaignAudiencesOperations);
    }
  }
  Logger.log(" ");
  Logger.log("Total of " + devicesAndLocationsOperations.length + " devices and locations operations");
  Logger.log("Total of " + audiencesOperations.length + " audiences operations");

  Logger.log("Applying bids");
  applyDevicesAndLocationsBids(devicesAndLocationsOperations);
  applyAudiencesBids(audiencesOperations);

  Logger.log("Finished");
}

function getEntities(entitySelector, ids) {
  var entities = entitySelector.withIds(ids).get();
  return entities;
}

function makeCampaignDevicesOperations(campaign, campaignCpa) {
  var operations = [];

  var devices = campaign
    .targeting()
    .platforms()
    .forDateRange(DATE_RANGE)
    .get()

  while (devices.hasNext()) {
    var device = devices.next();
    var operation = makeOperation(campaign, campaignCpa, device);
    if (operation) {
      operations.push(operation);
    }
  }
  return operations;
}

function makeCampaignLocationsOperations(campaign, campaignCpa) {
  var operations = [];

  var locations = campaign
    .targeting()
    .targetedLocations()
    .forDateRange()
    .get()

  while (locations.hasNext()) {
    var location = locations.next();
    var operation = makeOperation(campaign, campaignCpa, location);
    if (operation) {
      operations.push(operation);
    }
  }
  return operations;
}

function makeAllAudiencesOperations(campaign, campaignCpa, adGroupPerformance, audienceMapping) {
  var operations = [];

  // Can't have both ad-group-level and campaign-level
  // audiences on any given campaign.
  if (campaignHasAnyCampaignLevelAudiences(campaign)) {
    Logger.log("Campaign level audiences");

    var audiences = getAudiencesFromEntity(campaign, audienceMapping);

    var operationsFromCampaign = makeEntityAudiencesOperations(
      campaign,
      campaignCpa,
      audiences
    )
    operations = operations.concat(operationsFromCampaign);
  } else {
    Logger.log("Ad group level audiences");
    var adGroupIds = Object.keys(adGroupPerformance);
    var adGroups = getEntities(campaign.adGroups(), adGroupIds)

    while (adGroups.hasNext()) {
      var adGroup = adGroups.next();
      Logger.log("Processing ad group " + adGroup.getName());
      var audiences = getAudiencesFromEntity(adGroup, audienceMapping);
      var operationsFromAdGroup = makeEntityAudiencesOperations(
        adGroup,
        adGroupPerformance[adGroup.getId()],
        audiences
      );
      operations = operations.concat(operationsFromAdGroup);
    }
  }
  return operations;
}

function campaignHasAnyCampaignLevelAudiences(campaign) {
  var totalNumEntities = campaign
  .targeting()
  .audiences()
  .get()
  .totalNumEntities();

  return totalNumEntities > 0;
}

function getAudiencesFromEntity(entity, audienceMapping) {
  var inMarketIds = Object.keys(audienceMapping);

  var allAudiences = entity
    .targeting()
    .audiences()
    .forDateRange()
    .get()

  var inMarketAudiences = [];
  var otherAudiences = [];

  while (allAudiences.hasNext()) {
    var audience = allAudiences.next();

    if (isAudienceInMarketAudience(audience, inMarketIds)) {
      inMarketAudiences.push(audience);
    } else {
      otherAudiences.push(audience);
    }
  }
  audiences = {};
  audiences.inMarket = inMarketAudiences;
  audiences.other = otherAudiences;
  return audiences;
}

function isAudienceInMarketAudience(audience, inMarketIds) {
  return inMarketIds.indexOf(audience.getAudienceId()) > -1;
}

function makeEntityAudiencesOperations(entity, entityCpa, audiences) {
  var operations = [];

  if (DO_IN_MARKET_AUDIENCES) {
    Logger.log("Doing in-market audiences operations");
    var inMarketAudiencesOperations = makeAudiencesOperations(
      entity,
      entityCpa,
      audiences.inMarket
    );
    operations = operations.concat(inMarketAudiencesOperations);
  }

  if (DO_OTHER_AUDIENCES) {
    Logger.log("Doing other audiences operations");
    var otherAudiencesOperations = makeAudiencesOperations(
      entity,
      entityCpa,
      audiences.other
    );
    operations = operations.concat(otherAudiencesOperations);
  }
  return operations;
}

function makeAudiencesOperations(entity, entityCpa, audiences) {
  operations = [];

  audiences.forEach(function(audience) {
    var operation = makeOperation(entity, entityCpa, audience);
    if (operation) {
      operations.push(operation);
    }
  });
  return operations;
}

function makeOperation(entity, entityCpa, targetingEntity) {
  var stats = targetingEntity.getStatsFor(DATE_RANGE);
  var targetingConversions = stats.getConversions();
  if (targetingConversions === 0) {
    return;
  }
  var targetingCpa = stats.getCost() / targetingConversions;
  entityCpa = parseFloat(entityCpa);
  var modifier = entityCpa / targetingCpa;

  var bidModifierWeight = getBidModifierWeight(
    targetingConversions,
    entity.getEntityType()
  );
  var weightedModifier = (modifier - 1) * bidModifierWeight + 1;

  var finalModifier = ensureWithinBounds(weightedModifier);

  var operation = {};
  operation.targetingEntity = targetingEntity;
  operation.modifier = finalModifier;

  return operation;
}

function getBidModifierWeight(conversions, entityType) {
  if (entityType === "Campaign") {
    weights = CAMPAIGN_BID_MODIFIER_WEIGHTS;
  }
  if (entityType === "AdGroup") {
    weights = ADGROUP_BID_MODIFIER_WEIGHTS
  }

  var weight = 1;
  for each (var weightRange in weights) {
    if ((conversions >= weightRange["lower"]) &&
      (conversions < weightRange["upper"])) {
      weight = weightRange["weight"];
      break;
    }
  }
  return weight;
}

function ensureWithinBounds(modifier) {
  if (modifier < (1 + MIN_BID_MODIFIER)) {
    return 1 + MIN_BID_MODIFIER;
  }
  else if (modifier > (1 + MAX_BID_MODIFIER)) {
    return 1 + MAX_BID_MODIFIER;
  } else {
    return modifier;
  }
}

function applyDevicesAndLocationsBids(operations) {
  operations.forEach(function(operation) {
    operation.targetingEntity.setBidModifier(operation.modifier);
  });
}

function applyAudiencesBids(operations) {
  operations.forEach(function(operation) {
    operation.targetingEntity.bidding().setBidModifier(operation.modifier);
  });
}
