var chai = require('chai');
chai.should();
var expect = chai.expect;
var assert = chai.assert;

var app = require('../app');

describe('app', function(){
  describe('#getSuckaForSource()', function(){
    it('should find a sucka module with a forSourceType property that corresponds to the passed source.sourceType property', function(){
      var source = {
        frequency: "once",
        hasRun: false,
        sourceType: "twitter"
      };

      var sucka = app.getSuckaForSource(source);
      sucka.forSourceType.should.equal("twitter");
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

  describe('#handleSource()', function(){
    it('should do something', function() {
      var source = {
        frequency: "once",
        hasRun: false,
        sourceType: "twitter"
      };

      var sucka = app.handleSource(source);
      //sucka.forSourceType.should.equal("twitter");
      console.log(sucka);
    });
  });
})