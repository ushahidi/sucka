
// example source http://censorbugbear.org/farmitracker/api?task=incidents
// data['payload']['incidents'][0]['incident']['incidenttitle']

var Sucka = require("./sucka")
  , logger = require("winston")
  , moment = require("moment")
  , _ = require("underscore")
  , _s = require("underscore.string")
  , request = require("request")
  , async = require('async');

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

UshahidiSucka.prototype.getInstanceIDs = function(callback) {
  var that = this;
  var url = 'http://tracker.ushahidi.com/list';
  
  var propertiesObject = {
    return_vars: "url",
    limit: "0,10000"
  };

  request({url:url, qs:propertiesObject, json:true}, function(err, response, body) {
    var keys = _(response.body).keys();
    var tuples = keys.map(function(key) { return [key, response.body[key].url + 'api'] });
    callback.call(that, err, tuples);
  });
};

UshahidiSucka.prototype.getInstanceData = function(err, tuples) {
  var that = this;
  var propertiesObject = {
    task: 'incidents'
  };

  var funcs = [];
  that.lastRetrieved = that.lastRetrieved || {};

  
  _(tuples).each(function(tuple) {
    
    if(that.lastRetrieved[tuple[0]]) {
      propertiesObject.by = 'sinceid';
      propertiesObject.id = that.lastRetrieved[tuple[0]];
    }

    request({url: tuple[1], qs: propertiesObject, json:true}, function(err, response, body) {
      //that.returnData({'remoteID': tuple[0], 'source':'test'});
      if(err) return null;
      if(!response.body || !response.body.payload || !response.body.payload.incidents) return null;

      that.transform(response.body.payload.incidents, tuple[0]);
      response.body.payload = null;
      delete response.body.payload;
      //transform([{'remoteID': '405', 'source':'test'}]);
    });
  });

};


UshahidiSucka.prototype.suck = function() {
  var that = this;
  that.getInstanceIDs(that.getInstanceData);
};


/**
 * Transform a list of tweets to items matching the CrisisNET schema.
 */
UshahidiSucka.prototype.transform = function(inputData, instanceID) {
  var that = this;

  //console.log(inputData);

  _(inputData).each(function(item) {
    var transformed = {
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
    };

    item = null;
    that.returnData(transformed);
  });


  /*
  var lastRetrievedDoc = _(_(outputData).sortBy(function(doc) {
    return (new Date(doc.publishedAt)).getTime();
  })).last();

  that.lastRetrieved[instanceID] = lastRetrievedDoc.remoteID;

  return outputData;
  */
  
};

module.exports = UshahidiSucka;