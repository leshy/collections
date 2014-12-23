// Generated by CoffeeScript 1.8.0
(function() {
  var Backbone, CachingMixin, Core, EventMixin, LiveModelMixin, LiveRemoteModel, ModelMixin, ReferenceMixin, RemoteModel, RequestIdMixin, UnresolvedRemoteModel, helpers, settings, sman, subscriptionman2, _,
    __slice = [].slice;

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
      var coreModelClass, definition, name, superclasses, _i;
      name = arguments[0], superclasses = 3 <= arguments.length ? __slice.call(arguments, 1, _i = arguments.length - 1) : (_i = 1, []), definition = arguments[_i++];
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
    updateModel: function(pattern, data, realm, callback) {
      var queue;
      queue = new helpers.queue({
        size: 3
      });
      this.findModels(pattern, {}, function(err, model) {
        return queue.push(model.id, function(callback) {
          return model.update(data, realm, (function(_this) {
            return function(err, data) {
              if (err) {
                return callback(err, data);
              }
              return model.flush(function(err, fdata) {
                if (!_.keys(data).length) {
                  data = void 0;
                }
                return callback(err, data);
              });
            };
          })(this));
        });
      });
      return queue.done(callback);
    },
    removeModel: function(pattern, callback) {
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
    createModel: function(data, realm, callback) {
      return this.eventAsync('create', {
        data: data,
        realm: realm
      }, (function(_this) {
        return function(err, subchanges) {
          var newModel;
          if (subchanges == null) {
            subchanges = {};
          }
          if (err) {
            return callback(err);
          }
          subchanges = _.reduce(subchanges, (function(all, data) {
            return _.extend(all, data);
          }), {});
          if (data.id) {
            return callback("can't specify id for new model");
          }
          try {
            newModel = new (_this.resolveModel(data));
          } catch (_error) {
            err = _error;
            return callback(err);
          }
          return newModel.update(data, realm, function(err, data) {
            if (err) {
              return callback(err, data);
            }
            newModel.set(subchanges);
            return newModel.flush(function(err, data) {
              return callback(err, _.extend(subchanges, data));
            });
          });
        };
      })(this));
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
    update: function(pattern, update, callback) {
      return this._super('update', pattern, update, (function(_this) {
        return function(err, data) {
          if (!err) {
            _this.trigger('update', {
              pattern: pattern,
              update: update
            });
          }
          return callback(err, data);
        };
      })(this));
    },
    remove: function(data, callback) {
      return this._super('remove', data, (function(_this) {
        return function(err, data) {
          if (!err) {
            _this.trigger('remove', {
              pattern: data
            });
          }
          return callback(err, data);
        };
      })(this));
    },
    create: function(data, callback) {
      return this._super('create', data, (function(_this) {
        return function(err, data) {
          if (!err) {
            _this.trigger('create', {
              create: data
            });
          }
          return callback(err, data);
        };
      })(this));
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
      var collection;
      collection = this.get('collection');
      return collection.findOne({
        id: this.get('id')
      }, (function(_this) {
        return function(err, entry) {
          if (!entry) {
            return callback('unable to resolve reference to ' + _this.get('id') + ' at ' + collection.get('name'));
          } else {
            _this.morph(collection.resolveModel(entry), _.extend(_this.attributes, entry));
            return helpers.cbc(callback, void 0, _this);
          }
        };
      })(this));
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
    references: 1,
    initialize: function() {
      this.settings = this.collection.settings.model || {};
      return console.log(">>>> liveModel: " + (this.collection.name()) + " " + this.id + " wakeup");
    },
    gCollectForce: function() {
      this.trigger('gCollectForce');
      return this.trigger('gCollect');
    },
    gCollect: function() {
      console.log(">>>> liveModel: " + (this.collection.name()) + " " + this.id + " -- " + (this.references - 1));
      if (!--this.references) {
        return this.trigger('gCollect');
      }
    },
    newRef: function() {
      this.references++;
      console.log(">>>> liveModel: " + (this.collection.name()) + " " + this.id + " ++ " + this.references);
      return this;
    },
    flush: function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      if (this.settings.autoGcollect) {
        this.gCollect();
      }
      return RemoteModel.prototype.flush.apply(this, args);
    },
    flushStay: function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return RemoteModel.prototype.flush.apply(this, args);
    }
  });

  LiveModelMixin = exports.LiveModelMixin = Backbone.Model.extend4000({
    initialize: function() {
      return this.liveModels = {};
    },
    modelClass: LiveRemoteModel,
    modelFromData: function(entry) {
      var liveModel;
      if (liveModel = this.liveModels[entry.id]) {
        return liveModel.newRef();
      }
      this.liveModels[entry.id] = liveModel = ModelMixin.prototype.modelFromData.call(this, entry);
      liveModel.on('gCollect', (function(_this) {
        return function() {
          console.log(">>>> liveModel: " + (liveModel.collection.name()) + " " + liveModel.id + " sleep");
          return delete _this.liveModels[entry.id];
        };
      })(this));
      return liveModel;
    }
  });

  exports.classical = Core.extend4000(ModelMixin, ReferenceMixin, RequestIdMixin, CachingMixin);

}).call(this);
