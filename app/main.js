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
  , store = require("./modules/cn-store-js");


// Start kue web server on port 3000
// @TODO secure this in production
var kue = require('kue');
kue.app.listen(3000);

/**
 * Entry point for sucka application.
 * @constructor
 */
var App = function() {};


App.prototype.start = function() {
  var that = this;

  this.transformQueue = new RedisQueue(redis.createClient());
  this.suckaQueue = kue.createQueue();

  this.processErrorHandling();

  // Setup the shared message bus used by all sucka instances
  this.setupBus();

  this.db = this.setupDB();
  this.db.once('open', function() {
    store.Source.findActive().then(function(sources) {
      that.initiateSucking(sources);
    });
  });

  // Check for delayed jobs that need to be promoted. This runs every 5 seconds
  this.suckaQueue.promote();

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
        logger.error(e.message);
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

  this.bus.on("data", 
    /**
     * Index the transformed data, let queue know the task is complete and 
     * invoke whatever post-processing we need to do. 
     * 
     * @param {Array} data - List of transformed items
     * @param {Object} source - Source model instance
     * @param {function} done - callback for queue when task is complete
     */
    function(data, source, done) { 
      logger.info("sucka.App.setupBus storing data " + JSON.stringify(data));

      store.Item.saveList(data)
      .then(
        function(items) {
          that.postSuck(source, items);
          // No matter what et queue know that task has been completed
          done();
        },
        function(err) {
          /**
           * If any of the models were not saved properly, then we have a 
           * problem with this source that needs to be addressed. Pass as
           * much information as possible to the error handler so we can
           * take the source offline, and work with a snapshot of the data
           * that caused the problem. 
           */
           that.handleBrokenSource(source, data, err);

          // No matter what et queue know that task has been completed
          done();
        }
      );
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
  if(source.frequency === "once" && source.hasRun) return null;
  var Sucka = suckas[source.sourceType];
  if(typeof Sucka === "undefined") return null;

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
  source.status = 'failing';
  source.failData = data;
  source.save();

  logger.error("sucka.App.handleBrokenSource " + error);
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
      this.suckaQueue.process(source.id, function(task, done) {
        that.suckIt(task.data.source, done);
      });
    }

    // Some sources will be sucked only once, once per processes, or need 
    // to be sucked for the first time, even if they'll repeat. Find 'em and
    // suck 'em.
    that.shouldSuck(source).then(function(shouldSuck) {
      if(shouldSuck) that.suckIt(source)
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
App.prototype.shouldSuck = function(source) {
  var that = this;

  return new Promise(function (resolve, reject) {
    if(source.frequency === "always") resolve(true)
    else if(source.frequency === "once" && source.hasRun === false) resolve(true)
    else if(source.frequency === "repeats") {
      // If we don't have any active or delayed (scheduled) tasks, suck it
      kue.Job.rangeByType(source.id,'active,delayed', 0, 10, '', function (err, jobs) {
          if (err) return that.bus.emit("error", err, source)
          if (!jobs.length) resolve(true);
      });
    }
    else {
      resolve(false)
    }
  });
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

  if(Sucka) (new Sucka()).initialize(source, that.bus, done).suck()
};


/** 
 * Cleanup for the `source` document after a suck is complete. Mark now as the
 * `lastRun` time for the document and schedule the next suck in the queue 
 * if this is a repeating source. 
 *
 * @param {Object} source - Source model instance
 */
App.prototype.postSuck = function(source, docs) {
  var that = this;
  logger.info("sucka.App.postSuck for source " + JSON.stringify(source));

  source.lastRun = Date.now();
  source.hasRun = true;
  source.save();
  
  // Each of the documents is passed to the transformation pipeline
  _.each(docs, function(doc) {
      logger.info("sucka.App.postSuck transformQueue publish " + JSON.stringify({id:doc.id}));
      that.transformQueue.push("transform", JSON.stringify({id:doc.id}));
  });

  if(source.frequency === "repeats") {
    var repeatDelay = source.repeatMilliseconds();
    this.suckaQueue.create(source.id, {source:source}).delay(repeatDelay).save();
  }
  
};

if(require.main === module) (new App()).start()

module.exports = App;
