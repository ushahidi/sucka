var Sucka = require("./sucka")
  , Twit = require("twit")
  , config = require("config").twitter
  , logger = require("winston")
  , moment = require("moment")

/**
 * All retrieval/transformation objects are prototyped from the Sucka. This 
 * sucka understands how to interact with the Twitter streaming API.
 */
var TwitterSucka = function() {};
TwitterSucka.prototype = Object.create(Sucka.prototype);

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

  var lastRetrieved = that.source.lastRetrievedRemoteID;
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
  var outputData = inputData.map(function(tweet) {
    return {
      remoteID: tweet.id_str,
      publishedAt: new Date(moment(tweet.created_at)),
      lifespan: "temporary",
      content: tweet.text,
      geo: {
        coords: tweet.coordinates,
        locationIdentifiers: {
          authorTimeZone: tweet.user.time_zone,
          authorLocationName: tweet.user.location
        }
      },
      language: {
        code: tweet.lang,
      },
      source: "twitter"
    }
  });

  //that.handleError(error);
  this.allFinished(outputData);

  return outputData;
};

module.exports = TwitterSucka;