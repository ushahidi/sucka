/**
 * @todo Methods for index documents into the search datastore
 */

var validateStructure = function(data) {
  return true;
};

var indexData = function(source) { 
  return function(data) {
    if(!validateStructure(data)) return sourceBroken(source);

    // index data
    // if this is a polling event, then reschedule
  }
};