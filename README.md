# Sucka

#### Sucking in the world's crisis data. Byte by byte. 

Sucka can retrieve information from any source and transform that data to the structure used through the CrisisNET system. One crisis API to rule them all. 

Each source has a corresponding `sucka` module that understands where the third-party data is, how to get it, and how that data is structured. This third-party source could be a public API (like Twitter), or a more "static" dataset, like a CSV of incident reports created by an NGO. 

## Writing your own sucka

Need a data source sucked? We can make that happen. Here's how to contribute your own `sucka` module. You'll need the following:

1. Node.js ([download instructions](http://nodejs.org/download/))
2. MongoDB ([download instructions](http://docs.mongodb.org/manual/installation/))
3. Git ([download/setup instructions](https://help.github.com/articles/set-up-git))

### For Experienced Node.js Developers

1. Clone this repo and install dependencies
2. Create a module that subclasses `Sucka` (see examples in `app/modules/suckas`)
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

Ok now you're ready to code. We'll start with a simple example of retrieving data from a CSV file. You can see the finished product in the `app/modules/suckas` directory in the [kenya-traffic-incidents-2011.js file](https://github.com/ushahidi/sucka/blob/master/app/modules/suckas/kenya-traffic-incidents-2011.js).

#### Step 1: Create a new file in the `app/modules/suckas` directory

If you'll be retrieving data from a flat file that isn't accessible over the Internet (like something you downloaded to your computer), put that file in the `app/modules/suckas/data` directory. We'll get back to that in a minute.

#### Step 2: Prototype the base `Sucka` module

Open up your new file. We're going to add some code. If you've done classical programming, you can think of this like a subclass. If you don't know what that means, just copy/paste.

    var Sucka = require("./sucka")
    , logger = require("winston")
    , moment = require("moment")
    , csv = require("fast-csv")
    , _s = require("underscore.string")


    var KenyaTraffic = function() {};
    KenyaTraffic.prototype = Object.create(Sucka.prototype);

First we tell our new module that we'll be referencing some other modules. We do that with the `require` statements at the top. The most important one right now is `Sucka`. Then we make an object and tell it to inherit all the capabilities of the base `Sucka` module. Sweet. Now let's suck some data.

#### Step 3: Suck some data

Every `sucka` must have a `suck` method. This defines the procedure for getting the data. In this case that just means pulling the data out of a file in the `data` directory, which is made wonderfully simple thanks to [fast-csv](https://github.com/C2FO/fast-csv). 

    KenyaTraffic.prototype.suck = function() {
      var that = this;

      csv(__dirname + "/data/kenya-traffic-incidents-2011.csv", {headers:true})
      .on("data", function(data){
          that.transform(data);
      })
      .parse();
    };

The `this` keyword in JavaScript can be confusing, but the `that = this` line just ensures that we have an easy reference to other `KenyaTraffic` methods. The important part of that we're calling `csv` (which we `require`d at the top of the file), and passing it the name of the file from which we'd like to get some data. As `csv` parses the file, it notifies us every time it has new data. So we "bind" a function to that event, and pass the data we receive to our `transform` method. In this case the parsed CSV data looks something like this...

    {
      Serial: "12345",
      County: "KIAMBU",
      District: "KIAMBU" 
      ...etc
    } 

#### Step 4: Transform that data

Now you assign values from your newly parsed CSV data to properties in the CrisisNET schema. Almost all data from `sucka` modules is saved as `Item` documents. *If you haven't made a `sucka` before, we strongly recommended you Check out the `Item` [definition](https://github.com/ushahidi/sucka/blob/master/app/modules/cn-store-js/item.js), or [some example JSON data](https://github.com/ushahidi/sucka/blob/master/test/data/twitter-formatted.json) for more details. Note that `//` in JavaScript is a single line comment. 

    KenyaTraffic.prototype.transform = function(inputData) {
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
      , KenyaTraffic = require('../app/modules/suckas/kenya-traffic-incidents-2011')
      , csv = require("fast-csv");

The most important is `KenyaTraffic` (ie the sucka we want to test). Now we'll add some boilerplate and setup the test.

    describe('kenya traffic sucka', function(){
        // ensure that we have an open connection to the test database
        beforeEach(function(done) {
          if (mongoose.connection.db) return done();

          mongoose.connect(config.dbURI, done);
        });

        it('should transform data to the correct format', function(){
          var kt = new KenyaTraffic();

          // We're only testing the transform method to make sure the Item it returns is 
          // properly formatted. So get the data, just like we did in the "suck" method.
          csv(__dirname + "/data/kenya-traffic-incidents-2011.csv", {headers:true})
          .on("data", function(data){

              // Pass the data to the trasform method
              var data = kt.transform(data);

              // Store the data as an Item document
              ktModel = new store.Item(data[0]);

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

And that's it. Experienced programmers should find this fairly straightforward. If you have less experience with JavaScript you should be able to get away mostly with copy/paste. However if you run into problems please contact us.

Once your tests pass we'll incorporate your `sucka` into the application. You can let us know you've finished with a "pull request". This is common practice for projects managed on GitHub. If you're not familiar with how this works, here are the steps.

1. Create a branch in your local repository. (eg `git checkout -b my-awesome-sucka`)
2. Push your branch to our repo on GitHub (eg `git push origin my-awesome-sucka`)
3. Go to GitHub and submit the pull request ([instructions here](https://help.github.com/articles/creating-a-pull-request)) 