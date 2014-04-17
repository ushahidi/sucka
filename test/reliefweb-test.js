var chai = require('chai');
chai.should();
var config = require('config')
  , _ = require("underscore")
  , expect = chai.expect
  , assert = chai.assert
  , mongoose = require('mongoose')
  , clearDB  = require('mocha-mongoose')(config.dbURI)
  , store = require('../app/modules/cn-store-js')
  , sucka = require('../app/modules/suckas/reliefweb');

describe('reliefweb sucka', function(){
  beforeEach(function(done) {
    if (mongoose.connection.db) return done();

    mongoose.connect(config.dbURI, done);
  });

  /*
  it('should get some data', function(done) {
    this.timeout(30000);
    var rw = new ReliefWeb();
    rw.suck();
  });
  */

  it('should transform data to the correct format', function(done){
    // Don't really read files like this. I'm only doing it here because it's 
    // a unit test, where we can revel in questionable coding practices. 
    var rwData = require('./data/relief-web-disaster-list.json');
    var firstItem = rwData.data.list[0];
    firstItem.idToUse = 1;
    var transformedData = sucka.transform(firstItem);
    var rwModel = new store.Item(transformedData);

    rwModel.save(function(err, item) {
      if(err) return done(err);

      assert.isNull(err);
      assert(item.lifespan === "temporary");
      assert(item.content.length > 0);
      assert(item.source === "reliefweb");
      assert.isNotNull(item.geo.addressComponents.adminArea1);

      done();
    });

  });
    
})