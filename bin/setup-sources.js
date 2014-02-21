var config = require('config')
  , mongoose = require('mongoose')
  , store = require('../app/modules/cn-store-js')
  , moment = require('moment');

mongoose.connect(config.dbURI); 
var db = mongoose.connection;

db.once('open', function() {
  store.Source.remove({}, function(err) {
    if(err) console.log(err);
    
    var twitter = new store.Source({
      sourceType: "twitter",
      frequency: "repeats",
      repeatsEvery: "minute",
      startDate: moment().subtract('m', 1),
      endDate: moment().add('d', 1),
      filters: {
        searchString: 'traffic OR accident geocode:-1.292066,36.821946,15mi'
      }
    });

    twitter.save(function(err, source) {
      console.log("Twitter saved");
      console.log(source);
    });
  });
});

