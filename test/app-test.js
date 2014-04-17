var chai = require('chai');
chai.should();
var expect = chai.expect
  , assert = chai.assert
  , app = require('../app/app')
  , Twitter = require('../app/modules/suckas/twitter');

describe('app', function(){
  describe('#getSuckaForSource()', function(){
    it('should find a sucka module with a forSourceType property that corresponds to the passed source.sourceType property', function(){
      var source = {
        frequency: "once",
        hasRun: false,
        sourceType: "twitter"
      };

      var sucka = app.getSuckaForSource(source);
      assert(sucka === Twitter);
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
  });
})