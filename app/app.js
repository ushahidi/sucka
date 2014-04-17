var config = require('config')
  , logger = require('winston')
  , _ = require("underscore")
  , mongoose = require('mongoose')
  , suckas = require('require-all')(__dirname + '/modules/suckas')
  , redis = require('redis')
  , RedisQueue = require("simple-redis-queue")
  , EventEmitter = require('events').EventEmitter
  , store = require("./modules/cn-store-js")
  , util = require('util');


var argv = require('minimist')(process.argv.slice(2));

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
  store.Item.upsert(data, ["remoteID", "source"], function(err, item) {
    if(!err) {
      redisQueueClient.push("transform", JSON.stringify({id:item.id}));
      item = null;
    }
    else {
      handleBrokenSource(source, data, err);
    }
  });
};


var handleBrokenSource = function(source, data, error) {
  logger.error("sucka.App.handleBrokenSource SOURCE ERROR " + source.id + " with type " + source.sourceType + " | " + error);

  if(_(source.id).isUndefined()) return false;

  store.Source.findById(source.id, function(err, source) {
    source.status = 'failing';
    source.failData = data;
    source.save();
  });
};


var doSuck = function(source) {
  var Sucka = getSuckaForSource(source);

  if(Sucka) {
    var sucka = new Sucka();
    var bus = new EventEmitter();

    bus.on("sucked", postSuck);
    bus.on("data", saveItem);
    bus.on("error", handleBrokenSource);

    sucka.initialize(source, bus, function() {}).suck();
  }
  else {
    logger.warn('No sucka found for '+source.sourceType+'|'+source.id);
  }
};


var runApp = function() {
  var getAndGo = function(sourceID) {
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
      if(queueName !== "suckjs") return;
      
      try {
        getAndGo(JSON.parse(payload).id);
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
  getSuckaForSource: getSuckaForSource
};
