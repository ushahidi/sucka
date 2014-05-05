var logger = require("winston")
  , moment = require("moment")
  , _ = require("underscore")
  , request = require("request");

var sucka = {};

sucka.definition = {
  internalID: '9a916230-d72a-4f48-bcf6-0964caeafa70',
  sourceType: "ushahidi",
  language: "javascript",
  frequency: "repeats",
  repeatsEvery: "hour",
  startDate: moment('2014-03-30', 'YYYY-MM-DD'),
  endDate: moment('2015-04-20', 'YYYY-MM-DD'),
  description: "Aggregated incident reports from all publicly accessible \
  Ushahidi instances, both self-hosted and Crowdmap Classic."
};

sucka.suck = function(source, bus) {
  getInstanceIDs(source, bus, getInstanceData);
};

sucka.transform = function(item, instanceID) {
  return {
    remoteID: instanceID + "-" + item.incident.incidentid,
    publishedAt: new Date(item.incident.incidentdate),
    content: item.incident.incidentdescription,
    summary: item.incident.incidenttitle,
    lifespan: "temporary",
    geo: (function() {
      var data = {
        addressComponents: {
          formattedAddress: item.incident.locationname
        }
      };

      if(item.incident.locationlongitude && item.incident.locationlatitude) {
        data.coords = [
          parseFloat(item.incident.locationlongitude), 
          parseFloat(item.incident.locationlatitude)
        ]
      }
      return data;
    })(),
    source: "ushahidi",
    tags: (function() {
      return item.categories.map(function(category) {
        return {
          name: category.category.title,
          confidence: 1
        }
      });
    })()
  };
};

var getInstanceIDs = function(source, bus, callback) {
  var url = 'http://tracker.ushahidi.com/list';
  
  var propertiesObject = {
    return_vars: "url",
    limit: "0,5000",
    minpopularity: 10
  };

  request({url:url, qs:propertiesObject, json:true}, function(err, response, body) {
    if(err) return bus.emit('error', err);
    if(!response) return false;

    var keys = _(response.body).keys();
    var tuples = keys.map(function(key) { return [key, response.body[key].url + 'api'] });
    callback(err, source, bus, tuples);

    response.body = null;
  });
};

var lastRetrieved;
var getInstanceData = function(err, source, bus, tuples) {
  lastRetrieved = source.lastRetrieved || {};
  var totalRetrieved = tuples.length;
  var totalProcessed = 0;

  var propertiesObject = {
    task: 'incidents',
    limit: 10
  };
  
  _(tuples).each(function(tuple) {
    
    if(lastRetrieved[tuple[0]]) {
      propertiesObject.by = 'sinceid';
      propertiesObject.id = lastRetrieved[tuple[0]].split('-')[1];
    }

    request({url: tuple[1], qs: propertiesObject, json:true}, function(err, response, body) {
      //that.returnData({'remoteID': tuple[0], 'source':'test'});

      if(response && response.body && typeof response.body === "string") {
        console.log(response.body);
        response.body = JSON.parse(response.body);
      }

      //if(tuple[1] === 'https://syriatracker.crowdmap.com/api') {
      //  console.log(response.body.payload);
      //}
      
      if(response && response.body && response.body.payload && response.body.payload.incidents) {
         var transformed = _(response.body.payload.incidents).map(function(item) {
            return sucka.transform(item, tuple[0]);
         });

        _(transformed).each(function(item) {
          bus.emit("data", item);
        });
          
        var lastRetrievedDoc = _(_(transformed).sortBy(function(doc) {
          var dateTime = new Date(doc.publishedAt);
          return dateTime.getTime();
        })).last();

        lastRetrieved[tuple[0]] = lastRetrievedDoc.remoteID;
      }

      totalProcessed++;

      if(totalProcessed >= totalRetrieved) {
        bus.emit("sucked", source, lastRetrieved);
      }
      return null;
        
    });
  });

};

module.exports = sucka;