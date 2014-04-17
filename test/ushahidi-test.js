var chai = require('chai');
chai.should();
var config = require('config')
  , _ = require("underscore")
  , expect = chai.expect
  , assert = chai.assert
  , mongoose = require('mongoose')
  , clearDB  = require('mocha-mongoose')(config.dbURI)
  , store = require('../app/modules/cn-store-js')
  , sucka = require('../app/modules/suckas/ushahidi');

describe('ushahidi sucka', function(){
  beforeEach(function(done) {
    if (mongoose.connection.db) return done();

    mongoose.connect(config.dbURI, done);
  });

  /*
  it('should get some data', function(done) {
    this.timeout(120000);
    var u = new Ushahidi();
    u.allFinished = function() {
      done();
    };
    u.suck();
  });
  */

  
  it('should transform data to the correct format', function(done){
    // Don't really read files like this. I'm only doing it here because it's 
    // a unit test, where we can revel in questionable coding practices. 
    var uData = require('./data/ushahidi.json');

    var transformedData = sucka.transform(uData[0],"1");
    var uModel = new store.Item(transformedData);

    uModel.save(function(err, item) {
      if(err) return done(err);

      assert.isNull(err);
      assert(item.lifespan === "temporary");
      assert(item.content.length > 0);
      assert(item.source === "ushahidi");
      assert.isNotNull(item.remoteID);
      assert.isDefined(item.geo.addressComponents.formattedAddress);
      assert.isDefined(item.geo.coords);

      done();
    });

  });
    
})