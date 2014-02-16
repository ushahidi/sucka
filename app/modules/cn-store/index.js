var mongoose = require('mongoose')
  , config = require('config')
  , Item = require('item')
  , Map = require('map')
  , Region = require('region')
  , Source = require('source')
  , User = require('user')


var connect = function() {
  mongoose.connect(config.dbURI);
  return db.connection;
};


module.exports = {
  connect: connect,
  Item: Item,
  Map: Map,
  Region: Region,
  Source: Source,
  User: User
}