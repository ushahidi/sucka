var logger = require("winston")
  , moment = require("moment")
  , _ = require("underscore")
  , _s = require("underscore.string")
  , request = require("request");

var sucka = {};
sucka.definition = {
  isDynamic: true
};

sucka.suck = function(source, bus) {
  // todo
};

sucka.transform = function(doc, source) {
  var item = {};

  var strToProp = function(str, obj) {
    var arr = str.split('.');
    var key = arr.pop();

    try {
      var obj = _(arr).reduce(function(memo, prop) { return memo[prop]; }, obj);
      if(_(obj).isArray()) {
        return _(obj).pluck(key);
      }
      else {
        return obj[key];
      }
    }
    catch(err) {
      return null;
    }
  };

  var assignVal = function(str, obj, val) {
    var depth = str.split(".")
      , key = depth.shift();

    if(depth.length === 0) {
      if(_(val).isArray()) {
        obj = _(val).map(function(v) {
            var o = {};
            o[key] = v;
            return o;
          });
      }
      else {
        obj[key] = val;
      }
      return;
    }
    else {
      obj[key] = obj[key] || {};
      assignVal(depth.join('.'), obj[key], val);
    }
  };

  _(source.mapping).each(function(val, key) {
    assignVal(key, item, strToProp(val, doc));
  });

  //console.log("HELLO", item);
  return item;
};

module.exports = sucka;