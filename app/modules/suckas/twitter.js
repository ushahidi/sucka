var Sucka = require("./sucka")
  , Twit = require("twit")
  , config = require("config").twitter


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

  var stream = T.stream('statuses/filter', { track: that.source.searchTerms.join() });

  stream.on('tweet', function (tweet) {
    that.transform([tweet]);
  })
};


/**
 * Transform a list of tweets to items matching the CrisisNET schema.
 */
TwitterSucka.prototype.transform = function(inputData) {
  var outputData = inputData.map(function(tweet) {
    return {
      source: "twitter",
      author: {
        name: tweet.user.name,
        timezone: tweet.user.time_zone
      },
      content: tweet.text
    }
  });

  //that.handleError(error);
  this.allFinished(outputData);
};

module.exports = TwitterSucka;