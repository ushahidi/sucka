var Sucka = require("./sucka")
  , logger = require("winston")
  , moment = require("moment")
  , _ = require("underscore")
  , _s = require("underscore.string")
  , request = require("request");

var ReliefSucka = function() {};
ReliefSucka.prototype = Object.create(Sucka.prototype);

ReliefSucka.definition = {
  internalID: '883885b6-7baa-46c9-ad30-f4ccc0945674',
  sourceType: "reliefweb",
  frequency: "repeats",
  repeatsEvery: "day",
  startDate: moment('2014-03-30', 'YYYY-MM-DD'),
  endDate: moment('2014-04-05', 'YYYY-MM-DD')
};


ReliefSucka.prototype.suck = function() {
  var that = this;

  var url = 'http://api.rwlabs.org/v0/disaster/list';
  var propertiesObject = {
    fields: {
      include:[
        'name',
        'description',
        'primary_country',
        'date',
        'country',
        'primary_type',
        'type'
      ]
    },
    limit: 100
  };
  
  if(!_.isUndefined(that.source.lastRetrieved)) {
    propertiesObject.filter = {
      field: "date.created",
      value: {
        from: (new Date(that.source.lastRetrieved.publishedAt)).getTime()
      }
    }
  }

  var collectData = function(offset, memo, total) {
    if(total && offset >= total) {
      that.transform(memo);
      return;
    }
    
    request({url:url, qs:propertiesObject, json:true}, function(err, response, body) {
      if(err) { that.handleError(err); return; }

      var data = response.body.data;

      collectData(offset + data.count, memo.concat(data.list), data.total);

    });
  };

  collectData(0, []);
};


/**
 * Transform a list of tweets to items matching the CrisisNET schema.
 */
ReliefSucka.prototype.transform = function(inputData) {
  var that = this;

  var outputData = [];

  var transformItem = function(item) {
    var returnData = {
      remoteID: item.idToUse,
      publishedAt: new Date(moment(item.fields.date.created)),
      lifespan: "temporary",
      content: item.fields.description || item.fields.name,
      summary: item.fields.name,
      geo: {
        addressComponents: {
          adminArea1: item.singleCountry
        }
      },
      language: {
        code: 'en',
      },
      source: "reliefweb",
      tags: (function() {
        return item.fields.type.map(function(tag) {
          return { name: _s.slugify(tag.name), confidence: 1 }
        });
      })()
    };

    return returnData;

  };


  // Data from ReliefWeb can be associated with multiple countries. The 
  // occurence of this disaster in each country is considered a separate 
  // incident, we create a separate document.
  _(inputData).each(function(item) {
    _(item.fields.country).each(function(country, idx) {
      item.singleCountry = country.name;
      
      // Every item must have a unique remote id, so because we create multiple
      // documents from a single returned record, we need to create a modified
      // remoteid for "child" documents
      if(idx === 0) {
        item.idToUse = item.id;
      }
      else {
        item.idToUse = item.id + "-" + idx;
      }

      outputData.push(transformItem(item));
    });
  });

  _(outputData).each(function(item) {
    that.returnData(item);
  });

  var lastRetrievedDoc = _(_(outputData).sortBy(function(doc) {
    return (new Date(doc.publishedAt)).getTime();
  })).last();

  that.allFinished(lastRetrievedDoc);

  return outputData;
};

module.exports = ReliefSucka;