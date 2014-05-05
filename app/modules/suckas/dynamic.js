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
  request(source.sourceURL, function(error, response, body) {
    if (!error && response.statusCode == 200) {
      var records = strToProp(source.listProperty, body);
      _(records).each(function(record) {
        var transformed = sucka.transform(record);
        bus.emit("data", transformed);
      });

      bus.emit("sucked", source);
    }
    else {
      bus.emit("error", source);
    }
  });
};

sucka.transform = function(doc, source) {
  var item = {};

  var assignVal = function(str, obj, val) {
    var depth = str.split(".")
      , key = depth.shift();

    if(_(val).isArray() && depth.length === 1) {
      obj[key] = _(val).map(function(v) {
          var o = {};
          o[depth[0]] = v;
          return o;
        });
    }
    else if(depth.length === 0) {
      obj[key] = val;
    }
    else {
      obj[key] = obj[key] || {};
      assignVal(depth.join('.'), obj[key], val);
    }
  };

  _(source.mapping).each(function(val, key) {
    assignVal(key, item, strToProp(val, doc));
  });

  return item;
};

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

module.exports = sucka;