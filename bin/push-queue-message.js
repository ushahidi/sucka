var config = require('config')
  , redis = require('redis')
  , RedisQueue = require("simple-redis-queue");

var argv = require('minimist')(process.argv.slice(2));

var makeRedisClient = function() {
  var redisClient = redis.createClient(config.queue.port, config.queue.host);
  redisClient.auth(config.queue.password);
  return redisClient;
};

var redisQueueClient = new RedisQueue(makeRedisClient());

var queueName = argv.queue || "suckjs";
redisQueueClient.push(queueName, JSON.stringify({id:argv.source}));

// As you can see, this is a utility for testing messages moving through the 
// queue. I wouldn't use this for anything but testing. 
setTimeout(function() {
  process.exit();
},1000);