var config = require('config')
  , mongoose = require('mongoose')
  , store = require('../app/modules/cn-store-js');

mongoose.connect(config.dbURI);
var db = mongoose.connection;

var conflictTags = require('../data/conflict-tags.json');

var disasterTags = require('../data/disaster-tags.json');;

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
  store.SystemTag.saveList(allTags, ['name']).then(function(tags) {
    db.close();
  });
});

