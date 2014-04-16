var config = require('config')
  , mongoose = require('mongoose')
  , store = require('../app/modules/cn-store-js');

mongoose.connect(config.dbURI);
var db = mongoose.connection;

var conflictTags = [
  'conflict'
  'physical-violence',
  'riot',
  'property-loss',
  'death',
  'suicide-bombing',
  'restricted-movement',
  'mass-violence',
  'ethnic-violence',
  'arrest',
  'sexual-violence',
  'torture',
  'armed-conflict'
];

var disasterTags = [
  'disaster',
  'earthquake',
  'tropical-cyclone',
  'flood',
  'landslide',
  'mudslide',
  'severe-storm',
  'earthquake',
  'epidemic',
  'drought',
  'extreme-heat',
  'extreme-cold',
  'hurricane',
  'tornado',
  'volcano',
  'fire',
  'avalanche',
  'tsunami'
];

conflictTags = conflictTags.map(function(tag) {
  return {
    name: tag,
    categories: ['conflict']
  }
});

disasterTags = disasterTags.map(function(tag) {
  return {
    name: tag,
    categories: ['disaster']
  }
});

var allTags = conflictTags.concat(disasterTags);

db.once('open', function() {
  
});

