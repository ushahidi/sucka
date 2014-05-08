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
    if (!error && response.statusCode === 200) {
      try {
        var body = JSON.parse(body);
      }
      catch(err) {
        bus.emit("error", source);
      }
      var records = arrToProp(source.listProperty.split('|'), body);
      _(records).each(function(record) {
        var transformed = sucka.transform(record, source);
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
  item.source = source.sourceType;
  item.createdAt = new Date();
  item.updatedAt = new Date();

  var assignVal = function(str, obj, val) {
    var depth = str.split("|")
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
      assignVal(depth.join('|'), obj[key], val);
    }
  };

  _(source.mapping).each(function(val, key) {
    assignVal(key, item, strToProp(val, doc));
  });

  _(source.statics).each(function(val, key) {
    assignVal(key, item, val);
  });

  if(!item.lifespan) {
    item.lifespan = "temporary";
  }

  if(!item.license) {
    item.license = "unknown";
  }

  if(item.publishedAt && !_(item.publishedAt).isDate()) {
    item.publishedAt = new Date(item.publishedAt);
  }

  item.tags = item.tags || [];
  item.tags = _(item.tags).map(function(tag) { 
    return {
      name: tag.name,
      confidence: 1.0
    }
  });

  return item;
};


var arrToProp = function(arr, obj) {
  return _(arr).reduce(function(memo, prop) { return memo[prop]; }, obj);
};

var strToProp = function(str, obj) {
  var arr = str.split('|');
  var key = arr.pop();

  try {
    var obj = arrToProp(arr, obj);
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