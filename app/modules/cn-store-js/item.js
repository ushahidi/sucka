var mongoose = require('mongoose')
  , validator = require('mongoose-validator')
  , validate = validator.validate
  , Promise = require('promise')
  , _ = require('underscore')
  , _s = require('underscore.string')
  , allowedTags = require('./allowed-tags')
  , languageCodes = require('./language-codes');


/**
 * Inside validator functions we have access to `this.str`. It's not always
 * clear what this will be, so you're advised to check for yourself with a 
 * handful of values (arrays, objects, etc).
 * 
 * The `isLanguage` validate verifies that the user has given us an ISO code 
 * that exists in the language codes known to our system. 
 */
validator.extend('isLanguage', function () {
    return _(_(languageCodes).pluck("code")).contains(this.str);
});

/**
 * The `containsTags` validator ensures that the tags provided by the user are 
 * all in the list of tags allowed by the system. 
 */
validator.extend('containsTags', function() {
    var tags = this.str.split(",");
    if(_.isEmpty(tags) || tags[0] === "") return true;
    return _.difference(tags, allowedTags).length === 0;
});

/**
 * An Item document represents a piece of data specific to a location. This can 
 * be either more ephemeral data, like a tweet or incident report, or more 
 * permanent, like the location of a police station or shelter.
 */
var itemSchema = mongoose.Schema({
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: Date,
    /*
     * The date/time at which this document was published at its original 
     * source. 
     */
    publishedAt: Date,
    /**
     * This is either provided explictly by the data source (like a tweet id), 
     * or must be generated by CrisisNET based on the third-party content. It 
     * ensures that we will recognize when we see the same data a second time, 
     * and can either discard or update our record, whichever is appropriate. 
     */
    remoteID: {
      type: String,
      required: true
    },
    /**
     * Optional field indicating how long this item should be considered 
     * active.
     */
    activeUntil: Date,
    /**
     * Serves as a way to filter incoming data into buckets that are most useful 
     * for API consumers. Temporary data sources might be tweets or Facebook 
     * updates, while semi-permanent might be the location of relief shelters 
     * or open grocery stores, and permanent would be the location of a 
     * permanent physical structure, like a police station.
     */
    lifespan: {
      type: String,
      required: true,
      validate: validate('isIn', ['temporary', 'semi-permanent', 'permanent']),
      default: 'temporary'
    },
    content: String,
    summary: String,
    /**
     * Fully-formed URL to publically available image.
     */
    image: {
      type: String,
      validate: validate('isUrl')
    },
    geo: {
      /**
       * This is assuming that we'll extract all of the named places from the 
       * content and/or source document. 
       */
      namedPlaces: Array,
      /**
       * Note that coordinates should always been longitude, latitude
       */
      coordinates: Array,
      /**
       * How accurate are the coordinates? Defined as radius, in meters.
       */
      accuracy: Number,
      granularity: {
        type: String,
        validate: validate('isIn', ['point', 'neighborhood', 'city', 'admin', 'country'])
      },
      locationIdentifiers: {
        authorLocationName: String,
        authorTimeZone: String
      }
    },
    /**
     * This is a flat tagging system to categorize item data. CrisisNET maintains
     * the list of allowed tags. 
     */
    tags: {
      type: Array,
      validate: validate('containsTags'), 
      index: true
    },
    /**
     * [ISO code](http://stackoverflow.com/a/20623472/2367526) of the primary 
     * language of the content. 
     */
    language: {
      code: {
        type: String,
        validate: validate('isLanguage')
      },
      name: String,
      nativeName: String
    },
    /**
     * Reference to the Source document that led to this item being retrieved.
     */
    source: String,
    license: {
      type: String,
      required: true,
      default: 'unknown',
      validate: validate('isIn', ['odbl', 'commercial', 'unknown'])
    }
});

itemSchema.pre("save",function(next, done) {
    var self = this;

    // Note timestamp of update
    self.updatedAt = Date.now();

    // If this is provided, we assume it to be the third-party publish date.
    self.publishedAt = self.publishedAt || self.createdAt;

    // Create a summary, unless whoever did the transforming beat us
    // to it. 
    self.summary = self.summary || _s.prune(self.content, 100);

    // Grab the entire language object for the provided code, assuming a code
    // was provided.
    if(!_(self.language).isEmpty() && self.language.code) {
      self.language = _(languageCodes).findWhere({code: self.language.code});
    }
    // Don't let any old crap in here. If we didn't get an ISO code, then 
    // there's nothing more to say. 
    else {
      self.language = null;
    }


    next();
});


/**
 * Wrapper for `Item.save` that returns a `Promise` object. This is preferred 
 * over simply called `save` and supplying a callback
 */
itemSchema.methods.saveP = function() {
  var that = this;
  return new Promise(function(resolve, reject) {
    that.save(function(err, item) {
      if(err) return reject(err);

      resolve(item);
    })
  });
};


/**
 * Take an array of objects that conform to Item schema. Generate a list of 
 * promises, and return the promise object that results from calling `Promise.all` 
 * on the list. This allows the caller to assign a single function to be executed 
 * when all models or saved or an error occurs. 
 *
 * If the save is successful the caller will receive a list of saved model
 * instances.
 *
 * @param {Array} data - List of objects that conform to Item schema
 */
itemSchema.statics.saveList = function(data) {
  var that = this;
  // Create a list of promises. 
  var funcs = _(data).map(function(item) { 
    return (new that(item)).saveP();
  });

  return Promise.all(funcs);
};

itemSchema.index({ "geo.coordinates": "2d" });

var Item = mongoose.model('Item', itemSchema);

module.exports = Item;