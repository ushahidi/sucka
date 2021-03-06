var logger = require("winston")
  , moment = require("moment")
  , _ = require("underscore")
  , _s = require("underscore.string")
  , request = require("request");

var sucka = {};
sucka.definition = {
  internalID: '883885b6-7baa-46c9-ad30-f4ccc0945674',
  sourceType: "reliefweb",
  frequency: "repeats",
  repeatsEvery: "day",
  startDate: moment('2014-03-30', 'YYYY-MM-DD'),
  endDate: moment('2015-04-05', 'YYYY-MM-DD'),
  description: "Historical and recent natural disaster reports from ReliefWeb's public API."
};

sucka.suck = function(source, bus) {
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

  if(!_.isUndefined(source.lastRun)) {
    var dateTime = new Date(source.lastRun);
    propertiesObject.filter = {
      field: "date.created",
      value: {
        from: dateTime.getTime()
      }
    }
  }

  var collectData = function(offset, total, lastRetrievedDoc) {
    if(total && offset >= total) {
      bus.emit("sucked", source, lastRetrievedDoc);
      return;
    }

    propertiesObject.offset = offset;
    
    request({url:url, qs:propertiesObject, json:true}, function(err, response, body) {
      logger.info("ReliefWeb request: " + url);
      logger.info("ReliefWeb props: " + JSON.stringify(propertiesObject));
      if(err) { bus.emit('error', err); return; }

      var data = response.body.data;

      _(data.list).each(function(item) {
        if(!item.fields.country) {
          item.idToUse = item.id;
          var transformed = sucka.transform(item);
          bus.emit("data", transformed);
        }
        else {
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
            var transformed = sucka.transform(item);
            bus.emit("data", transformed);
            //logger.info("ReliefWeb saving: " + JSON.stringify(transformed));
            lastRetrievedDoc = transformed;
          });
        }
      });

      if(data.count > 0) {
        collectData(offset + data.count, data.total, lastRetrievedDoc);
      }
      else {
        bus.emit("sucked", source, lastRetrievedDoc);
      }

    });
  };

  collectData(0, 0);
};

sucka.transform = function(item) {
  return {
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
};

module.exports = sucka;