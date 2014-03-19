var Sucka = require("./sucka")
  , logger = require("winston")
  , moment = require("moment")
  , csv = require("fast-csv")
  , _s = require("underscore.string")


var KenyaTraffic = function() {};
KenyaTraffic.prototype = Object.create(Sucka.prototype);


KenyaTraffic.prototype.suck = function() {
  var that = this;

  csv.fromPath(__dirname + "/data/kenya-traffic-incidents-2011.csv", {headers:true})
  .on("record", function(record){
      that.transform([record]);
      //console.log(data);
  });
};


/**
 * Transform a list of tweets to items matching the CrisisNET schema.
 */
KenyaTraffic.prototype.transform = function(inputData) {
  var outputData = inputData.map(function(record) {
    return {
      remoteID: record.Serial,
      publishedAt: new Date(moment(record['Date (YMD)'])),
      lifespan: "temporary",
      content: _s.titleize(record.Event.toLowerCase()) + ': ' + record['Description of Cause'],
      geo: {
        addressComponents: {
          adminArea1: 'Kenya',
          adminArea4: _s.titleize(record.County.toLowerCase()),
          adminArea5: _s.titleize(record.District.toLowerCase()), 
          neighborhood: _s.titleize(record.Division.toLowerCase())
        },
      },
      language: {
        code: 'en',
      },
      source: "kenya-traffic-incidents-2011",
      tags: [{name:"death"}, {name:"accident"}, {name:"road"}, {name:"injury"}]
    }
  });

  //that.handleError(error);
  this.allFinished(outputData);

  return outputData;
};

module.exports = KenyaTraffic;