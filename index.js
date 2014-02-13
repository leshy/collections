// Generated by CoffeeScript 1.4.0
(function() {
  var Backbone, ModelMixin, ReferenceMixin, RemoteModel, UnresolvedRemoteModel, helpers, _,
    __slice = [].slice;

  Backbone = require('backbone4000');

  _ = require('underscore');

  helpers = require('helpers');

  _.extend(exports, require('./remotemodel'));

  RemoteModel = exports.RemoteModel;

  ModelMixin = exports.ModelMixin = Backbone.Model.extend4000({
    initialize: function() {
      return this.models = {};
    },
    defineModel: function() {
      var definition, name, superclasses, _i;
      name = arguments[0], superclasses = 3 <= arguments.length ? __slice.call(arguments, 1, _i = arguments.length - 1) : (_i = 1, []), definition = arguments[_i++];
      if (!(definition.defaults != null)) {
        definition.defaults = {};
      }
      definition.defaults.collection = this;
      definition.defaults._t = name;
      return this.models[name] = RemoteModel.extend4000.apply(RemoteModel, superclasses.concat(definition));
    },
    resolveModel: function(entry) {
      var keys, tmp;
      keys = _.keys(this.models);
      if (keys.length === 0) {
        throw "I don't have any models defined";
      }
      if (keys.length === 1 || !(entry._t != null)) {
        return this.models[_.first(keys)];
      }
      if (entry._t && (tmp = this.models[entry._t])) {
        return tmp;
      }
      return Backbone.Model;
    },
    findModels: function(pattern, limits, callback, callbackend) {
      var _this = this;
      return this.find(pattern, limits, (function(err, entry) {
        if (!(entry != null)) {
          return callback(err);
        } else {
          return callback(err, new (_this.resolveModel(entry))(entry));
        }
      }), callbackend);
    },
    findModel: function(pattern, callback) {
      var _this = this;
      return this.findOne(pattern, function(err, entry) {
        if (!(entry != null) || err) {
          return callback(err);
        } else {
          return callback(err, new (_this.resolveModel(entry))(entry));
        }
      });
    },
    fcall: function(name, args, pattern, realm, callback) {
      return this.findModel(pattern, function(err, model) {
        if (model != null) {
          return model.remoteCallReceive(name, args, realm, function(err, data) {
            return callback(err, data);
          });
        } else {
          return callback('model not found');
        }
      });
    }
  });

  exports.collectionDict = {};

  UnresolvedRemoteModel = exports.UnresolvedRemoteModel = Backbone.Model.extend4000({
    collection: void 0,
    id: void 0,
    toString: function() {
      return 'unresolved model ' + this.get('id') + ' of collection ' + this.get('collection').name();
    },
    resolve: function(callback) {
      var collection,
        _this = this;
      collection = this.get('collection');
      return collection.findOne({
        id: this.get('id')
      }, function(err, entry) {
        if (!entry) {
          return callback('unable to resolve reference to ' + _this.get('id') + ' at ' + collection.get('name'));
        } else {
          _this.morph(collection.resolveModel(entry), _.extend(_this.attributes, entry));
          return helpers.cbc(callback, void 0, _this);
        }
      });
    },
    morph: function(myclass, mydata) {
      this.__proto__ = myclass.prototype;
      this.set(mydata);
      return this.initialize();
    },
    del: function(callback) {
      return this.trigger('del', this);
    },
    remove: function(callback) {
      var id;
      this.del();
      if (id = this.get('id')) {
        return this.collection.remove({
          id: id
        }, helpers.cb(callback));
      } else {
        return helpers.cbc(callback);
      }
    },
    reference: function() {
      return {
        _r: this.get('id'),
        _c: this.get('collection').name()
      };
    }
  });

  ReferenceMixin = exports.ReferenceMixin = Backbone.Model.extend4000({
    initialize: function() {
      var _this = this;
      this.collectionDict = exports.collectionDict;
      return this.when('name', function(name) {
        return _this.collectionDict[name] = _this;
      });
    },
    getcollection: function(name) {
      return this.collectionDict[name];
    },
    unresolved: function(id) {
      return new UnresolvedRemoteModel({
        id: id,
        collection: this
      });
    },
    name: function() {
      return this.get('name');
    }
  });

}).call(this);
