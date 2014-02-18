var mongoose = require('mongoose')
  , validate = require('mongoose-validator').validate;

/**
 * A Source document represents a source of data.
 */
var sourceSchema = mongoose.Schema({
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: Date,
    /**
     * `sourceType` lets the application know how the incoming data will be 
     * retrieved and structured. Often times there will only be one source 
     * for a given source type - for example a one-off dataset kept in a 
     * spreadsheet. However with services like Twitter, that provide data 
     * on an ongoing basis, there may be many sources, each retrieving data 
     * in a specific way - for example tweets with a particular hashtag, or 
     * within a given geospatial boundry.
     */
    sourceType: {
      type: String,
      required: true,
      index: true
    },
    /**
     * Most sources will repeat, because they poll an endpoint periodically for 
     * new or updated data. However it is also possible to have sources that 
     * are "always" retrieved (streaming services like Twitter and Facebook), 
     * and sources that need to be retrieved only once.
     */
    frequency: {
      type: String,
      required: true,
      validate: validate('isIn', ['once', 'always', 'repeats'])
    },
    repeatsEvery: {
      type: String,
      required: false,
      validate: validate('isIn', ['minute', 'hour', 'day', 'week'])
    },
    hasRun: Boolean,
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    description: String,
    status: {
      type: String,
      required: true,
      default: 'active',
      index: true,
      validate: validate('isIn', ['active', 'failing', 'inactive'])
    },
    lastRun: Date
    //createdBy: User
});

sourceSchema.pre("save",function(next, done) {
    var self = this;
    self.updatedAt = Date.now();
    next();
});

var Source = mongoose.model('Source', sourceSchema);

module.exports = Source;