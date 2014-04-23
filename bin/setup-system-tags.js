var config = require('config')
  , mongoose = require('mongoose')
  , store = require('../app/modules/cn-store-js');

mongoose.connect(config.dbURI);
var db = mongoose.connection;

var conflictTags = require('../data/conflict-tags.json');
var disasterTags = require('../data/disaster-tags.json');
var enthnicityTags = require('../data/ethnicity-tags.json');
var knowngroupTags = require('../data/knowngroup-tags.json');

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

enthnicityTags = enthnicityTags.map(function(tag) {
  return {
    name: tag,
    categories: ['ethnicity']
  }
});

knowngroupTags = knowngroupTags.map(function(tag) {
  return {
    name: tag,
    categories: ['knowngroup']
  }
});

var allTags = conflictTags.concat(disasterTags).concat(enthnicityTags).concat(knowngroupTags);

db.once('open', function() {
  store.SystemTag.saveList(allTags, ['name']).then(function(tags) {
    db.close();
  });
});

