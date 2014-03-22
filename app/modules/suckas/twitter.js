var Sucka = require("./sucka")
  , Twit = require("twit")
  , config = require("config").twitter
  , logger = require("winston")
  , moment = require("moment")
  , _ = require("underscore");

/**
 * All retrieval/transformation objects are prototyped from the Sucka. This 
 * sucka understands how to interact with the Twitter streaming API.
 */
var TwitterSucka = function() {};
TwitterSucka.prototype = Object.create(Sucka.prototype);

TwitterSucka.definition = {
  internalID: '5f072dc8-4423-4652-86c4-4c59d5ea04e8',
  sourceType: "twitter",
  frequency: "repeats",
  repeatsEvery: "minute",
  startDate: moment('2014-03-19', 'YYYY-MM-DD'),
  endDate: moment('2014-03-20', 'YYYY-MM-DD'),
  filters: {
    searchString: 'traffic OR accident geocode:-1.292066,36.821946,15mi'
  }
};

/**
 * Connect to the Twitter's streaming API and track using the search terms
 * provided by `this.source`.
 */
TwitterSucka.prototype.suck = function() {
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
TwitterSucka.prototype.transform = function(inputData) {
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

module.exports = TwitterSucka;