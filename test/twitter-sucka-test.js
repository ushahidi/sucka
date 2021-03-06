var chai = require('chai');
chai.should();
var config = require('config')
  , _ = require("underscore")
  , expect = chai.expect
  , assert = chai.assert
  , mongoose = require('mongoose')
  , clearDB  = require('mocha-mongoose')(config.dbURI)
  , store = require('../app/modules/cn-store-js')
  , Twitter = require('../app/modules/suckas/twitter')
  , async = require('async');

describe('twitter sucka', function(){
  beforeEach(function(done) {
    if (mongoose.connection.db) return done();

    mongoose.connect(config.dbURI, done);
  });

  it('should transform data to the correct format', function(done){
    // Don't really read files like this. I'm only doing it here because it's 
    // a unit test, where we can revel in questionable coding practices. 
    var twitterData = require('./data/twitter.json');
    var transformedData = (new Twitter()).transform([twitterData]);
    var twitterModel = new store.Item(transformedData[0]);

    twitterModel.save(function(err, item) {
      assert.isNull(err);
      assert(item.lifespan === "temporary");
      assert(item.content === twitterData.text);
      assert(item.geo.locationIdentifiers.authorTimeZone === "Mexico City");

      done();
    });

  });

  it('should not fail for unknown language iso code', function(done) {
    var data = require('./data/twitter-formatted.json');
    var funcs = [];

    _.each(data, function(item) {
      funcs.push(function(callback) {
        var itemModel = new store.Item(item);
        itemModel.save(function(err, newItem) {
          assert.isNull(err);
          callback();
        });
      });
    });

    async.parallel(funcs, function() {
      done();
    });
  });
})