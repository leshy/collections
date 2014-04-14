// Generated by CoffeeScript 1.4.0
(function() {
  var Backbone, CachingMixin, ModelMixin, ReferenceMixin, RemoteModel, RequestIdMixin, UnresolvedRemoteModel, helpers, settings, sman, subscriptionman2, _,
    __slice = [].slice;

  Backbone = require('backbone4000');

  _ = require('underscore');

  helpers = require('helpers');

  _.extend(exports, require('./remotemodel'));

  RemoteModel = exports.RemoteModel;

  settings = exports.settings = {};

  subscriptionman2 = require('subscriptionman2');

  sman = subscriptionman2.Core.extend4000(subscriptionman2.asyncCallbackReturnMixin, subscriptionman2.simplestMatcher);

  ModelMixin = exports.ModelMixin = sman.extend4000({
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
      throw "unable to resolve " + JSON.stringify(entry) + " " + _.keys(this.models).join(", ");
    },
    updateModel: function(pattern, data, realm, callback) {
      var queue;
      queue = new helpers.queue({
        size: 3
      });
      this.findModels(pattern, {}, function(err, model) {
        return queue.push(model.id, function(callback) {
          var _this = this;
          return model.update(data, realm, function(err, data) {
            if (err) {
              return callback(err, data);
            }
            return model.flush(function(err, fdata) {
              return callback(err, data);
            });
          });
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
      var _this = this;
      return this.eventAsync('create', {
        data: data,
        realm: realm
      }, function(err, subchanges) {
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
        try {
          newModel = new (_this.resolveModel(data));
        } catch (err) {
          return callback(err);
        }
        return newModel.update(data, realm, function(err, data) {
          console.log(err, data);
          if (err) {
            return callback(err, data);
          }
          newModel.set(subchanges);
          return newModel.flush(function(err, data) {
            return callback(err, _.extend(subchanges, data));
          });
        });
      });
    },
    findModels: function(pattern, limits, callback, callbackDone) {
      var _this = this;
      return this.find(pattern, limits, function(err, entry) {
        if (err) {
          return callback(err);
        } else {
          return callback(err, new (_this.resolveModel(entry))(entry));
        }
      }, callbackDone);
    },
    findModel: function(pattern, callback) {
      var _this = this;
      return this.findOne(pattern, function(err, entry) {
        if (!entry || err) {
          return callback(err);
        } else {
          return callback(err, new (_this.resolveModel(entry))(entry));
        }
      });
    },
    fcall: function(name, args, pattern, realm, callback) {
      return this.findModel(pattern, function(err, model) {
        if (model) {
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

  RequestIdMixin = exports.RequestIdMixin = Backbone.Model.extend4000({
    find: function(args, limits, callback, callbackDone) {
      var uuid,
        _this = this;
      uuid = JSON.stringify({
        name: this.name(),
        args: args,
        limits: limits
      });
      return this._super('find', args, limits, function(err, data) {
        return callback(err, data, uuid);
      }, function() {
        return helpers.cbc(callbackDone, void 0, void 0, uuid);
      });
    },
    findOne: function(args, callback) {
      var cb,
        _this = this;
      cb = function(err, data) {
        return callback(err, data, JSON.stringify({
          name: _this.name(),
          args: args
        }));
      };
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
      var name,
        _this = this;
      if (!timeout) {
        timeout = this.timeout;
      }
      this.cache[uuid] = result;
      name = new Date().getTime();
      this.timeouts[name] = helpers.wait(timeout, function() {
        if (_this.timeouts[name]) {
          delete _this.timeouts[name];
        }
        if (_this.cache[uuid]) {
          return delete _this.cache[uuid];
        }
      });
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
      var loadCache, uuid,
        _this = this;
      uuid = JSON.stringify({
        name: this.name(),
        args: args
      });
      if (loadCache = this.cache[uuid]) {
        callback(void 0, loadCache, uuid);
        return uuid;
      }
      this._super('findOne', args, function(err, data, uuid) {
        var reqCache;
        reqCache = _this.addToCache(uuid, data);
        return callback(err, data, uuid, reqCache);
      });
      return uuid;
    },
    find: function(args, limits, callback, callbackDone) {
      var cache, fail, loadCache, uuid,
        _this = this;
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
      this._super('find', args, limits, function(err, data, uuid) {
        if (!fail) {
          if (err) {
            fail = true;
          } else {
            cache.push(data);
          }
        }
        return callback(err, data, uuid);
      }, function(err, done, uuid) {
        var reqCache;
        reqCache = _this.addToCache(uuid, cache);
        return helpers.cbc(callbackDone, err, done, uuid, reqCache);
      });
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

}).call(this);
