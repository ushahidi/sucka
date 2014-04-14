var config = require('config')
  , logger = require('winston')
  , kue = require('kue')
  , _ = require("underscore")
  , moment = require('moment')
  , redis = require('redis')
  , RedisQueue = require("simple-redis-queue")
  , mongoose = require('mongoose')
  , suckas = require('require-all')(__dirname + '/modules/suckas')
  , Promise = require('promise')
  , EventEmitter = require('events').EventEmitter
  , store = require("./modules/cn-store-js")
  , async = require('async');


/*
require('nodetime').profile({
  accountKey: 'e5947aaedfd2a96793e51556972b46758c92bdd1', 
  appName: 'Sucka'
});
*/

var util = require('util');


// Start kue web server on port 3000
// @TODO secure this in production
var kue = require('kue');
kue.app.listen(3000);

//return;

/**
 * Entry point for sucka application.
 * @constructor
 */
var App = function() {};


App.prototype.start = function() {
  logger.info("sucka starting");
  var that = this;

  var makeRedisClient = function() {
    var redisClient = redis.createClient(config.queue.port, config.queue.host);
    redisClient.auth(config.queue.password);
    return redisClient;
  }

  kue.redis.createClient = makeRedisClient;

  this.suckaQueue = kue.createQueue({
    redis: {
      port: config.queue.port,
      host: config.queue.host,
      auth: config.queue.password
    }
  });

  this.transformQueue = new RedisQueue(makeRedisClient());

  //this.processErrorHandling();

  // Setup the shared message bus used by all sucka instances
  this.setupBus();

  this.db = this.setupDB();
  
  /**
   * Once the database is ready we'll setup sources according to their `definition`
   * property, which is maintained in the `source` document's corresponding `sucka`
   * module. Any unrecognized sources are added.
   */
  this.db.once('open', function() {
    logger.info("sucka db ready");
    
    that.setupSources(function(err) {
      if(err) return logger.error("Problem setting up sources");
      
      store.Source.findActive(function(err, sources) {
        if(err) return logger.error("Error getting active sources");

        if(_(sources).isEmpty()) {
          logger.warn("no sources found");
          return false;
        }

        logger.info("sucka initiating sucking for " + _(sources).pluck("id").toString());
        that.initiateSucking(sources);
      });
    });
    
  });

  // Check for delayed jobs that need to be promoted. This runs every 5 seconds
  this.suckaQueue.promote();

};

/**
 * Each `sucka` should come with a `definition` property that tells the system 
 * how this `source` behaves (how often it should be retrieved, any filters 
 * required when querying the source, etc). Because these will be added to the 
 * codebase in between process restarts, we need to check at startup for any 
 * new sources that haven't yet been added to the database (and add them).
 */
App.prototype.setupSources = function(callback) {
  logger.info("App.setupSources called");

  var suckaSources = [];

  var upsertFunc = function(definition) {
    return function(cb) { store.Source.upsert(definition, ["internalID"], cb) };
  };

  _(_(suckas).keys()).each(function(key) {
    var Sucka = suckas[key];
    if(!_(Sucka.definition).isEmpty() && !_(Sucka.definition.internalID).isEmpty()) {
      suckaSources.push(upsertFunc(Sucka.definition));
    }
  });

  //return store.Source.saveList(suckaSources, ["internalID"]);
  async.parallel(suckaSources, callback);
};

App.prototype.getActiveSources = function() {
  return store.Source.findActive();
};

/**
 * While this may, at first, appear to be totes cray&#8482;, if the process crashes we 
 * may need to disable the source that is causing the problem. Otherwise 
 * repeating sources will break every time they suck. Which sucks. 
 */
