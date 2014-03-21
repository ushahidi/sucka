var chai = require('chai');
chai.should();
var expect = chai.expect
  , assert = chai.assert
  , config = require('config')
  , mongoose = require('mongoose')
  , store = require('../app/modules/cn-store-js')
  , connect = store.connect
  , Item = store.Item
  , clearDB  = require('mocha-mongoose')(config.dbURI)
  , _ = require("underscore");

describe('Item', function(){
  beforeEach(function(done) {
    if (mongoose.connection.db) return done();

    mongoose.connect(config.dbURI, done);
  });

  it('should create and save an Item model', function(done){
    var itemData = {
      remoteID: 1,
      tags: [{name: "health"}, {name: "police"}]
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

  it('should create and save an Item model and return a promise!', function(done){
    var itemData = {
      remoteID: 1,
      tags: [{name: "health"}, {name: "police"}]
    };

    var item = new Item(itemData);

    // Note that slick promise interface. Sweeeeeet
    var promise = item.saveP();

    promise.then(function(item) {
      assert(item.remoteID === itemData.remoteID.toString());
      assert.isDefined(item.id);
      assert.isDefined(item.createdAt);
      assert.isDefined(item.updatedAt);
      done();
    }, function(err) {
      // This will fail, which is the point.
      done(err);
    });
  });

  it('should create and save a list of Item models and return a promise!', function(done){
    var itemData = [{
      remoteID: 1,
      tags: [{name: "health"}, {name: "police"}]
    },
    {
      remoteID: 2,
      tags: [{name: "weather"}, {name: "storm"}]
    }];

    // Note that slick promise interface. Sweeeeeet
    var promise = Item.saveList(itemData, ["source", "remoteID"]);

    promise.then(function(items) {
      assert(items[0].remoteID === itemData[0].remoteID.toString());
      assert.isDefined(items[0].id);
      assert.isDefined(items[0].createdAt);
      assert.isDefined(items[0].updatedAt);

      assert(items[1].remoteID === itemData[1].remoteID.toString());
      assert.isDefined(items[1].id);
      assert.isDefined(items[1].createdAt);
      assert.isDefined(items[1].updatedAt);

      done();
    }, function(err) {
      done(err);
    });
  });

  it('should create invoke the error function when bad data is present', function(done){
    var itemData = [{
      remoteID: 1,
      tags: [{name: "health"}, {name: "asdfasdfasdf"}],
      image: 'lalalalala.png',
      lifespan: 'forever'
    },
    {
      remoteID: 2,
      tags: [{name: "weather"}, {name: "storm"}]
    }];

    // Note that slick promise interface. Sweeeeeet
    var promise = Item.saveList(itemData, ["source", "remoteID"]);

    promise.then(function(items) {
      // This will throw an error, which is the point.
      done(items);
    }, function(err) {
      assert.isNotNull(err);
      //assert(err.message === "Invalid tag(s): asdfasdfasdf");
      done();
    });
  });

  /*
  it('should raise a validation error for bad tags', function(done) {
    var itemData = {
      remoteID: 1,
      tags: [{name: "mymilkshakebringsalltheboystotheyard"}, {name: "police"}]
    };

    var item = new Item(itemData);
    item.save(function(err, item) {
      assert.isNotNull(err);
      assert(err.message === "Invalid tag(s): mymilkshakebringsalltheboystotheyard");
      done();
    });
  });
  */

  it('should set the language property from only the ISO code', function(done) {
    var itemData = {
      remoteID: 1,
      tags: [{name: "police"}],
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
      tags: [{name: "police"}],
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

  it('should not create duplicate records for the same remoteID', function(done) {
    var itemData = [{
      remoteID: 1,
      tags: [{name:"health"}, {name:"injury"}],
      source: "twitter"
    },
    {
      remoteID: 2,
      tags: [{name:"weather"}, {name: "storm"}],
      source: "twitter"
    }];


    // Note that slick promise interface. Sweeeeeet
    var promise = Item.saveList(itemData, ["source", "remoteID"]);

    promise.then(function(items) {
      var allItems = Item.find(function(err, allItems) {
        assert(allItems.length === 2);

        // this record should be updated, because it has a remoteID and 
        // source that are already in the db
        var newItemData = [{
          remoteID: 1,
          tags: [{name:"health"}, {name:"injury"}, {name:"accident"}],
          source: "twitter"
        },
        // this item should be created, because there is no remoteID 2 for
        // sourceType facebook.
        {
          remoteID: 2,
          tags: [{name:"weather"}, {name:"storm"}],
          source: "facebook"
        }];


        var promise2 = Item.saveList(newItemData, ["remoteID", "source"]).then(function(newItems) {
          var newAllItems = Item.find(function(err, newAllItems) {
            assert(newAllItems.length === 3);
            var twit1 = _(newAllItems).findWhere({remoteID: "1"});
            assert.isDefined(twit1);
            assert(twit1.tags.length === 3);
            done();
          });
        });
      });
    }, function(err) {
      assert.isNotNull(err);
      done(err);
    });


  });

  it('should not fail when save coords in a list', function(done) {
    var data = require("./data/twitter-formatted-2");

    Item.saveList(data, ["remoteID", "source"]).then(function(newItems) {
      assert(newItems.length > 0);
      done();
    }, function(err) {
      assert.isNull(err);
      done();
    });
  });

})