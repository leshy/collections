// Generated by CoffeeScript 1.8.0
(function() {
  var Backbone, MemoryCollection, Select, Validator, async, helpers, v, _;

  Validator = require('validator2-extras');

  v = Validator.v;

  Select = Validator.Select;

  Backbone = require('backbone4000');

  helpers = require('helpers');

  _ = require('underscore');

  async = require('async');

  MemoryCollection = exports.MemoryCollection = Backbone.Model.extend4000({
    initialize: function() {
      this.idCnt = 1;
      return this.collection = {};
    },
    getId: function() {
      return String(this.idCnt++);
    },
    create: function(entry, callback) {
      var id;
      entry.id = id = this.getId();
      this.collection[id] = entry;
      return helpers.cbc(callback, null, entry);
    },
    find: function(pattern, limits, callbackData, callbackDone) {
      if (limits == null) {
        limits = {};
      }
      pattern = v(pattern);
      return async.eachSeries(_.values(this.collection), (function(entry, callback) {
        return pattern.feed(entry, function(err, data) {
          if (!err) {
            callbackData(void 0, data);
          }
          return callback();
        });
      }), function() {
        return helpers.cbc(callbackDone);
      });
    },
    findOne: function(pattern, callbackFound) {
      var values;
      console.log(':: findOne', pattern);
      pattern = v(pattern);
      values = _.values(this.collection);
      if (!values.length) {
        return callbackFound();
      }
      return async.eachSeries(values, (function(entry, callback) {
        return pattern.feed(entry, function(err, data) {
          if (!err) {
            helpers.cbc(callbackFound, void 0, data);
            return callback(true);
          }
          return callback();
        });
      }), function(err, data) {
        if (!err) {
          return callbackFound();
        }
      });
    },
    remove: function(pattern, callback) {
      console.log(':: remove', pattern);
      return this.find(pattern, {}, ((function(_this) {
        return function(err, data) {
          return delete _this.collection[data.id];
        };
      })(this)), function() {
        return callback();
      });
    },
    update: function(pattern, update, callback) {
      return console.log('update!', pattern, update);
    }
  });

}).call(this);
