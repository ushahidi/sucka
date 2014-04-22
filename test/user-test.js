var chai = require('chai');
chai.should();
var expect = chai.expect
  , assert = chai.assert
  , config = require('config')
  , mongoose = require('mongoose')
  , store = require('../app/modules/cn-store-js')
  , User = store.User
  , clearDB  = require('mocha-mongoose')(config.dbURI)
  , moment = require('moment')
  , async = require('async')
  , _ = require("underscore");

describe('User', function(){
  beforeEach(function(done) {
    if (mongoose.connection.db) return done();

    mongoose.connect(config.dbURI, done);
  });

  it('should create and save a User model', function(done){
    var userModel = new User();
    userModel.save(function(err, user) {
      assert.isNull(err);
      assert(_(user.roles).contains("developer"));
      done();
    });
  });

  it('should fail to save a User model with unknown role', function(done){
    var userModel = new User({roles: ['astronaut', 'developer']});
    userModel.save(function(err, user) {
      assert.isNotNull(err);
      done();
    });
  });

  it('should create and save a User model with multiple roles', function(done){
    var userModel = new User({roles:["developer", "admin"]});
    userModel.save(function(err, user) {
      assert.isNull(err);
      assert(_(user.roles).contains("developer"));
      assert(_(user.roles).contains("admin"));
      done();
    });
  });

})