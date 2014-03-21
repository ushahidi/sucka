var Sucka = require("./sucka")
  , logger = require("winston")
  , moment = require("moment")
  , csv = require("fast-csv")
  , _ = require('underscore')
  , _s = require("underscore.string")
  , fs = require('fs')
  , unzip = require('unzip')
  , request = require('request')
  , logger = require('winston')
  , validator = require('validator');


var Gdelt = function() {};
Gdelt.prototype = Object.create(Sucka.prototype);

Gdelt.definition = {
  internalID: '6589847b-57f0-425e-bb6b-c0ce4fd1bafa',
  sourceType: "gdelt",
  frequency: "repeats",
  repeatsEvery: "day",
  startDate: moment('2014-03-20', 'YYYY-MM-DD'),
  endDate: moment('2014-03-21', 'YYYY-MM-DD')
};

Gdelt.prototype.suck = function() {
  var that = this;

  var zipFilePath = __dirname + '/data/gdelt/latest-daily.zip';
  var today = moment('2014-03-18', 'YYYY-MM-DD').format('YYYYMMDD');
  var file = fs.createWriteStream(zipFilePath);
  var url = 'http://data.gdeltproject.org/events/'+ today + '.export.CSV.zip';

  request(url, function(err, resp, body) {
    if(err) {
      that.handleError(err);
    }
    logger.info('Gdelt.suck retrieved ' + url + ' with code ' + resp.statusCode);
  }).pipe(file);

  file.on('finish', function() {
    logger.info("Gdelt suck finished writing zip");
    file.close();
    
    fs.createReadStream(zipFilePath)
    .pipe(unzip.Parse())
    .on('entry', function (entry) {
      var fileName = entry.path;
      if (fileName === today + ".export.CSV") {
        var newFilePath = __dirname + '/data/gdelt/gdelt-latest.csv';
        var newFile = fs.createWriteStream(newFilePath);
        entry.pipe(newFile);
        newFile.on('finish', function() {
          logger.info("Gdelt.suck zip file extracted");
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
  var that = this;

  var tags = [];

  var findValue = function(list, property) {
    return _(list).filter(function(item) {
      return item.code.toString() === recordObject[property].toString();
    });
  };

  var pushIfExists = function(list) {
    if(!_(list).isEmpty()) {
      tags.push(list[0].label);
    }
  };

  var tagsForProps = function(props, list) {
    _(props).each(function(prop) {
      var found = findValue(list, prop);
      pushIfExists(found);
    });
  };

  tagsForProps(['Actor1EthnicCode', 'Actor2EthnicCode'], that.ethnicities);
  tagsForProps(['Actor1KnownGroupCode', 'Actor2KnownGroupCode'], that.knownGroups);
  tagsForProps(['Actor1EthnicCode', 'Actor2EthnicCode'], that.ethnicities);
  tagsForProps(['Actor1Religion1Code', 'Actor1Religion2Code',
    'Actor2Religion1Code', 'Actor2Religion2Code'], that.religions);
  tagsForProps(['Actor1Type1Code', 'Actor1Type2Code','Actor1Type3Code',
    'Actor2Type1Code','Actor2Type2Code','Actor2Type3Code'], that.eventTypes);

  var codeToTag = {
    '14': ['protest', 'conflict'],
    '145': ['physical-violence', 'riot', 'conflict'],
    '1451': ['physical-violence', 'riot', 'conflict'],
    '1452': ['physical-violence', 'riot', 'conflict'],
    '1453': ['physical-violence', 'riot', 'conflict'],
    '1454': ['physical-violence', 'riot', 'conflict'],
    '1711': ['property-loss', 'conflict'],
    '1712': ['property-loss', 'conflict'],
    '173': ['arrest', 'conflict'],
    '174': ['deportation', 'conflict'],
    '175': ['physical-violence', 'conflict'],
    '181': ['physical-violence', 'abduction', 'conflict'],
    '18': ['physical-violence', 'conflict'],
    '1821': ['physical-violence', 'sexual-violence', 'conflict'],
    '1822': ['physical-violence', 'torture', 'conflict'],
    '1823': ['physical-violence', 'death', 'conflict'],
    '183': ['physical-violence', 'death', 'suicide-bombing', 'conflict'],
    '1831': ['physical-violence', 'death', 'suicide-bombing', 'conflict'],
    '1832': ['physical-violence', 'death', 'suicide-bombing', 'conflict'],
    '1833': ['physical-violence', 'death', 'conflict'],
    '185': ['physical-violence', 'death', 'assassination', 'conflict'],
    '186': ['physical-violence', 'assassination', 'conflict'],
    '19': ['conflict'],
    '191': ['restrict-movement', 'conflict'],
    '192': ['occupation', 'conflict'],
    '193': ['conflict', 'armed-conflict'],
    '194': ['conflict', 'armed-conflict'],
    '201': ['conflict', 'mass-violence'],
    '202': ['conflict', 'mass-violence', 'death', 'physical-violence'],
    '203': ['conflict', 'mass-violence', 'death', 'physical-violence', 'ethnic-violence']
  };

  var tagForEventCode = function(props) {
    _(props).each(function(prop) {
      if(!_(codeToTag[recordObject[prop]]).isUndefined()) {
        tags = tags.concat(codeToTag[recordObject[prop]]);
      }
    });
  };

  tagForEventCode(['EventCode', 'EventRootCode', 'EventBaseCode']);

  return _(_.uniq(tags)).map(function(tag) { return {name: tag}});
};

Gdelt.prototype.shouldTransform = function(recordObject) {

  if(!moment(recordObject.SQLDATE, 'YYYYMMDD').isSame(moment('20140318', 'YYYYMMDD'), 'day')) return false;
  if(_s.startsWith(recordObject.EventRootCode, '0')) return false;
  if(parseInt(recordObject.EventRootCode,10) < 14) return false;

  var descriptions = _(this.eventDescriptions).filter(function(desc) {
    return desc.code.toString() === recordObject.EventCode.toString();
  });

  if(_(descriptions).isEmpty() || _s.include(descriptions[0].label, 'not specified')) return false;

  return true;
};

Gdelt.prototype.transform = function(record) {
  var that = this;
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
  if(!_(recordObject.SOURCEURL).isEmpty() && validator.isURL(recordObject.SOURCEURL)) {
    outputData.fromURL = recordObject.SOURCEURL;
  }

  // No need to summarize this content, it's already short 
  outputData.summary = outputData.content; 

  // Set the initial tags
  outputData.tags = that.determineTags(recordObject);

  // `transform` method returns an Array
  outputData = [outputData];

  this.allFinished(outputData);
  return outputData;
};

module.exports = Gdelt;