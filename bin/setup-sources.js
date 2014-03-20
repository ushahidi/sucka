var config = require('config')
  , mongoose = require('mongoose')
  , store = require('../app/modules/cn-store-js')
  , moment = require('moment');

//mongoose.connect("mongodb://cnstaging:yLg14C2XZ86Pn3x@troup.mongohq.com:10021/cnstaging"); 
mongoose.connect("mongodb://localhost/crisisnet");
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

    var facebook = new store.Source({
      sourceType: "facebook",
      frequency: "repeats",
      repeatsEvery: "minute",
      startDate: moment().subtract('m', 1),
      endDate: moment().add('d', 1),
      filters: {
        searchString: "nairobi traffic"
      }
    });

    facebook.save(function(err, source) {
      console.log("Facebook saved");
      console.log(source);
    });

    var kenyaTraffic = new store.Source({
      sourceType: "kenya-traffic-incidents-2011",
      frequency: "once",
      startDate: moment().subtract('m', 1),
      endDate: moment().add('d', 1)
    });

    kenyaTraffic.save(function(err, source) {
      console.log("Kenya Traffic saved");
      console.log(source);
    });
  });
});

