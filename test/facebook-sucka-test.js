var chai = require('chai');
chai.should();
var config = require('config')
  , _ = require("underscore")
  , expect = chai.expect
  , assert = chai.assert
  , mongoose = require('mongoose')
  , clearDB  = require('mocha-mongoose')(config.dbURI)
  , store = require('../app/modules/cn-store-js')
  , Facebook = require('../app/modules/suckas/facebook');

describe('facebook sucka', function(){
  beforeEach(function(done) {
    if (mongoose.connection.db) return done();

    mongoose.connect(config.dbURI, done);
  });

  /*
  it('should get some data', function(done) {
    this.timeout(5000);
    var fb = new Facebook();
    fb.suck();
  });
  */

  it('should transform data to the correct format', function(){
    // Don't really read files like this. I'm only doing it here because it's 
    // a unit test, where we can revel in questionable coding practices. 
    var facebookData = require('./data/facebook.json');
    var transformedData = (new Facebook()).transform(facebookData.data);
    var facebookModel = new store.Item(transformedData[0]);

    facebookModel.save(function(err, item) {
      assert.isNull(err);
      assert(item.lifespan === "temporary");
      assert(item.content.length > 0);
      assert(item.source === "facebook");
    });

  });
    
})