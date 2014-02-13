/**
 * The father of all Suckas. 
 */
var Sucka = function() {};

/**
 * All suckas need to know the source on whose behalf they're sucking, and 
 * a reference to the process-wide message bus. This bus is used to alert
 * the application when their is newly transformed data to be validated, saved,
 * etc. 
 *
 * Optionally consumers can pass in a done reference, which should be associated
 * with the sucka instance throughout its lifescyle. This method is used with 
 * suckas spawned from queue tasks (usually because they suck, repeatedly, at 
 * a given interval), and is unique to the sucka instance. It's passed back 
 * to the caller in the allFinished method, which should be called when data 
 * transformation is finished.
 *
 * @param {Object} source - A source model instance
 * @param {Object} bus - Reference to the process-wide message bus
 * @param {function} done - called to let queue know task has finished 
 */
Sucka.prototype.initialize = function(source, bus, done) {
  this.source = source;
  this.bus = bus;
  this.done = done;

  return this;
};

/**
 * The `suck` method is responsible for retrieving data. This might be 
 * querying Twitter's streaming API, pulling a static file off a webserver, 
 * scraping a web page, whatever you need to do.
 */
Sucka.prototype.suck = function() {};


/**
 * Takes data from `suck` and should produce an array of items matching the 
 * common CrisisNET schema. 
 */
Sucka.prototype.transform = function(inputData) {
  var outputData = inputData;

  this.allFinished(outputData);
};


/**
 * Called when sucka instance has finished transforming it sucks.
 *
 * @param {Array} transformedData - List of transformed objects to be indexed
 */ 
Sucka.prototype.allFinished = function(transformedData) {
  this.bus.emit("data", transformedData, this.source, this.done);
};


Sucka.prototype.handleError = function(error) {
  this.bus.emit("error", error, this.source, this.done);
};

module.exports = Sucka;