var config = require('config')
  , mongoose = require('mongoose')
  , store = require('../app/modules/cn-store-js')
  , moment = require('moment');

mongoose.connect(config.dbURI); 
var db = mongoose.connection;

db.once('open', function() {
  var twitter = new store.Source({
    sourceType: "twitter",
    frequency: "always",
    startDate: moment().subtract('m', 1),
    endDate: moment().add('d', 1),
    filters: {
      text: '#Ukraine'
    }
  });

  twitter.save(function(err, source) {
    console.log("Twitter saved");
    console.log(source);
  });
});

