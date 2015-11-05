// Generated by CoffeeScript 1.9.3
(function() {
  var Backbone, CachingMixin, Core, EventMixin, LiveModelMixin, LiveRemoteModel, ModelMixin, ReferenceMixin, RemoteModel, RequestIdMixin, UnresolvedRemoteModel, _, helpers, settings, sman, subscriptionman2,
    slice = [].slice;

  Backbone = require('backbone4000');

  _ = require('underscore');

  helpers = require('helpers');

  _.extend(exports, require('./remotemodel'));

  RemoteModel = exports.RemoteModel;

  subscriptionman2 = require('subscriptionman2');

  settings = exports.settings = {};

  settings.model = {};

  sman = subscriptionman2.Core.extend4000(subscriptionman2.asyncCallbackReturnMixin, subscriptionman2.simplestMatcher);

  Core = exports.Core = Backbone.Model.extend4000({
    initialize: function() {
      return this.settings = _.extend({}, settings, this.settings, this.get('settings'));
    }
  });

  ModelMixin = exports.ModelMixin = sman.extend4000({
    initialize: function() {
      return this.models = {};
    },
    defineModel: function() {
      var coreModelClass, definition, i, name, superclasses;
      name = arguments[0], superclasses = 3 <= arguments.length ? slice.call(arguments, 1, i = arguments.length - 1) : (i = 1, []), definition = arguments[i++];
      if (definition.defaults == null) {
        definition.defaults = {};
      }
      definition.defaults.collection = this;
      definition.defaults._t = name;
      coreModelClass = this.modelClass || RemoteModel;
      return this.models[name] = coreModelClass.extend4000.apply(coreModelClass, superclasses.concat(definition));
    },
    resolveModel: function(entry) {
      var keys, tmp;
      keys = _.keys(this.models);
      if (keys.length === 0) {
        throw "I don't have any models defined";
      }
      if (keys.length === 1 || (entry._t == null)) {
        return this.models[_.first(keys)];
      }
      if (entry._t && (tmp = this.models[entry._t])) {
        return tmp;
      }
      throw "unable to resolve " + JSON.stringify(entry) + " " + _.keys(this.models).join(", ");
    },
    modelFromData: function(entry) {
      return new (this.resolveModel(entry))(entry);
    },
    removeModel: function(pattern, realm, callback) {
      var queue;
      queue = new helpers.queue({
        size: 3
      });
      return this.findModels(pattern, {}, (function(err, model) {
        return queue.push(model.id, function(callback) {
          return model.remove(callback);
        });
      }), (function(err, data) {
        return queue.done(callback);
      }));
    },
    findModels: function(pattern, limits, callback, callbackDone) {
      return this.find(pattern, limits, (function(_this) {
        return function(err, entry) {
          if (err) {
            return callback(err);
          } else {
            return callback(err, _this.modelFromData(entry));
          }
        };
      })(this), callbackDone);
    },
    findModel: function(pattern, callback) {
      return this.findOne(pattern, (function(_this) {
        return function(err, entry) {
          if (!entry || err) {
            return callback(err);
          } else {
            return callback(err, _this.modelFromData(entry));
          }
        };
      })(this));
    },
    fcall: function(name, args, pattern, realm, callback, callbackMulti) {
      return this.findModel(pattern, function(err, model) {
        if (model) {
          return model.remoteCallReceive(name, args, realm, callback, callbackMulti);
        } else {
          return callback('model not found');
        }
      });
    }
  });

  EventMixin = exports.EventMixin = Backbone.Model.extend4000({
    create: function(data, callback) {
      return this.eventAsync('create', data, (function(_this) {
        return function(err, subchanges) {
          if (subchanges == null) {
            subchanges = {};
          }
          if (err) {
            return h.cbc(callback, err);
          }
          subchanges = _.reduce(subchanges, (function(all, data) {
            return _.extend(all, data);
          }), {});
          if (data.id) {
            return helpers.cbc(callback, "can't specify id for new model");
          }
          return _this._super('create', _.extend(data, subchanges), function(err, data) {
            return helpers.cbc(callback, err, data);
          });
        };
      })(this));
    }
  });

  exports.collectionDict = {};

  UnresolvedRemoteModel = exports.UnresolvedRemoteModel = Backbone.Model.extend4000({
    toString: function() {
      return "unresolved model " + this.id + " of collection " + (this.collection.name());
    },
    initialize: function() {
      this.when('id', (function(_this) {
        return function(id) {
          return _this.id = id;
        };
      })(this));
      return this.when('collection', (function(_this) {
        return function(collection) {
          _this.collection = collection;
          return _this.unset('collection');
        };
      })(this));
    },
    resolve: function(callback) {
      return this.collection.findOne({
        id: this.get('id')
      }, (function(_this) {
        return function(err, entry) {
          if (!entry) {
            return callback('unable to resolve reference to ' + _this.get('id') + ' at ' + _this.collection.get('name'));
          } else {
            _this.morph(_this.collection.resolveModel(entry), _.extend(_this.attributes, entry));
            _this.trigger('resolve');
            return helpers.cbc(callback, void 0, _this);
          }
        };
      })(this));
    },
    find: function(callback) {
      return this.collection.findModel({
        id: this.get('id')
      }, callback);
    },
    morph: function(myclass, mydata) {
      this.__proto__ = myclass.prototype;
      _.extend(this.attributes, mydata);
      return this.initialize();
    },
    del: function(callback) {
      return this.trigger('del', this);
    },
    remove: function(callback) {
      this.del();
      if (this.id) {
        return this.collection.remove({
          id: id
        }, helpers.cb(callback));
      } else {
        return helpers.cbc(callback);
      }
    },
    reference: function() {
      var ref;
      ref = _.extend({}, this.attributes);
      ref._r = ref.id;
      delete ref.id;
      ref._c = this.collection.name();
      delete ref.collection;
      return ref;
    }
  });

  ReferenceMixin = exports.ReferenceMixin = Backbone.Model.extend4000({
    initialize: function() {
      this.collectionDict = exports.collectionDict;
      return this.when('name', (function(_this) {
        return function(name) {
          return _this.collectionDict[name] = _this;
        };
      })(this));
    },
    getcollection: function(name) {
      return this.collectionDict[name];
    },
    find: function(args, limits, callback, callbackDone) {
      return RemoteModel.prototype.exportReferences.call(RemoteModel.prototype, args, (function(_this) {
        return function(err, args) {
          if (err) {
            return callbackDone(err);
          }
          return _this._super('find', args, limits, callback, callbackDone);
        };
      })(this));
    },
    findOne: function(args, callback) {
      return RemoteModel.prototype.exportReferences.call(RemoteModel.prototype, args, (function(_this) {
        return function(err, args) {
          if (err) {
            return callbackDone(err);
          }
          return _this._super('findOne', args, callback);
        };
      })(this));
    },
    unresolved: function(data) {
      if (!data.id && data._r) {
        data.id = data._r;
        delete data._r;
      }
      delete data._c;
      return new UnresolvedRemoteModel(_.extend(data, {
        collection: this
      }));
    },
    name: function() {
      return this.get('name');
    }
  });

  RequestIdMixin = exports.RequestIdMixin = Backbone.Model.extend4000({
    find: function(args, limits, callback, callbackDone) {
      var uuid;
      uuid = JSON.stringify({
        name: this.name(),
        args: args,
        limits: limits
      });
      return this._super('find', args, limits, (function(_this) {
        return function(err, data) {
          return callback(err, data, uuid);
        };
      })(this), (function(_this) {
        return function() {
          return helpers.cbc(callbackDone, void 0, void 0, uuid);
        };
      })(this));
    },
    findOne: function(args, callback) {
      var cb;
      cb = (function(_this) {
        return function(err, data) {
          return callback(err, data, JSON.stringify({
            name: _this.name(),
            args: args
          }));
        };
      })(this);
      return this._super('findOne', args, cb);
    }
  });

  CachingMixin = exports.CachingMixin = Backbone.Model.extend4000({
    timeout: helpers.Minute,
    initialize: function() {
      this.cache = {};
      return this.timeouts = {};
    },
    addToCache: function(uuid, result, timeout) {
      var name;
      if (!timeout) {
        timeout = this.timeout;
      }
      this.cache[uuid] = result;
      name = new Date().getTime();
      this.timeouts[name] = helpers.wait(timeout, (function(_this) {
        return function() {
          if (_this.timeouts[name]) {
            delete _this.timeouts[name];
          }
          if (_this.cache[uuid]) {
            return delete _this.cache[uuid];
          }
        };
      })(this));
      return result;
    },
    clearCache: function() {
      _.map(this.timeouts, function(f, name) {
        return f();
      });
      this.timeouts = {};
      return this.cache = {};
    },
    findOne: function(args, callback) {
      var loadCache, uuid;
      uuid = JSON.stringify({
        name: this.name(),
        args: args
      });
      if (loadCache = this.cache[uuid]) {
        callback(void 0, loadCache, uuid);
        return uuid;
      }
      this._super('findOne', args, (function(_this) {
        return function(err, data, uuid) {
          var reqCache;
          reqCache = _this.addToCache(uuid, data);
          return callback(err, data, uuid, reqCache);
        };
      })(this));
      return uuid;
    },
    find: function(args, limits, callback, callbackDone) {
      var cache, fail, loadCache, uuid;
      if (limits.nocache) {
        return this._super('find', args, limits, callback);
      }
      uuid = JSON.stringify({
        name: this.name(),
        args: args,
        limits: limits
      });
      if (loadCache = this.cache[uuid]) {
        _.map(loadCache, function(data) {
          return callback(void 0, data, uuid);
        });
        helpers.cbc(callbackDone, void 0, void 0, uuid, loadCache);
        return uuid;
      }
      cache = [];
      fail = false;
      this._super('find', args, limits, (function(_this) {
        return function(err, data, uuid) {
          if (!fail) {
            if (err) {
              fail = true;
            } else {
              cache.push(data);
            }
          }
          return callback(err, data, uuid);
        };
      })(this), (function(_this) {
        return function(err, done, uuid) {
          var reqCache;
          reqCache = _this.addToCache(uuid, cache);
          return helpers.cbc(callbackDone, err, done, uuid, reqCache);
        };
      })(this));
      return uuid;
    },
    update: function(filter, update, callback) {
      this.clearCache();
      return this._super('update', filter, update, callback);
    },
    remove: function(data, callback) {
      this.clearCache();
      return this._super('remove', data, callback);
    },
    create: function(data, callback) {
      this.clearCache();
      return this._super('create', data, callback);
    }
  });

  LiveRemoteModel = RemoteModel.extend4000({
    references: 0,
    initialize: function() {
      return this.settings = this.collection.settings.model || {};
    },
    gCollectForce: function() {
      this.trigger('gCollectForce');
      return this.trigger('gCollect');
    },
    gCollect: function() {
      if (!--this.references) {
        return this.trigger('gCollect');
      }
    },
    newRef: function() {
      this.references++;
      return this;
    },
    flush: function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      if (this.settings.autoGcollect) {
        this.gCollect();
      }
      return RemoteModel.prototype.flush.apply(this, args);
    },
    flushStay: function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return RemoteModel.prototype.flush.apply(this, args);
    },
    hold: function(callback) {
      var model;
      model = this.collection.hold(this);
      return callback.call(model, function() {
        return model.gCollect();
      });
    }
  });

  LiveModelMixin = exports.LiveModelMixin = Backbone.Model.extend4000({
    initialize: function() {
      return this.liveModels = {};
    },
    modelClass: LiveRemoteModel,
    hold: function(model) {
      var liveModel;
      if (liveModel = this.liveModels[model.id]) {
        return liveModel.newRef();
      } else {
        liveModel = this.liveModels[model.id] = model.newRef();
        liveModel.once('gCollect', (function(_this) {
          return function() {
            return delete _this.liveModels[model.id];
          };
        })(this));
        liveModel.trigger('live');
        return liveModel;
      }
    },
    modelFromData: function(entry) {
      var liveModel;
      if (liveModel = this.liveModels[entry.id]) {
        return liveModel;
      } else {
        return ModelMixin.prototype.modelFromData.call(this, entry);
      }
    }
  });

  exports.classical = Core.extend4000(ModelMixin, ReferenceMixin, RequestIdMixin, CachingMixin);

}).call(this);
