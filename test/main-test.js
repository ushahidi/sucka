var chai = require('chai');
chai.should();
var expect = chai.expect
  , assert = chai.assert
  , App = require('../app/main')
  , app = new App()
  , Twitter = require('../app/modules/suckas/twitter')
  , moment = require("moment");

describe('app', function(){
  describe('#getSuckaForSource()', function(){
    it('should find a sucka module with a forSourceType property that corresponds to the passed source.sourceType property', function(){
      var source = {
        frequency: "once",
        hasRun: false,
        sourceType: "twitter"
      };

      var Sucka = app.getSuckaForSource(source);
      assert(Sucka === Twitter);
    });

    it('should return null when source.sourceType has no corresponding sucka', function() {
      var source = {
        frequency: "once",
        hasRun: false,
        sourceType: "alsdjflaksdjf"
      };

      var sucka = app.getSuckaForSource(source);
      assert.isNull(sucka);
    });

    it('should return null when source.frequency is once and source.hasRun', function() {
      var source = {
        frequency: "once",
        hasRun: true,
        sourceType: "twitter"
      };

      var sucka = app.getSuckaForSource(source);
      assert.isNull(sucka);
    });
  });

  describe('#shouldSuck()', function() {
    it('should always suck a streaming source', function(done) {
      var source = {
        frequency: "always",
        hasRun: true,
        sourceType: "twitter"
      };

      app.shouldSuck(source, function(shouldSuck) {
        assert.ok(shouldSuck);
        done();
      });
    });

    it('should suck a one-time source that has not sucked', function(done) {
      var source = {
        sourceType: "kenya-traffic-incidents-2011",
        frequency: "once",
        startDate: moment().subtract('m', 1),
        endDate: moment().add('d', 1),
        hasRun: false
      };

      app.shouldSuck(source, function(shouldSuck) {
        assert.ok(shouldSuck);
        done();
      });
    });

    it('should not suck a one-time source that has been sucked', function(done) {
      var source = {
        frequency: "once",
        hasRun: true,
        sourceType: "twitter"
      };

      app.shouldSuck(source, function(shouldSuck) {
        assert.notOk(shouldSuck);
        done();
      });
    });
  });
})