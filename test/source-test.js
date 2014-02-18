var chai = require('chai');
chai.should();
var expect = chai.expect
  , assert = chai.assert
  , config = require('config')
  , mongoose = require('mongoose')
  , store = require('../app/modules/cn-store')
  , connect = store.connect
  , Source = store.Source
  , clearDB  = require('mocha-mongoose')(config.dbURI);

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

})