App.prototype.processErrorHandling = function() {
  var that = this;

  //so the program will not close instantly
  process.stdin.resume();
  
  process.on('uncaughtException', 
    /**
    * See if we can identify the sucka that's causing the problem and pass 
    * to our error handler. Ideally we'd also have the data that caused 
    * the problem, so developers are encouraged to write very defensive 
    * code in their `suck` and `transform` methods.
    */
    function(e) {
      var matches = e.stack.match(/modules\/suckas\/([\w-]+)\.js/);
      if(matches) {
        logger.error("sucka.App.processErrorHandling broken sucka! " + matches[1]);
        that.bus.emit("error", {sourceType: matches[1]}, null, e.message);
      }
      else {
        logger.error(e);
      }
      process.exit();
    }
  );
};


/**
 * Establish a connection with the database. Return the mongoose.connection
 * promise object.
 */
App.prototype.setupDB = function() {
  mongoose.connect(config.dbURI); 
  var db = mongoose.connection;
  
  db.on('error', function(err) { 
    if(err) logger.error('sucka.App.setupDB mongo connect error ' + err);
  });

  return db;
};

/** 
 * Messaging between components is handled with a global, in-memory bus. 
 * This lets suckas ping the app when they have new transformed data to be 
 * processed. 
 */
App.prototype.setupBus = function() {
  var that = this;
  this.bus = new EventEmitter();

  // two separate events
  // on data, save and send to processing pipeline
  // on sucked, do postSuck - the sucked should include last-sucked item

  /**
   * Let queue know the task is complete and invoke whatever post-processing 
   * we need to do.  
   * 
   * @param {function} done - callback for queue when task is complete
   */
  this.bus.on("sucked", function(source, lastRetrieved, done) {
    // No matter what let queue know that task has been completed
    done();

    that.postSuck(source.id, lastRetrieved);
  });

  this.bus.on("data", 
    /**
     * Index the transformed data
     * 
     * @param {Array} data - Transformed item
     * @param {Object} source - Source model instance
     */
    function(data, source) { 
      //console.log(util.inspect(process.memoryUsage()));

      store.Item.upsert(data, ["remoteID", "source"], function(err, item) {
        if(!err) {
          that.transformQueue.push("transform", JSON.stringify({id:item.id}));
          item = null;
        }
        else {
          that.handleBrokenSource(source, data, err);
        }

        data = null;
      });
    }
  );

  this.bus.on("error", function(source, data, error) {
    that.handleBrokenSource(source, data, error);
  });
};


/** 
 * `suckas` is a dictionary that uses file names as keys. So a file called 
 * `twitter.js` will be accessible at `suckas.twitter`.
 *
 * @param {Object} source - Source model instance 
 */
App.prototype.getSuckaForSource = function(source) {
  if(source.frequency === "once" && source.hasRun) {
    logger.info("sucka.App.getSuckaForSource skipping " + source.sourceType);
    return null;
  }
  var Sucka = suckas[source.sourceType];
  if(typeof Sucka === "undefined") {
    logger.warn("sucka.App.getSuckaForSource no sucka for " + source.sourceType);
    return null;
  }

  logger.info("sucka.App.getSuckaForSource found sucka for " + source.sourceType);
  return Sucka;
};


/** 
 * Often ingested data isn't formed quite how your sucka assumes it should be, 
 * causing pain, chaos and confusion. This is compounded for suckas that 
 * repeately poll for data, because they throw runtime exceptions can kill 
 * your process.  
 *
 * @param {Object} source - Source model instance 
 * @param {Object} data - Source model instance 
 * @param {Object} error
 */
App.prototype.handleBrokenSource = function(source, data, error) {
  logger.error("sucka.App.handleBrokenSource SOURCE ERROR " + source.id + " with type " + source.sourceType + " | " + error);

  if(_(source.id).isUndefined()) return false;

  store.Source.findById(source.id, function(err, source) {
    source.status = 'failing';
    source.failData = data;
    source.save();
  });
};


/** 
 * Assign listener for repeating sources that calls `this.suckIt` when a task
 * is ready to be processed, and immediately invoke `this.suckIt` for 
 * anything that should run when when the process starts. 
 *
 * @param {Array} sources - List of source model instances
 */
