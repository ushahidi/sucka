# Sucka

#### Sucking in the world's crisis data. Byte by byte. 

Sucka can retrieve information from any source and transform that data to the structure used through the CrisisNET system. One crisis API to rule them all. 

Each source has a corresponding `sucka` module that understands where the third-party data is, how to get it, and how that data is structured. This third-party source could be a public API (like Twitter), or a more "static" dataset, like a CSV of incident reports created by an NGO. 

## Writing your own sucka

Need a data source sucked? We can make that happen. Here's how to contribute your own `sucka` module. (Note that if you're more comfortable in Python, [here's a separate set of instructions](https://github.com/ushahidi/suckapy).)

### Down n' Dirty

First download Node.js ([download instructions](http://nodejs.org/download/)), then create a Node module that exports an object with a `suck` method. Your `suck` method should accept two arguments, the `source` document (a `Mongoose` model) and an event bus (more on this in a second).

    var mySucka = {};
    mySucka.suck = function(source, bus) {
      // get some data
      // transform the data
      // for each transformed item
      // bus.emit('data', item)
    };

Once you're confident your `suck` method retrieves the data you want, and transforms that data into `Item` objects, try it out from the command line. *If you haven't made a `sucka` before, we strongly recommended you check out the `Item` [definition](https://github.com/ushahidi/sucka/blob/master/app/modules/cn-store-js/item.js), or [some example JSON data](https://github.com/ushahidi/sucka/blob/master/test/data/twitter-formatted.json) for more details.

    $ node
    $ var myBus = new EventEmitter();
    $ bus.on("data", function(item) { console.log(item); });
    $ var mySucka = require("/path/to/your/sucka");
    $ mySucka.suck({}, bus);

If your `sucka` sucks like it is supposed to, you should see `Item` objects logged to the console. 

Last but not least define how often you'd like your `sucka` to run, when it should start, end, etc. We also recommend you add a description so other CrisisNET users know what type of data to expect from this source. 

    mySucka.definition = {
      internalID: '883885b6-7baa-46c9-ad30-f4ccc0945674',
      sourceType: "reliefweb",
      frequency: "repeats",
      repeatsEvery: "day",
      startDate: moment('2014-03-30', 'YYYY-MM-DD'),
      endDate: moment('2015-04-05', 'YYYY-MM-DD'),
      description: "Historical and recent natural disaster reports from ReliefWeb's public API."
    };

Note the `internalID`. This needs to be unique. You can generate your own [at this handy website](http://uuidgenerator.net/).

Once everything is working, clone this project, add your module to the `app/modules/suckas` directory and [make a pull request](https://help.github.com/articles/creating-a-pull-request). We'll take a look at your `sucka` and, if everything seems alright, we'll add it to the platform. 


### If You're Serious

You'll need the following:

1. Node.js ([download instructions](http://nodejs.org/download/))
2. MongoDB ([download instructions](http://docs.mongodb.org/manual/installation/))
3. ElasticSearch ([download link](http://www.elasticsearch.org/overview/elkdownloads/))
3. Git ([download/setup instructions](https://help.github.com/articles/set-up-git))

### For Experienced Node.js Developers

1. Clone this repo and install dependencies
2. Create a module with a `description` property and `suck` method (see examples in `app/modules/suckas`)
3. Add a test to the `test` directory (run tests with `npm run-script run-test`)
4. Create a new branch for your feature and make a pull request

### For Everyone Else 

Word to the wise: if you are totally unfamiliar with Node.js, there's a bit of a learning curve, but plenty of examples. Once you have everything downloaded...

Open your terminal/command line app and change into whatever directory you'd like to house this project. For example:

    cd /projects/saving-the-world-with-data

Then clone this repository using git.

    git clone https://github.com/ushahidi/sucka.git

That should create a "sucka" directory. Change into that new directory.

    cd sucka

Once that's finished, you'll need to install the project dependencies. This is easy with Node's package manager, called `npm`.

    npm install

Ok now you're ready to code. We'll start with a simple example of retrieving data from a CSV file. You can see the finished product in the `app/modules/suckas` directory in the [reliefweb.js file](https://github.com/ushahidi/sucka/blob/master/app/modules/suckas/reliefweb.js).

#### Step 1: Create a new file in the `app/modules/suckas` directory

If you'll be retrieving data from a flat file that isn't accessible over the Internet (like something you downloaded to your computer), put that file in the `app/modules/suckas/data` directory. We'll get back to that in a minute.

#### Step 2: Tell the system how often we want this sucka to, erm, suck.
    var mySucka = {};
    mySucka.definition = {
      internalID: '5f072dc8-4423-4652-86c4-4c59d5ea04e8',
      sourceType: "kenya-traffic-2011",
      frequency: "repeats",
      repeatsEvery: "hour",
      startDate: moment('2014-03-20', 'YYYY-MM-DD'),
      endDate: moment('2014-03-21', 'YYYY-MM-DD')
    };

There are a couple things to note here. First is the `internalID`. This is a "Universally Unique ID" (UUID). You can generate your own [at this handy website](http://uuidgenerator.net/), or open up the terminal and do this your favorite programming language. For instance, in Python:

    import uuid
    uuid.uuid4()

And presto.

The `sourceType` is a little tricky. If you're working with a static dataset (like a csv of traffic data from a specific year in Kenya, just for example), this will probably be very specific. If you're working with a more generic data source, like Twitter, this will be one of many `sucka` modules for that source. 

Your `frequency` is either "repeats" or "once" - that's it. Repeating sources can repeat as often as you like - "minute", "day", "hour", "week", etc.

I'm using the excellent [moment.js](http://momentjs.com/) library to set my `startDate` and `endDate`, but any 'ol `Date` object will do.

If you're curious, whenever the `sucka` app process restarts, it checks for new `sucka` modules, and any new ones are added to the database before being fed into the scheduling engine for execution.

#### Step 3: Suck some data

Every `sucka` must have a `suck` method. This defines the procedure for getting the data. In this case that just means pulling the data out of a file in the `data` directory, which is made wonderfully simple thanks to [fast-csv](https://github.com/C2FO/fast-csv). 

    mySucka.suck = function(source, bus) {
      csv(__dirname + "/data/kenya-traffic-incidents-2011.csv", {headers:true})
      .on("data", function(data){
          var item = transform(data);
          bus.emit("data", item);
      })
      .parse();
    };

As `csv` parses the file, it notifies us every time it has new data. So we "bind" a function to that event, and pass the data we receive to our `transform` method. In this case the parsed CSV data looks something like this...

    {
      Serial: "12345",
      County: "KIAMBU",
      District: "KIAMBU" 
      ...etc
    } 

#### Step 4: Transform that data

Now you assign values from your newly parsed CSV data to properties in the CrisisNET schema. Almost all data from `sucka` modules is saved as `Item` documents. *If you haven't made a `sucka` before, we strongly recommended you Check out the `Item` [definition](https://github.com/ushahidi/sucka/blob/master/app/modules/cn-store-js/item.js), or [some example JSON data](https://github.com/ushahidi/sucka/blob/master/test/data/twitter-formatted.json) for more details. Note that `//` in JavaScript is a single line comment. 

    mySucka.transform = function(inputData) {
      var outputData = {
        // The remoteID should be unique. This helps the system recognize updates
        // to existing data. Usually the data you're working with provide a unique 
        // identifier for each item. 
        remoteID: record.Serial,
        publishedAt: new Date(moment(record['Date (YMD)'])),
        // How long is this relevant? Is it the location of a building or other
        // permanent structure, or an event/announcement/etc?
        lifespan: "temporary",
        // Here we're using the very handy underscore.string library to format 
        // the incoming content. This isn't required. 
        content: _s.titleize(record.Event.toLowerCase()) + ': ' + record['Description of Cause'],
        geo: {
          addressComponents: {
            // Country
            adminArea1: 'Kenya',
            // County
            adminArea4: _s.titleize(record.County.toLowerCase()),
            // City
            adminArea5: _s.titleize(record.District.toLowerCase()), 
            neighborhood: _s.titleize(record.Division.toLowerCase())
          },
        },
        // We use ISO 639-1 language codes (the two-letter ones). Here's the list: 
        // http://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
        language: {
          code: 'en',
        },
        // The source is the name of your file without the .js at the end
        source: "kenya-traffic-incidents-2011",
        // How would you categorize content from this source?
        tags: ["death", "accident", "road", "injury"]
      };

      // Now that your data is transformed call the `allFinished` method. Becuase
      // you're all finished.
      this.allFinished(outputData);

      // Please do this.
      return outputData;
    };

#### Step 5: Test that sucka

It's important to make sure your sucka does what you think it does. Create a file for your sucka in the `test` directory, and copy your CSV to the `test/data` directory. 

First include the required modules:

    var chai = require('chai');
    chai.should();
    var config = require('config')
      , _ = require("underscore")
      , expect = chai.expect
      , assert = chai.assert
      , mongoose = require('mongoose')
      , clearDB  = require('mocha-mongoose')(config.dbURI)
      , store = require('../app/modules/cn-store-js')
      , kt = require('../app/modules/suckas/kenya-traffic-incidents-2011')
      , csv = require("fast-csv");

The most important is `KenyaTraffic` (ie the sucka we want to test). Now we'll add some boilerplate and setup the test.

    describe('kenya traffic sucka', function(){
        // ensure that we have an open connection to the test database
        beforeEach(function(done) {
          if (mongoose.connection.db) return done();

          mongoose.connect(config.dbURI, done);
        });

        it('should transform data to the correct format', function(){

          // We're only testing the transform method to make sure the Item it returns is 
          // properly formatted. So get the data, just like we did in the "suck" method.
          csv(__dirname + "/data/kenya-traffic-incidents-2011.csv", {headers:true})
          .on("data", function(data){

              // Pass the data to the trasform method
              var data = kt.transform(data);

              // Store the data as an Item document
              ktModel = new store.Item(data);

              // Save the Item document, and verify that the saved document has the properties 
              // that you would expect.
              ktModel.save(function(err, item) {
                assert.isNull(err);
                assert(item.lifespan === "temporary");
                assert(item.content.length > 0);
                assert(item.source === "kenya-traffic-incidents-2011");
              });
          })
          .parse();

        });
    })

If you're not familiar with the `assert` statement from JavaScript or other languages, it asserts equality (pretty much what you would expect). If you assert that something is true when it isn't the test will fail, and you know that something about your `sucka` isn't correct. 

From your projects main directory, run this from the command line.

    npm run-script run-test 

If your test fails, then something is wrong with your `sucka`. Fix it and run the test again.

Experienced programmers should find this fairly straightforward. If you have less experience with JavaScript you should be able to get away mostly with copy/paste. However if you run into problems please contact us.

Once your tests pass we'll incorporate your `sucka` into the application. You can let us know you've finished with a "pull request". This is common practice for projects managed on GitHub. If you're not familiar with how this works, here are the steps.

1. Create a branch in your local repository. (eg `git checkout -b my-awesome-sucka`)
2. Push your branch to our repo on GitHub (eg `git push origin my-awesome-sucka`)
3. Go to GitHub and submit the pull request ([instructions here](https://help.github.com/articles/creating-a-pull-request)) 