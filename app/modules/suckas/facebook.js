var Sucka = require("./sucka")
  , graph = require("fbgraph")
  , config = require("config").facebook
  , logger = require("winston")
  , moment = require("moment")
  , FB = require("fb")
  , Promise = require("promise");

/**
 * All retrieval/transformation objects are prototyped from the Sucka. This 
 * sucka understands how to interact with Facebook's Graph API.
 */
var FacebookSucka = function() {};
FacebookSucka.prototype = Object.create(Sucka.prototype);

/**
 * Connect to Facebook's Graph API and track using the search terms
 * provided by `this.source`.
 */
FacebookSucka.prototype.suck = function() {
  var that = this;

  that.getAccessToken()
    .then(function(token) {
      graph.setAccessToken(token);
      var searchOptions = {
          q:     that.source.filters.searchString
        , type:  "post"
      };

      if(that.source.lastRun) {
        searchOptions.since = moment(that.source.lastRun).unix();
      }

      graph.search(searchOptions, function(err, res) {
        that.transform(res.data); 
      });

    }, function(err) {
      that.handleError(err);
    }
  );
};


FacebookSucka.prototype.getAccessToken = function() {
  return new Promise(function(resolve, reject) {
    FB.api('oauth/access_token', {
        client_id: config.appID,
        client_secret: config.appSecret,
        grant_type: 'client_credentials'
      }, function (res) {
        
        if(!res || res.error) {
            return reject(res.error);
        }
        resolve(res.access_token);
    });
  }); 
};


/**
 * Transform a list of tweets to items matching the CrisisNET schema.
 */
FacebookSucka.prototype.transform = function(inputData) {
  var outputData = inputData.map(function(post) {
    return {
      remoteID: post.id,
      publishedAt: new Date(moment(post.created_time)),
      lifespan: "temporary",
      content: post.message || post.story,
      source: "facebook"
    }
  });

  //that.handleError(error);
  this.allFinished(outputData);

  return outputData;
};

module.exports = FacebookSucka;