var Sucka = require("./sucka")
  , logger = require("winston")
  , moment = require("moment")
  , csv = require("fast-csv")
  , _ = require('underscore')
  , _s = require("underscore.string")
  , fs = require('fs')
  , unzip = require('unzip');


var Gdelt = function() {};
Gdelt.prototype = Object.create(Sucka.prototype);

Gdelt.prototype.logger = 0;

Gdelt.prototype.suck = function() {
  var that = this;

  fs.createReadStream(__dirname + '/data/20140316.export.CSV.zip')
  .pipe(unzip.Parse())
  .on('entry', function (entry) {
    var fileName = entry.path;
    if (fileName === "20140316.export.CSV") {
      var newFilePath = __dirname + '/data/gdelt-latest.csv';
      var newFile = fs.createWriteStream(newFilePath);
      entry.pipe(newFile);
      newFile.on('finish', function() {
        var stream = fs.createReadStream(newFilePath);
        csv.fromStream(stream, {delimiter: "\t"})
        .on("record", function(record){
            that.transform(record);
        });
      });
    } else {
      entry.autodrain();
    }
  });
};

Gdelt.prototype.setupData = function() {
  var path = './data/gdelt/';
  
  if(!this.columns) {
    this.columns = require(path + 'column-names.json');
  }

  if(!this.ethnicities) {
    this.ethnicities = require(path + 'ethnicities.json');
  }

  if(!this.eventTypes) {
    this.eventTypes = require(path + 'event-types.json');
  }

  if(!this.eventDescriptions) {
    this.eventDescriptions = require(path + 'event-descriptions.js');
  }

  if(!this.religions) {
    this.religions = require(path + 'religions.json'); 
  }
};

Gdelt.prototype.recordToObject = function(record) {
  var data = {};

  _(this.columns).each(function(column, idx) {
    data[column] = record[idx];
  });

  return data;
};

Gdelt.prototype.determineTags = function(recordObject) {
  var tags = [];

  // ethnicities
  // known groups
  // type
  // category tags based on EventCode

  return tags;
};

Gdelt.prototype.shouldTransform = function(recordObject) {
  if(this.logger > 5) return false;

  if(!moment(recordObject.SQLDATE, 'YYYYMMDD').isSame(moment('20140316', 'YYYYMMDD'), 'day')) return false;
  if(_s.startsWith(recordObject.EventRootCode, '0')) return false;
  if(parseInt(recordObject.EventRootCode,10) < 14) return false;

  var descriptions = _(this.eventDescriptions).filter(function(desc) {
    return desc.code.toString() === recordObject.EventCode.toString();
  });

  if(_(descriptions).isEmpty() || _s.include(descriptions[0].label, 'not specified')) return false;

  this.logger++;
  return true;
};

Gdelt.prototype.transform = function(record) {
  var that = this;
  //this.eventTypes
  //this.eventDescriptions
  //this.knownGroups
  //this.religions
  //this.ethnicities

  that.setupData();

  recordObject = that.recordToObject(record);
  if(!that.shouldTransform(recordObject)) return false;

  var outputData = {
    remoteID: recordObject.GLOBALEVENTID,
    publishedAt: new Date(moment(recordObject.SQLDATE, 'YYYYMMDD')),
    lifespan: "temporary",
    content: (function() {
      var descriptions = _(that.eventDescriptions).filter(function(desc) {
        return desc.code.toString() === recordObject.EventCode.toString();
      });

      if(!_(descriptions).isEmpty()) {
        return descriptions[0].label;
      }
      else {
        return null;
      }
    })(),
    geo: {
      addressComponents: {
        formattedAddress: (function() {
          if(!_(recordObject.Actor1Geo_FullName).isEmpty()) {
            return recordObject.Actor1Geo_FullName;
          }

          if(!_(recordObject.Actor2Geo_FullName).isEmpty()) {
            return recordObject.Actor1Geo_FullName;
          }

          return null;
        })()
      }
    },
    language: {
      code: 'en'
    },
    source: 'gdelt',
    tags: []
  };

  // Add coordinates if available
  if(!_(recordObject.Actor2Geo_Lat).isEmpty() || !_(recordObject.Actor1Geo_Lat).isEmpty()) {
    var point = (function() {
      if(!_(recordObject.Actor1Geo_Lat).isEmpty()) {
        return [recordObject.Actor1Geo_Long, recordObject.Actor1Geo_Lat];
      }
      else {
        return [recordObject.Actor2Geo_Long, recordObject.Actor2Geo_Lat];
      }
    })();

    outputData.coords = {
      coordinates: point,
      type: 'Point'
    };
  }

  // Add fromURL if available
  if(!_(recordObject.SOURCEURL).isEmpty()) {
    outputData.fromURL = recordObject.SOURCEURL;
  }

  // No need to summarize this content, it's already short 
  outputData.summary = outputData.content; 

  // Set the initial tags
  outputData.tags = that.determineTags();

  //console.log(outputData);

  this.allFinished(outputData);
  return outputData;
};

module.exports = Gdelt;