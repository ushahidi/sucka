var chai = require('chai');
chai.should();
var config = require('config')
  , _ = require("underscore")
  , expect = chai.expect
  , assert = chai.assert
  , mongoose = require('mongoose')
  , clearDB  = require('mocha-mongoose')(config.dbURI)
  , store = require('../app/modules/cn-store-js')
  , moment = require("moment")
  , Gdelt = require('../app/modules/suckas/gdelt')
  , csv = require("fast-csv")
  , fs = require('fs');

describe('gdelt sucka', function(){
  beforeEach(function(done) {
    if (mongoose.connection.db) return done();

    mongoose.connect(config.dbURI, done);
  });

  /*
  it('should get some data', function(done) {
    this.timeout(1200000);
    var gd = new Gdelt();
    gd.suck();
  });
  */


  it('should setup the event code data', function(done) {
    //this.timeout(5000);
    var gd = new Gdelt();
    gd.setupData();
    assert.isDefined(gd.columns);
    assert(gd.columns.length > 0);

    assert.isDefined(gd.ethnicities);
    assert(gd.ethnicities.length > 0);

    assert.isDefined(gd.eventTypes);
    assert(gd.eventTypes.length > 0);

    assert.isDefined(gd.eventDescriptions);
    assert(gd.eventDescriptions.length > 0);

    assert.isDefined(gd.religions);
    assert(gd.religions.length > 0);

    done();
  });

  it('should apply the correct tags', function() {
    var recordObject = { 
      Actor1KnownGroupCode: 'AML',
      Actor1EthnicCode: 'aka',
      Actor1Religion1Code: 'HIN',
      Actor1Religion2Code: 'ITR',
      Actor1Type1Code: 'MED',
      Actor1Type2Code: 'REF',
      Actor1Type3Code: 'MOD',
      Actor2KnownGroupCode: 'AMN',
      Actor2EthnicCode: 'aku',
      Actor2Religion1Code: 'HSD',
      Actor2Religion2Code: 'JAN',
      Actor2Type1Code: 'HRI',
      Actor2Type2Code: 'LAB',
      Actor2Type3Code: 'LEG',
      EventCode: '1832',
      EventBaseCode: '182',
      EventRootCode: '18'
    };

    var gd = new Gdelt();
    gd.setupData();

    var tags = gd.determineTags(recordObject);
    var expectedTags = [ 
      'Akan',
      'Aku',
      'Hinduism',
      'Indigenous Tribal Religion',
      'Hasidic',
      'Jainism',
      'Media',
      'Refugees',
      'Moderate',
      'Human Rights',
      'Labor',
      'Legislature',
      'physical-violence',
      'death',
      'suicide-bombing',
      'conflict' 
    ];

    tags = _(tags).pluck('name');
    assert(_.difference(expectedTags, tags).length === 0);

    _(expectedTags).each(function(tag) {
      assert(_(tags).contains(tag));
    });

  });
  /*
  it('should extract the csv and parse results', function(done) {
    this.timeout(30000);
    var gd = new Gdelt();
    gd.setupData();
    var zipFilePath = __dirname + "/data/latest-daily.zip";
    var today = moment('2014-03-20', 'YYYY-MM-DD').format('YYYYMMDD');
    var newFilePath = __dirname + '/data/gdelt-tmp.csv';
    var relevantOutputPath = __dirname + '/data/gdelt-relevant.csv';

    gd.returnData = function(data) {
      assert.isDefined(data.remoteID);
      //assert.isDefined(data.geo.coords);
      //assert(data.geo.coords.length === 2);
    };

    gd.allFinished = function(lastTransformed) {
      console.log("----------- IN ALL FINISHED ------------");
      assert.isDefined(lastTransformed.remoteID);
      done();
    };

    gd.processData(zipFilePath, newFilePath, relevantOutputPath, today);
  });
  */
  
  it('should transform data to the correct format', function(done){
    this.timeout(20000);
    var gd = new Gdelt();
    gd.setupData();
    var csvFilePath = __dirname + "/data/gdelt-sample.csv";
    var relevantOutputPath = __dirname + '/data/gdelt-sample-relevant.csv';

    gd.findRelevantRecords(csvFilePath, relevantOutputPath, '2014-03-19')
      .then(function(relevantFilePath) {
        var relevantStream = fs.createReadStream(relevantFilePath);
        var lastTransformed;

        csv.fromStream(relevantStream, {delimiter: "\t"})
        .on("record", function(record){
          lastTransformed = gd.transform(record);

          assert.isDefined(lastTransformed.geo.coords);

          gdModel = new store.Item(lastTransformed);
          gdModel.save(function(err, item) {
            if(err) {
              console.log(err);
              console.log(gdModel);
            }
            assert.isNull(err);
            assert(item.lifespan === "temporary");
            assert(item.content.length > 0);
            assert(item.tags.length > 0);
            assert(item.source === "gdelt");
            assert.isDefined(item.geo.coords);
            assert(_(item.geo.coords).isArray());
          });
        })
        .on("end", function(){
          done();
        });
      });
  });

});