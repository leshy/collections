// Generated by CoffeeScript 1.9.3
(function() {
  var BSON, Backbone, MongoCollection, Select, Validator, _, helpers, v;

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
    create_: function(entry, callback) {
      entry = _.extend({}, entry);
      return this.collection.insert(entry, function(err, data) {
        if ((data != null ? data[0]._id : void 0)) {
          data = {
            id: String(data[0]._id)
          };
        }
        return helpers.cbc(callback, err, data);
      });
    },
    create: function(entry, callback) {
      entry = _.extend({}, entry);
      return this.collection.insert(entry, (function(_this) {
        return function(err, data) {
          data = _this.patternOut(_.first(data));
          return helpers.cbc(callback, err, data);
        };
      })(this));
    },
    patternIn: function(pattern) {
      var err, ref;
      pattern = _.extend({}, pattern);
      if (pattern.id != null) {
        pattern._id = pattern.id;
        delete pattern.id;
      }
      if (((ref = pattern._id) != null ? ref.constructor : void 0) === String) {
        try {
          pattern._id = new BSON.ObjectID(pattern._id);
        } catch (_error) {
          err = _error;
          console.log('cannot instantiate BSON ', pattern._id, err);
        }
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
      return this.collection.update(this.patternIn(pattern), update, callback);
    }
  });

}).call(this);
