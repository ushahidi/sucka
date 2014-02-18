var chai = require('chai');
chai.should();
var expect = chai.expect
  , assert = chai.assert
  , config = require('config')
  , mongoose = require('mongoose')
  , store = require('../app/modules/cn-store')
  , connect = store.connect
  , Item = store.Item
  , clearDB  = require('mocha-mongoose')(config.dbURI);

describe('Item', function(){
  beforeEach(function(done) {
    if (mongoose.connection.db) return done();

    mongoose.connect(config.dbURI, done);
  });

  it('should create and save an Item model', function(done){
    var itemData = {
      remoteID: 1,
      tags: ["health", "police"]
    };

    var item = new Item(itemData);
    item.save(function(err, item) {
      assert.isNull(err);
      assert(item.remoteID === itemData.remoteID.toString());
      assert.isDefined(item.id);
      assert.isDefined(item.createdAt);
      assert.isDefined(item.updatedAt);
      done();
    });
  });

  it('should raise a validation error for bad tags', function(done) {
    var itemData = {
      remoteID: 1,
      tags: ["mymilkshakebringsalltheboystotheyard", "police"]
    };

    var item = new Item(itemData);
    item.save(function(err, item) {
      assert.isNotNull(err);
      assert.isDefined(err.errors.tags);
      done();
    });
  });

  it('should set the language property from only the ISO code', function(done) {
    var itemData = {
      remoteID: 1,
      tags: ["police"],
      language: {
        code: "en",
        name: "LALALALALA"
      }
    };

    var item = new Item(itemData);
    item.save(function(err, item) {
      assert.isNull(err);
      assert(item.language.name === "English");
      done();
    });
  });

  it('should create a summary if content is provided', function(done) {
    var itemData = {
      remoteID: 1,
      tags: ["police"],
      language: {
        code: "en",
        name: "LALALALALA"
      },
      content: "Lorem ipsizzle dolor black amizzle, tellivizzle adipiscing go to hizzle. Nullizzle ghetto shizznit, phat volutpizzle, mah nizzle quis, gravida vizzle, arcu. Pellentesque check out this i saw beyonces tizzles and my pizzle went crizzle. Check out this erizzle. Dawg fizzle izzle mammasay mammasa mamma oo sa fo shizzle tempizzle break it down. Ma nizzle pellentesque nibh cool turpizzle. Bling bling izzle tortizzle. Pellentesque eleifend rhoncizzle nisi. In pimpin' you son of a bizzle platea dictumst. You son of a bizzle dapibus. Curabitizzle tellizzle urna, pretizzle eu, mattizzle ac, eleifend vitae, nunc. Check it out suscipizzle. Integizzle semper break it down black fo shizzle."
    };

    var item = new Item(itemData);
    item.save(function(err, item) {
      assert.isNull(err);
      assert.ok(item.summary);
      assert(item.summary.length <= 110); // Technically this is cut off at 100 but cutting some slack
      done();
    });
  });

})