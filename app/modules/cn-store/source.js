var mongoose = require('mongoose')
  , validate = require('mongoose-validator').validate;

/**
 * @todo Definition of source object - notes below
 */

var sourceSchema = mongoose.Schema({
    sourceType: {
      type: String,
      required: true
    },
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
      validate: validate('isIn', ['active', 'inactive'])
    }
    lastRun: Date
    //createdBy: User
});