App.prototype.initiateSucking = function(sources) {
  var that = this;
  _.each(sources, function(source) {

    if(source.frequency === "repeats") {
      // Perform a suck whenever this source has an active task in the queue. 
      // We use the source.id (string) as the task `type`/event name. 
      that.suckaQueue.process(source.id, function(task, done) {
        store.Source.findById(source.id, function(err, source) {
          if(err) {
            return logger.error("sucak.App.initiateSucking failed to find " + source.id);
          }

          if(source.status === "failing") {
            return logger.warn("sucak.App.initiateSucking not running source " + source.id + " because it is failing");
          }

          logger.info("sucka.App processing task " + task);
          that.suckIt(task.data.source, done);
        });
      });
    }

    // Some sources will be sucked only once, once per processes, or need 
    // to be sucked for the first time, even if they'll repeat. Find 'em and
    // suck 'em.
    that.shouldSuck(source, function(shouldSuck) {
      if(shouldSuck) {
        logger.info("sucka.App.initiateSucking should suck " + source.id);
        that.suckIt(source);
      }
    });
  });
};


/** 
 * Sources that should run "always" (aka streaming sources like Twitter), 
 * sources that should be run once and haven't been run yet, and repeating 
 * sources that don't have any active or delayed tasks in the queue should 
 * all be sucked when the app starts.
 *
 * If there are active or delayed tasks in the queue for this source, we'll 
 * assume that they'll be sucked in due time.  
 *
 * @param {Object} source - Source model instance
 */
App.prototype.shouldSuck = function(source, callback) {
  var that = this;

  if(source.frequency === "always") callback(true)
  else if(source.frequency === "once" && source.hasRun === false) callback(true)
  else if(source.frequency === "repeats") {
    // If we don't have any scheduled tasks, suck it
    kue.Job.rangeByType(source.id,'delayed', 0, 10, '', function (err, jobs) {
        if (err) return that.bus.emit("error", err, source)
        if (jobs.length) {
          callback(false);
        }
        else {
          callback(true);
        }
    });
  }
  else {
    callback(false)
  }
};


/** 
 * Instantiate and initialize a new instance of whatever Sucka subclass we 
 * should be using for this `source.sourceType` and `suck` it.
 *
 * @param {Object} source - Source model instance
 * @param {function} done - callback for queue when task is complete
 */
App.prototype.suckIt = function(source, done) {
  var that = this;
  var Sucka = that.getSuckaForSource(source);
  done = done || function() {};

  if(Sucka) {
    var sucka = new Sucka();
    sucka.initialize(source, that.bus, done).suck()
  }
};


/** 
 * Cleanup for the `source` document after a suck is complete. Mark now as the
 * `lastRun` time for the document and schedule the next suck in the queue 
 * if this is a repeating source. 
 *
 * @param {Object} source - Source model instance
 */
App.prototype.postSuck = function(sourceID, lastRetrieved) {
  var that = this;
  logger.info("sucka.App.postSuck for source " + sourceID);

  store.Source.findById(sourceID, function(err, source) {
    source.lastRun = Date.now();
    source.hasRun = true;

    // Some services allow us to query "since" a specific ID.  
    if(lastRetrieved) {
      source.lastRetrieved = lastRetrieved;
    }

    // Once the source's properties have been updated, save the changes to the 
    // database and schedule a task so this source is sucked again according to 
    // its repeat schedule. 
    source.save(function(err) {
      if(err) return that.handleBrokenSource(source, null, err);

      logger.info("sucka.App.postSuck source saved " + source.id);
      
      if(source.frequency === "repeats") {
        var repeatDelay = source.repeatMilliseconds();
        that.suckaQueue.create(source.id, {source:source})
          .delay(repeatDelay)
          .save(function(err, state) {
            if(err) return that.handleBrokenSource(source, null, err);
            logger.info("============= sucka.App.postSuck task created " + source.id + " ====================== ");
            console.log(util.inspect(process.memoryUsage()));
          });
      }
    });
  });
};

if(require.main === module) (new App()).start()

module.exports = App;
