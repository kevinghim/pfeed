#!/usr/local/bin/node

var mongo = require("mongoskin");
var when = require("when");
var fs = require('fs');
var config = require("../config/config");
var RevMap = require("../refData/IAB").RevMap;
var MoreoverMap = require("../refData/moreover_to_IAB").MoreoverToIABMap;
var stopWords = require('../modules/StopWords').StopWords;

var dbHost = "locahost";
//var dbHost = "localhost";
var dbPort = 27017;
var dbName = "moreover";
var colName = "docs";
var host="cnn.com";
var pattern = process.argv[2] || /\/politics\//;
var category = process.argv[2] || "politics";

var db = mongo.db("mongodb://" + dbHost + ":" + dbPort + "/" + dbName, {native_parser:true, safe:true});
var collection;

var stats = {};
const kNotWordPattern = /[^a-zA-Z0-9 ]+/g;


function addToStats(key, cats) {
  if(!stats[key]) {
    stats[key] = {
      count: 0,
      cats: {},
    };
  }
  stats[key].count++;
  cats.forEach(function(cat) {
    stats[key].cats[cat] = (stats[key].cats[cat] || 0) + 1;
  });
};

function accumulate(url, title, topics) {
  // compute IAB cats
  var cats = {};
  topics.forEach(function(topic) {
    var cat = MoreoverMap[topic];
    if (cat && RevMap[cat]) {
      RevMap[cat].forEach(function(name) {
        cats[name] = true;
      });
    }
  });

  var catNames = Object.keys(cats);

  function outputTerms(text, suffix) {
    var terms = {};
    var lastTerm;
    text.toLowerCase().replace(kNotWordPattern, " ").split(/\s+/).forEach(function(term) {
      if (term.match(/[a-z]/) && !stopWords[term] && term.length > 2 && term.length < 20) {
        terms[term+suffix] = true;
        if (lastTerm) {
          terms[lastTerm+term+suffix] = true;
        }
        lastTerm = term;
      }
    });

    //console.log(url, title, JSON.stringify(Object.keys(terms)));
    Object.keys(terms).forEach(function(term) {
      console.log(term);
      catNames.forEach(function(cat) {
        console.log(term + ":" + cat);
      });
    });
  }

  if (catNames.length > 0) {
    outputTerms(url, "_U");
    outputTerms(title, "_T");
    outputTerms(url + " " + title, "_A");
    addToStats("_ANY", catNames);
  }
};

when.promise(function(resolve) {
  db.collection(colName, function(err, col) {
    if (err) throw err;
    collection = col;
    resolve();
  });
})
.then(function () {
  var cursor = collection.find({
    //"host": process.argv[2],
    "topics": {$exists: true}
  },
  {url: 1, title: 1, topics: 1, "_id": 0})
  .limit(process.argv[2] || 1000000000)
  ;
  cursor.each(function(err, results) {
    var array = [];
    var titles = {};
    var count = 0;
    if (results != null) {
      accumulate(results.url, results.title, results.topics)
    }
    else {
      fs.writeFile('cat.stats', JSON.stringify(stats));
      setTimeout(function() {db.close();});
    }
  });
})
