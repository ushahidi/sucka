
// example source http://censorbugbear.org/farmitracker/api?task=incidents
// data['payload']['incidents'][0]['incident']['incidenttitle']

var Sucka = require("./sucka")
  , logger = require("winston")
  , moment = require("moment")
  , _ = require("underscore")
  , _s = require("underscore.string")
  , request = require("request");

var UshahidiSucka = function() {};
UshahidiSucka.prototype = Object.create(Sucka.prototype);

UshahidiSucka.definition = {
  internalID: '9a916230-d72a-4f48-bcf6-0964caeafa70',
  sourceType: "ushahidi",
  frequency: "repeats",
  repeatsEvery: "hour",
  startDate: moment('2014-03-30', 'YYYY-MM-DD'),
  endDate: moment('2015-04-05', 'YYYY-MM-DD')
};


UshahidiSucka.prototype.suck = function() {
  var that = this;
  
  var url = 'http://tracker.ushahidi.com/list';
  
  var propertiesObject = {
    return_vars: "url",
    limit: "0,10000"
  };
    
  request({url:url, qs:propertiesObject, json:true}, function(err, response, body) {
    if(err) { that.handleError(err); return; }

    var data = response.body;
    var keys = _(data).keys();

    that.retrievedInstances = 0;
    that.totalInstances = keys.length;
    if(that.source) {
      that.lastRetrieved = that.source.lastRetrieved || {};
    }
    else {
      that.lastRetrieved = {};
    }

    _(keys).each(function(key) {
      var propertiesObject = {
        task: 'incidents'
      };

      if(that.lastRetrieved[key]) {
        propertiesObject.by = 'sinceid';
        propertiesObject.id = that.lastRetrieved[key];
      }

      request({url: data[key].url + 'api', qs: propertiesObject, json:true}, function(err, response, body) {
        if(!err && response.body && response.body.payload && response.body.payload.incidents) {
          that.transform(response.body.payload.incidents, key);
        }
        that.retrievedInstances++;

        //console.log("|||--- " + that.retrievedInstances + " --- " + that.totalInstances + " ---|||");

        if(that.retrievedInstances >= that.totalInstances) {
          that.allFinished(that.lastRetrieved);
        }
      });
    });

  });
};


/**
 * Transform a list of tweets to items matching the CrisisNET schema.
 */
UshahidiSucka.prototype.transform = function(inputData, instanceID) {
  var that = this;

  //console.log(inputData);

  var outputData = inputData.map(function(item) {
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
            item.incident.locationlongitude, 
            item.incident.locationlatitude
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
    }
  });

  _(outputData).each(function(item) {
    that.returnData(item);
  });

  var lastRetrievedDoc = _(_(outputData).sortBy(function(doc) {
    return (new Date(doc.publishedAt)).getTime();
  })).last();

  that.lastRetrieved[instanceID] = lastRetrievedDoc.remoteID;

  return outputData;
  
};

module.exports = UshahidiSucka;