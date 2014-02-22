var chai = require('chai');
chai.should();
var config = require('config')
  , _ = require("underscore")
  , expect = chai.expect
  , assert = chai.assert
  , mongoose = require('mongoose')
  , clearDB  = require('mocha-mongoose')(config.dbURI)
  , store = require('../app/modules/cn-store-js')
  , KenyaTraffic = require('../app/modules/suckas/kenya-traffic-incidents-2011')
  , csv = require("fast-csv");

describe('kenya traffic sucka', function(){
  beforeEach(function(done) {
    if (mongoose.connection.db) return done();

    mongoose.connect(config.dbURI, done);
  });

  /*
  it('should get some data', function(done) {
    this.timeout(5000);
    var kt = new KenyaTraffic();
    kt.suck();
  });
  */
  
  it('should transform data to the correct format', function(){
    // Don't really read files like this. I'm only doing it here because it's 
    // a unit test, where we can revel in questionable coding practices. 
    var kt = new KenyaTraffic();

    csv(__dirname + "/data/kenya-traffic-incidents-2011.csv", {headers:true})
    .on("data", function(data){
        var data = kt.transform([data]);
        ktModel = new store.Item(data[0]);
        ktModel.save(function(err, item) {
          assert.isNull(err);
          assert(item.lifespan === "temporary");
          assert(item.content.length > 0);
          assert(item.source === "kenya-traffic-incidents-2011");
        });
    })
    .parse();

  });
    
})