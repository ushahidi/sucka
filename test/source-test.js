var chai = require('chai');
chai.should();
var expect = chai.expect
  , assert = chai.assert
  , config = require('config')
  , mongoose = require('mongoose')
  , store = require('../app/modules/cn-store-js')
  , Source = store.Source
  , clearDB  = require('mocha-mongoose')(config.dbURI)
  , moment = require('moment')
  , async = require('async');

describe('Source', function(){
  beforeEach(function(done) {
    if (mongoose.connection.db) return done();

    mongoose.connect(config.dbURI, done);
  });

  it('should create and save a Source model', function(done){
    var sourceData = {
      sourceType: "twitter",
      frequency: "always",
      startDate: Date.now(),
      endDate: Date.now()
    };

    var sourceModel = new Source(sourceData);
    sourceModel.save(function(err, source) {
      assert.isNull(err);
      assert(source.sourceType === "twitter");
      assert.isDefined(source.id);
      assert.isDefined(source.createdAt);
      assert.isDefined(source.updatedAt);
      done();
    });
  });

  it('should convert repeat interval to milliseconds', function(done){
    var sourceData = {
      sourceType: "twitter",
      frequency: "repeats",
      repeatsEvery: "minute",
      startDate: Date.now(),
      endDate: Date.now()
    };

    var sourceModel = new Source(sourceData);
    sourceModel.save(function(err, source) {
      assert.isNull(err);
      assert(source.repeatMilliseconds() === 60000);
      done();
    });
  });

  it('should throw an error for a bad status', function(done){
    var sourceData = {
      sourceType: "twitter",
      frequency: "always",
      startDate: Date.now(),
      endDate: Date.now(),
      status: "totally-screwed"
    };

    var sourceModel = new Source(sourceData);
    sourceModel.save(function(err, source) {
      assert.isNotNull(err);
      done();
    });
  });

  it('should throw an error for a bad frequency', function(done){
    var sourceData = {
      sourceType: "twitter",
      frequency: "a-lot",
      startDate: Date.now(),
      endDate: Date.now()
    };

    var sourceModel = new Source(sourceData);
    sourceModel.save(function(err, source) {
      assert.isNotNull(err);
      done();
    });
  });

  it('should throw an error for a bad repeat designation', function(done){
    var sourceData = {
      sourceType: "twitter",
      repeatsEvery: "millisecond",
      startDate: Date.now(),
      endDate: Date.now()
    };

    var sourceModel = new Source(sourceData);
    sourceModel.save(function(err, source) {
      assert.isNotNull(err);
      done();
    });
  });

  it('should find active sources', function(done){
    var currentSourceData = {
      sourceType: "awesome",
      frequency: "always",
      startDate: moment().subtract('d', 1),
      endDate: moment().add('d', 1)
    };

    var expiredSourceData = {
      sourceType: "twitter",
      frequency: "always",
      startDate: moment().subtract('d', 2),
      endDate: moment().subtract('m', 1)
    };

    var inactiveSourceData = {
      sourceType: "twitter",
      frequency: "always",
      startDate: moment().subtract('d', 1),
      endDate: moment().add('d', 1),
      status: 'inactive'
    };

    async.parallel([
      function(callback){ 
        var sourceModel = new Source(currentSourceData);
        sourceModel.save(callback);
      },
      function(callback){ 
        var sourceModel = new Source(expiredSourceData);
        sourceModel.save(callback);
      },
      function(callback) {
        var sourceModel = new Source(expiredSourceData);
        sourceModel.save(callback);
      }
    ], function() {
      Source.findActive(function(err, sources) {
        assert(sources.length === 1);
        assert(sources[0].sourceType === "awesome");
        done();
      });
    });

  });

})