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
  , validator = require('validator')
  , Promise = require("promise");


var Gdelt = function() {};
Gdelt.prototype = Object.create(Sucka.prototype);

Gdelt.definition = {
  internalID: '6589847b-57f0-425e-bb6b-c0ce4fd1bafa',
  sourceType: "gdelt",
  frequency: "repeats",
  repeatsEvery: "day",
  startDate: moment('2014-03-19', 'YYYY-MM-DD'),
  endDate: moment('2015-03-22', 'YYYY-MM-DD')
};

Gdelt.prototype.suck = function() {
  var that = this;

  logger.info("Gdelt.suck starting suck...");
  that.setupData();

  // Where we're putting the file we retrieve from Gdelt website
  var zipFilePath = __dirname + '/data/gdelt/latest-daily.zip';
  var today = moment().subtract('days',2).format('YYYYMMDD');
  var file = fs.createWriteStream(zipFilePath);
  var url = 'http://data.gdeltproject.org/events/'+ today + '.export.CSV.zip';

  // Get the file and pipe it into our writeStream
  request(url, function(err, resp, body) {
    if(err) {
      that.handleError(err);
    }
    if(resp.statusCode !== 200) {
      return logger.warn('Gdelt.suck did not retrieve anything from ' + url + ' code:' + resp.statusCode);
      this.allFinished();
    }

    logger.info('Gdelt.suck retrieved ' + url + ' with code ' + resp.statusCode);
  }).pipe(file);

  // Once the file has finished writing we'll read it, unzip it, and parse the 
  // csv file in the extracted directory
  file.on('finish', function() {
    logger.info("Gdelt suck finished writing zip");
    file.close();
    file = null;

    that.processData(zipFilePath, null, null, today);
  });
};

/**
 * Unzip the file, find relevant records in the csv and stash those in a 
 * new file (so we can stream them - it's 10k+ records), read the new 
 * relevant records csv and transform each row. When we're done reading the 
 * relevant records file we let the main process know we're finished with 
 * this suck. 
 */

Gdelt.prototype.processData = function(zipFilePath, newFilePath, relevantOutputPath, today) {
  var that = this;

  that.unzipFile(zipFilePath, today).then(function(newFilePath) {
    that.findRelevantRecords(newFilePath, relevantOutputPath)
      .then(function(relevantFilePath) {
        logger.info('Gdelt.processData have relevant records');
        var relevantStream = fs.createReadStream(relevantFilePath);
        var lastTransformed;

        csv.fromStream(relevantStream, {delimiter: "\t"})
        .on("record", function(record){
          lastTransformed = that.transform(record);
        })
        .on("end", function(){
          logger.info('Gdelt.suck finished transforming relevant records');
          that.allFinished(lastTransformed);
        });
      });
  });

};

Gdelt.prototype.unzipFile = function(zipFilePath, today, newFilePath) {
  return new Promise(function(resolve, reject) {
    fs.createReadStream(zipFilePath)
    .pipe(unzip.Parse())
    .on('entry', function (entry) {
      logger.info("Gdelt.unzipFile We have an entry");
      var fileName = entry.path;
      
      // We only want to deal with the CSV - it should be the only thing in there
      if (fileName === today + ".export.CSV") {
        logger.info("Gdelt.unzipFile entry is a match")
        if(!newFilePath) {
          newFilePath = __dirname + '/data/gdelt/gdelt-latest.csv';
        }
        var newFile = fs.createWriteStream(newFilePath);
        entry.pipe(newFile);

        // Now that we've finished writing the extracted contents to another 
        // new file, let's read that and send each line to our transform method
        newFile.on('finish', function() {
          logger.info("Gdelt.unzipFile zip file extracted");
          resolve(newFilePath);
          newFile.close();
          newFile = null;
        });
      }
      else {
        entry.autodrain();
      }
    });
  });
};

Gdelt.prototype.findRelevantRecords = function(csvFilePath, outputPath, dateString) {
  var that = this;

  if(!dateString) {
    dateString = moment().subtract('days', 2).format('YYYY-MM-DD');
  }

  if(!outputPath) {
    outputPath = __dirname + '/data/gdelt/gdelt-latest-relevant.csv';
  }

  return new Promise(function(resolve, reject) {
    var stream = fs.createReadStream(csvFilePath);
    var outputStream = fs.createWriteStream(outputPath, {flags: 'a'});

    csv.fromStream(stream, {delimiter: "\t"})
    .on("record", function(record){
      recordObject = that.recordToObject(record);
      if(that.shouldTransform(recordObject, dateString)) {
        outputStream.write(record.join('\t') + '\n');
      }
    })
    .on("end", function(){
      logger.info('Gdelt.findRelevantRecords finished csv parsing');
      outputStream.close();
      outputStream = null;
      resolve(outputPath);
    });
  });
};

/**
 * GDELT data is like a SQL dump. Many columns in the CSVs are foreign key 
 * references to other tables. We're storing that additional GDELT information 
 * in JSON files on the local filesystem.
 */
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

  // Note the `.js` extension. This is due to a strange naming convention
  // GDELT uses for event description codes. The initial zero in many of the 
  // codes is removed by default when the object is interpreted as JSON.
  if(!this.eventDescriptions) {
    this.eventDescriptions = require(path + 'event-descriptions.js');
  }

  if(!this.religions) {
    this.religions = require(path + 'religions.json'); 
  }
};


/**
 * Just like how it sounds. Takes a row from the CSV and assigns each value 
 * to its corresponding header in an object. Just for convenience/readability. 
 */
Gdelt.prototype.recordToObject = function(record) {
  var data = {};

  if(_(this.columns).isEmpty()) {
    logger.warn("Gdelt.recordToObject no columns found");
  }

  _(this.columns).each(function(column, idx) {
    data[column] = record[idx];
  });

  return data;
};


/**
 * GDELT does quite a bit of categorization already, noting any relgions, 
 * known groups, ethnicities, etc mentioned in an event. We layer our own 
 * more generic categorization on top of that based on the event description. 
 */
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


/**
 * Each daily CSV contains information indexed on that day, not events that 
 * (necessarily) occurred on that day. We're only interested in recent information 
 * so we're removing old data, and records that are too generic. 
 */
Gdelt.prototype.shouldTransform = function(recordObject, dateString) {
  //logger.info("Gdelt.shouldTransform checking against " + dateString);
  if(!moment(recordObject.SQLDATE, 'YYYYMMDD').isSame(moment(dateString, 'YYYY-MM-DD'), 'day')) return false;
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

  var recordObject = that.recordToObject(record);

  var transformedRecordObject = {
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

    transformedRecordObject.geo.coords = point;
  }

  // Add fromURL if available
  if(!_(recordObject.SOURCEURL).isEmpty() && validator.isURL(recordObject.SOURCEURL)) {
    transformedRecordObject.fromURL = recordObject.SOURCEURL;
  }

  // No need to summarize this content, it's already short 
  transformedRecordObject.summary = transformedRecordObject.content; 

  // Set the initial tags
  transformedRecordObject.tags = that.determineTags(recordObject);

  this.returnData(transformedRecordObject);
  return transformedRecordObject;
};

module.exports = Gdelt;