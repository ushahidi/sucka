var config = require('config')
  , logger = require('winston')
  , _ = require("underscore")
  , mongoose = require('mongoose')
  , suckas = require('require-all')(__dirname + '/modules/suckas')
  , redis = require('redis')
  , elasticsearch = require('elasticsearch')
  , RedisQueue = require("simple-redis-queue")
  , EventEmitter = require('events').EventEmitter
  , store = require("./modules/cn-store-js")
  , util = require('util');


var argv = require('minimist')(process.argv.slice(2));
var searchClient = new elasticsearch.Client(config.searchStoreConnect);


var getSuckaForSource = function(source) {
  var Sucka = suckas[source.sourceType];
  if(typeof Sucka === "undefined") {
    logger.warn("sucka.App.getSuckaForSource no sucka for " + source.sourceType);
    return null;
  }

  logger.info("sucka.App.getSuckaForSource found sucka for " + source.sourceType);
  return Sucka;
};


var makeRedisClient = function() {
  var redisClient = redis.createClient(config.queue.port, config.queue.host);
  redisClient.auth(config.queue.password);
  return redisClient;
};


var postSuck = function(source, lastRetrieved) {
  var sourceID = source.id;
  logger.info("sucka.App.postSuck for source " + sourceID);

  store.Source.findById(sourceID, function(err, source) {
    source.lastRun = Date.now();
    source.hasRun = true;

    if(lastRetrieved) {
      source.lastRetrieved = lastRetrieved;
    }

    source.save(function(err) {
      if(err) return handleBrokenSource(source, null, err);

      logger.info("sucka.App.postSuck source saved " + source.id);
      logger.info(util.inspect(process.memoryUsage()));

      if(argv.hasOwnProperty('source') && db) {
        db.close();
        process.exit();
      };

    });
  });
};


var saveItem = function(data, source) { 
  searchClient.search({
    index: 'item',
    type: 'item-type',
    body: {
      query: {
        filtered: {
          filter: {
            and: [
              {
                term: {
                  remoteID: data.remoteID
                }
              },
              {
                term: {
                  source: data.source
                }
              }
            ]
          }
        }
      }
    }
  }).then(function (resp) {
      indexData = {
        index: 'item',
        type: 'item-type',
        body: data
      };

      if(resp.hits.total > 0) {
        indexData.id = resp.hits.hits[0]._id;
      }

      searchClient.index(indexData, function (error, response) {
        if(error) {
          logger.error(error);
          handleBrokenSource(source, data, error);
        }
        else {
          redisQueueClient.push("transform", JSON.stringify({id:response._id}));
        }
      });
  }, function (err) {
      logger.error(err);
      handleBrokenSource(source, data, err);
  });
};


var handleBrokenSource = function(source, data, error) {
  if(_(source).isUndefined()) {
    return logger.error('sucka.App.handleBrokenSource error for unknown source');
  }

  logger.error("sucka.App.handleBrokenSource SOURCE ERROR " + source.id + " with type " + source.sourceType + " | " + error);

  if(_(source.id).isUndefined()) return false;

  store.Source.findById(source.id, function(err, source) {
    source.status = 'failing';
    source.failData = data;
    source.save();
  });
};


var doSuck = function(source) {
  logger.info("sucking for source "+source.id);

  var sucka = getSuckaForSource(source);

  if(sucka) {
    var bus = new EventEmitter();

    bus.on("sucked", postSuck);
    bus.on("data", saveItem);
    bus.on("error", handleBrokenSource);

    sucka.suck(source, bus);
  }
  else {
    logger.warn('No sucka found for '+source.sourceType+'|'+source.id);
  }
};


/**
 * Each `sucka` should come with a `definition` property that tells the system 
 * how this `source` behaves (how often it should be retrieved, any filters 
 * required when querying the source, etc). Because these will be added to the 
 * codebase in between process restarts, we need to check at startup for any 
 * new sources that haven't yet been added to the database (and add them).
 */
var setupSources = function() {
  logger.info("setting up sources");

  _(_(suckas).keys()).each(function(key) {
    var sucka = suckas[key];
    if(!_(sucka.definition).isEmpty() && !_(sucka.definition.internalID).isEmpty()) {
      store.Source.upsert(sucka.definition, ["internalID"]);
    }
  });
};


var runApp = function() {
  // pickup any new sources
  setupSources();

  var getAndGo = function(sourceID) {
    logger.info("looking for source "+sourceID);
    store.Source.findById(sourceID, function(err, source) {
      if(err || !source) {
        return logger.error('No source found for '+sourceID);
      }
      doSuck(source);
    });
  };

  if(argv.hasOwnProperty('source')) {
    getAndGo(argv.source);
  }
  else {
    logger.info("Listening for messages from the suckjs queue");

    redisQueueClient.on("message", function (queueName, payload) {
      logger.info("Got message for queue: "+queueName);

      var parsedPayload = JSON.parse(JSON.parse(payload));
      logger.info("Processing task...");
      logger.info(parsedPayload);
      if(queueName !== "suckjs") return;
      
      try {
        getAndGo(parsedPayload.id);
      }
      catch(err) {
        logger.error(err);
      }
    
    });

    redisQueueClient.on("error", function (error) { logger.error(error); });
    redisQueueClient.monitor("suckjs");
  }
};


if(require.main === module) {
  var redisQueueClient = new RedisQueue(makeRedisClient());
  mongoose.connect(config.dbURI); 
  var db = mongoose.connection;
  
  db.on('error', function(err) { 
    if(err) logger.error('sucka.App.setupDB mongo connect error ' + err);
  });

  db.once('open', runApp);  
}

// Export functions we'd like to test
module.exports = { 
  doSuck: doSuck,
  postSuck: postSuck,
  handleBrokenSource: handleBrokenSource,
  getSuckaForSource: getSuckaForSource,
  setupSources: setupSources
};
