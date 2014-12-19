// Generated by CoffeeScript 1.8.0
(function() {
  var BSON, Backbone, MongoCollection, Select, Validator, helpers, v, _;

  BSON = require('mongodb').BSONPure;

  Validator = require('validator2-extras');

  v = Validator.v;

  Select = Validator.Select;

  Backbone = require('backbone4000');

  helpers = require('helpers');

  _ = require('underscore');

  MongoCollection = exports.MongoCollection = Backbone.Model.extend4000({
    validator: v({
      db: 'instance'
    }),
    initialize: function() {
      this.collection = this.get('collection') || this.get('name');
      if (this.collection.constructor === String) {
        this.get('db').collection(this.collection, (function(_this) {
          return function(err, collection) {
            return _this.set({
              collection: _this.collection = collection
            });
          };
        })(this));
      }
      if (!this.get('name')) {
        return this.set({
          name: this.collection.collectionName
        });
      }
    },
    create: function(entry, callback) {
      entry = _.extend({}, entry);
      return this.collection.insert(entry, function(err, data) {
        console.log('mongodb create', entry);
        if ((data != null ? data[0]._id : void 0)) {
          data = {
            id: String(data[0]._id)
          };
        }
        return callback(err, data);
      });
    },
    patternIn: function(pattern) {
      var _ref;
      pattern = _.extend({}, pattern);
      if (pattern.id != null) {
        pattern._id = pattern.id;
        delete pattern.id;
      }
      if (((_ref = pattern._id) != null ? _ref.constructor : void 0) === String) {
        pattern._id = new BSON.ObjectID(pattern._id);
      }
      return pattern;
    },
    patternOut: function(pattern) {
      if (!pattern) {
        return pattern;
      }
      pattern = _.extend({}, pattern);
      if (pattern._id != null) {
        pattern.id = String(pattern._id);
        delete pattern._id;
      }
      return pattern;
    },
    find: function(pattern, limits, callback, callbackDone) {
      return this.collection.find(this.patternIn(pattern), limits, (function(_this) {
        return function(err, cursor) {
          return cursor.each(function(err, entry) {
            if (!entry) {
              return callbackDone();
            }
            console.log('got model', _this.patternOut(entry));
            return callback(err, _this.patternOut(entry));
          });
        };
      })(this));
    },
    findOne: function(pattern, callback) {
      return this.collection.findOne(this.patternIn(pattern), (function(_this) {
        return function(err, entry) {
          return callback(void 0, _this.patternOut(entry));
        };
      })(this));
    },
    remove: function(pattern, callback) {
      return this.collection.remove(this.patternIn(pattern), helpers.cb(callback));
    },
    update: function(pattern, update, callback) {
      var set, unset;
      set = {};
      unset = {};
      _.map(update, function(value, key) {
        if (value === void 0 || null) {
          return unset[key] = true;
        } else {
          return set[key] = value;
        }
      });
      update = {};
      if (!helpers.isEmpty(set)) {
        update['$set'] = set;
      }
      if (!helpers.isEmpty(unset)) {
        update['$unset'] = unset;
      }
      console.log('mongodb update', this.patternIn(pattern), update);
      return this.collection.update(this.patternIn(pattern), update, callback);
    }
  });

}).call(this);
