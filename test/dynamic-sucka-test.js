var sampleSource = { sourceType: 'ReliefWeb',
  sourceURL: 'http://api.rwlabs.org/v0/disaster/list?fields[include][]=name&fields[include][]=description&fields[include][]=date&fields[include][]=primary_country&fields[include][]=type',
  sourceDataType: 'json',
  description: 'For Relief of the Web.',
  listProperty: 'data.list',
  isDynamic: 'true',
  mapping: 
   { remoteID: 'id',
     publishedAt: 'fields.date',
     content: 'fields.description',
     summary: 'fields.name',
     'tags.name': 'fields.type.name',
     'geo.addressComponents.adminArea1': 'fields.primary_country.name' },
  internalID: 'dddba582-4a2d-4a46-a2a5-66c26b1d5e50',
  createdBy: '532d1bacbbcdd1862d6e15b2' }

var chai = require('chai');
chai.should();
var config = require('config')
  , _ = require("underscore")
  , expect = chai.expect
  , assert = chai.assert
  //, mongoose = require('mongoose')
  //, clearDB  = require('mocha-mongoose')(config.dbURI)
  , store = require('../app/modules/cn-store-js')
  , sucka = require('../app/modules/suckas/dynamic');

describe('reliefweb sucka', function(){
  beforeEach(function(done) {
    //if (mongoose.connection.db) return done();

    //mongoose.connect(config.dbURI, done);
    done();
  });

  it('should transform data to the correct format', function(done){
    var sampleData = {"id":"13385","score":1,"fields":{"description":"A total of 43 suspected cases of measles were reported in Malakal County in South Sudan's Upper Nile State since August 2013, according to the Upper Nile State Ministry of Health and WHO. A mass measles vaccination campaign was launched targeting over 31,300 children. ([OCHA, 29 Sep 2013](\/node\/606536))\r\n\r\nThe ongoing displacement caused by the violence that broke out on 15 Dec has led to an increase in measles cases and deaths. By the beginning of February 2014, 522 suspected cases and 77 related deaths had been recorded in IDPs camps. ([WHO, 4 Feb 2014](\/node\/635142))","name":"South Sudan: Measles Outbreak - Sep 2013","date":{"created":1380412800000},"type":[{"id":4642,"name":"Epidemic","primary":true}],"primary_country":{"id":8657,"name":"South Sudan","shortname":"South Sudan","iso3":"ssd"}}};
    var transformed = sucka.transform(sampleData, sampleSource);
    console.log(transformed);
    done();
  });
    
})