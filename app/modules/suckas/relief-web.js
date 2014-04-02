var Sucka = require("./sucka")
  , logger = require("winston")
  , moment = require("moment")
  , _ = require("underscore");

var ReliefSucka = function() {};
ReliefSucka.prototype = Object.create(Sucka.prototype);

ReliefSucka.definition = {
  internalID: '883885b6-7baa-46c9-ad30-f4ccc0945674',
  sourceType: "reliefweb",
  frequency: "repeats",
  repeatsEvery: "day",
  startDate: moment('2014-03-30', 'YYYY-MM-DD'),
  endDate: moment('2014-04-01', 'YYYY-MM-DD')
};


ReliefSucka.prototype.suck = function() {
  var that = this;

  var T = new Twit({
    consumer_key: config.consumerKey,
    consumer_secret: config.consumerSecret,
    access_token: config.accessToken,
    access_token_secret: config.accessTokenSecret
  });
  /*
  var stream = T.stream('statuses/filter', { track: that.source.filters.text });

  stream.on('tweet', function (tweet) {
    that.transform([tweet]);
  })
  */
  var lastRetrieved;
  if(that.source.lastRetrieved) {
    lastRetrieved = that.source.lastRetrieved.remoteID;
  }
  var q = that.source.filters.searchString;

  if(lastRetrieved) {
    q = q + " since_id:" + lastRetrieved;
  }

  logger.info("sucka.Twitter searching for " + q);

  T.get('search/tweets', { 
      q: q, 
      count: 25 
    }, function(err, reply) {
      if (err) return that.handleError(err);
      that.transform(reply.statuses);
  });
};


/**
 * Transform a list of tweets to items matching the CrisisNET schema.
 */
ReliefSucka.prototype.transform = function(inputData) {
  var that = this;

  var outputData = inputData.map(function(tweet) {
    var returnData = {
      remoteID: tweet.id_str,
      publishedAt: new Date(moment(tweet.created_at)),
      lifespan: "temporary",
      content: tweet.text,
      geo: {
        locationIdentifiers: {
          authorTimeZone: tweet.user.time_zone,
          authorLocationName: tweet.user.location
        }
      },
      language: {
        code: tweet.lang,
      },
      source: "twitter"
    };

    if(tweet.coordinates) {
      returnData.geo.coords = tweet.coordinates.coordinates;
    }

    return returnData;

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