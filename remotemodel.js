// Generated by LiveScript 1.4.0
(function(){
  var Backbone, _, h, Validator, v, Select, async, collections, subscriptionman2, sman, definePermissions, SaveRealm, Permission, RemoteModel, slice$ = [].slice;
  Backbone = require('backbone4000');
  _ = require('underscore');
  h = require('helpers');
  Validator = require('validator2-extras');
  v = Validator.v;
  Select = Validator.Select;
  async = require('async');
  collections = require('./index');
  subscriptionman2 = require('subscriptionman2');
  sman = subscriptionman2.Core.extend4000(subscriptionman2.asyncCallbackReturnMixin, subscriptionman2.simplestMatcher);
  exports.definePermissions = definePermissions = function(f){
    var ret, defPerm, write, read, exec;
    ret = {
      read: {},
      write: {},
      exec: {}
    };
    defPerm = curry$(function(type, names, permissions){
      return h.mIter(names, function(name){
        return h.mIter(permissions, function(perm){
          return h.dictpush(ret[type], name, perm);
        });
      });
    });
    write = defPerm('write');
    read = defPerm('read');
    exec = defPerm('exec');
    f(read, write, exec);
    return ret;
  };
  SaveRealm = exports.SaveRealm = new Object();
  Permission = exports.Permission = Validator.ValidatedModel.extend4000({
    initialize: function(){
      var chew;
      if (chew = this.get('chew')) {
        return this.chew = chew;
      }
    },
    match: function(model, value, attribute, realm, callback){
      var matchModel, matchValue, matchRealm, this$ = this;
      matchModel = v(this.get('matchModel') || this.matchModel);
      matchValue = v(this.get('matchValue') || this.matchValue);
      matchRealm = v(this.get('matchRealm') || this.matchRealm);
      if (!matchModel && !matchRealm && !matchValue) {
        return callback(undefined, value);
      }
      return async.series({
        matchRealm: function(callback){
          var validator;
          if (!(validator = matchRealm)) {
            return callback();
          } else {
            return validator.feed(realm, callback);
          }
        },
        matchModel: function(callback){
          var validator;
          if (!(validator = matchModel)) {
            return callback();
          } else {
            return validator.feed(model.attributes, callback);
          }
        },
        matchValue: function(callback){
          var validator;
          if (!(validator = matchValue)) {
            return callback();
          } else {
            return validator.feed(value, callback);
          }
        }
      }, function(err, data){
        var value, chew;
        if (err) {
          return callback(err);
        }
        if (data.matchValue) {
          value = data.matchValue;
        }
        if (chew = this$.get('chew') || (chew = this$.chew)) {
          return chew.call(model, value, attribute, realm, function(err, newValue){
            if (err) {
              return callback(err);
            } else {
              return callback(undefined, newValue);
            }
          });
        } else {
          return callback(undefined, value);
        }
      });
    }
  });
  RemoteModel = exports.RemoteModel = sman.extend4000({
    initialize: function(){
      var this$ = this;
      this.settings = _.extend({}, this.settings, this.get('settings'));
      this.when('collection', function(collection){
        var ref$;
        this$.unset('collection');
        this$.collection = collection;
        return this$.settings = _.extend(this$.settings, (ref$ = this$.collection.settings) != null ? ref$.model : void 8);
      });
      this.when('id', function(id){
        this$.id = id;
        if (this$.autosubscribe || this$.settings.autosubscribe) {
          return this$.subscribeModel();
        }
      });
      this.on('change', function(model, data){
        this$.localChangePropagade(model, data);
        return this$.trigger('anychange');
      });
      this.importReferences(this.attributes, function(err, data){
        return this$.attributes = data;
      });
      if (this.get('id')) {
        return this.changes = {};
      } else {
        return this.changes = h.dictMap(this.attributes, function(){
          return true;
        });
      }
    },
    refresh: function(callback){
      return this.collection.findModel({
        id: this.id
      }, function(err, model){
        return callback.apply(model, [err, model]);
      });
    },
    subscribeModel: function(){
      var sub, this$ = this;
      sub = function(id){
        if (!this$.collection.subscribeModel) {
          return;
        }
        this$.trigger('subscribeModel');
        this$._unsub = this$.collection.subscribeModel(id, function(change){
          return this$.remoteChangeReceive(change);
        });
        return this$.once('del', function(){
          return this$.unsubscribeModel();
        });
      };
      if (!this.id) {
        return this.when('id', id(sub(id)));
      } else {
        return sub(this.id);
      }
    },
    unsubscribeModel: function(){
      if (!this._unsub) {
        throw "can't unsubscribe this model. it's not subscribed yet";
      }
      this._unsub();
      return this.trigger('unsubscribeModel');
    },
    reference: function(id){
      id == null && (id = this.get('id'));
      return {
        _r: id,
        _c: this.collection.name()
      };
    },
    depthfirst: function(callback, target){
      var key, response;
      target == null && (target = attributes);
      if (target.constructor === Object || target.constructor === Array) {
        target = _.clone(target);
        for (key in target) {
          target[key] = this.depthfirst(callback, target[key]);
        }
        return target;
      } else if (response = callback(target)) {
        return response;
      } else {
        return target;
      }
    },
    asyncDepthfirst: function(changef, callback, clone, all, target, depth){
      var _check, _digtarget, prevtarget, this$ = this;
      clone == null && (clone = false);
      all == null && (all = false);
      target == null && (target = this.attributes);
      depth == null && (depth = 0);
      _check = function(target, callback){
        return h.forceCallback(changef, target, callback);
      };
      _digtarget = function(target, callback){
        var bucket, key, cb, result;
        bucket = new h.parallelBucket();
        for (key in target) {
          if (target[key]) {
            cb = bucket.cb();
            result = fn$;
            this$.asyncDepthfirst(changef, result, clone, all, target[key], depth + 1);
          }
        }
        return bucket.done(function(err, data){
          return callback(err, target);
        });
        function fn$(err, data){
          target[key] = data;
          return cb(err, data);
        }
      };
      prevtarget = target;
      if (target.constructor === Object || target.constructor === Array) {
        if (clone) {
          target = _.clone(target);
        }
        if (all) {
          return _check(target, function(err, target){
            if (err) {
              target = prevtarget;
            }
            if (target.constructor === Object || target.constructor === Array) {
              return _digtarget(target, callback);
            } else {
              return callback(undefined, target);
            }
          });
        } else {
          return _digtarget(target, callback);
        }
      } else {
        return _check(target, callback);
      }
    },
    remoteChangeReceive: function(change){
      var this$ = this;
      this.changed = true;
      switch (change.action) {
      case 'update':
        return this.importReferences(change.update, function(err, data){
          this$.set(data, {
            silent: true
          });
          h.dictMap(data, function(value, key){
            this$.trigger('remotechange:' + key, this$, value);
            return this$.trigger('anychange:' + key, this$, value);
          });
          this$.trigger('remotechange');
          return this$.trigger('anychange');
        });
      case 'remove':
        return this.del();
      }
    },
    localChangePropagade: function(model, data){
      var change;
      change = model.changedAttributes();
      delete change.id;
      return _.extend(this.changes, h.dictMap(change, function(){
        return true;
      }));
    },
    dirty: function(){
      var args;
      args = slice$.call(arguments);
      return this.touch.apply(this, args);
    },
    touch: function(){
      var args, this$ = this;
      args = slice$.call(arguments);
      return _.each(args, function(attribute){
        this$.changes[attribute] = true;
        return this$.trigger('change:' + attribute, this$, this$.get(attribute));
      });
    },
    localCallPropagade: function(name, args, callback){
      return this.collection.fcall(name, args, {
        id: this.id
      }, callback);
    },
    remoteCallReceive: function(name, args, realm, callback, callbackMulti){
      var this$ = this;
      return this.applyPermission('exec', name, args, realm, function(err, args, permission){
        if (err) {
          callback(err);
          return;
        }
        return this$[name].apply(this$, args.concat(callback, callbackMulti));
      });
    },
    update: function(data, realm, callback){
      var this$ = this;
      return this.applyPermissions('write', data, realm, function(err, data){
        if (err) {
          return h.cbc(callback, err, data);
        }
        this$.set(data);
        return h.cbc(callback, err, data);
      });
    },
    applyPermissions: function(type, attrs, realm, callback, strictPerm){
      var this$ = this;
      strictPerm == null && (strictPerm = true);
      if (strictPerm) {
        return async.series(h.dictMap(attrs, function(value, attribute){
          return function(callback){
            return this$.applyPermission(type, attribute, value, realm, callback);
          };
        }), callback);
      } else {
        return async.series(h.dictMap(attrs, function(value, attribute){
          return function(callback){
            return this$.applyPermission(type, attribute, value, realm, function(err, data){
              return callback(null, data);
            });
          };
        }), function(err, data){
          return callback(undefined, h.dictMap(data, function(x){
            return x;
          }));
        });
      }
    },
    applyPermission: function(type, attribute, value, realm, callback){
      var model, attributePermissions, ref$, permissions, permission, checkperm;
      model = this;
      if (!(attributePermissions = (ref$ = this.permissions) != null ? ref$[type][attribute] : void 8)) {
        return callback("Access Denied to" + attribute + ": No Permission");
      }
      permissions = _.clone(attributePermissions);
      permission = permissions.pop();
      checkperm = function(permissions, callback){
        return permissions.pop().match(model, value, attribute, realm, function(err, value){
          if (!err) {
            return callback(undefined, value);
          }
          if (!permissions.length) {
            return callback(err);
          }
          return checkperm(permissions, callback);
        });
      };
      return checkperm(_.clone(attributePermissions), function(err, value){
        if (err) {
          return callback("Access Denied to " + attribute + ": " + err);
        }
        if (value === undefined) {
          return callback("Access Denied to " + attribute + ": No Value");
        }
        return callback(undefined, value);
      });
    },
    exportReferences: function(data, callback){
      var _matchf;
      data == null && (data = this.attributes);
      _matchf = function(value, callback){
        var id;
        if (value instanceof RemoteModel) {
          if (id = value.get('id')) {
            callback(undefined, value.reference(id));
          } else {
            value.flush(function(err, id){});
            if (err) {
              h.cbc(callback, err, id);
            } else {
              h.cbc(callback, undefined, value.reference(id));
            }
          }
          return undefined;
        } else if (value instanceof collections.UnresolvedRemoteModel) {
          return value.reference();
        } else {
          if (typeof value === 'object' && value.constructor !== Object) {
            throw "something weird is in my attributes";
          }
          return value;
        }
      };
      return this.asyncDepthfirst(_matchf, callback, true, false, data);
    },
    importReferences: function(data, callback){
      var _import, _resolve_reference, refcheck, _matchf, this$ = this;
      _import = function(reference){
        return true;
      };
      _resolve_reference = function(ref){
        var targetcollection;
        if (!(targetcollection = this$.collection.getcollection(ref._c))) {
          throw 'unknown collection "' + ref._c + '"';
        } else {
          return targetcollection.unresolved(ref);
        }
      };
      refcheck = v({
        _r: "String",
        _c: "String"
      });
      _matchf = function(value, callback){
        var error;
        try {
          refcheck.feed(value, function(err, data){
            if (err) {
              return callback(undefined, value);
            } else {
              return callback(undefined, _resolve_reference(value));
            }
          });
        } catch (e$) {
          error = e$;
          console.log("CATCH ERR", error, value);
          callback(undefined, value);
        }
        return undefined;
      };
      return this.asyncDepthfirst(_matchf, callback, true, true, data);
    },
    flush: function(callback){
      return this.flushnow(callback);
    },
    flushnow: function(callback){
      var changes, changesBak, continue1, this$ = this;
      changes = {};
      _.map(this.changes, function(value, property){
        return changes[property] = this$.attributes[property];
      });
      changesBak = {};
      this.changes = {};
      if (this.settings.storePermissions) {
        this.applyPermissions('write', changes, exports.StoreRealm, function(err, data){
          if (!err) {
            return this$.set(data);
          } else {
            return h.cbc(callback, err);
          }
        });
      }
      continue1 = function(err, subchanges){
        if (err != null) {
          return callback(err);
        }
        subchanges = _.reduce(subchanges, function(all, data){
          return _.extend(all, data);
        }, {});
        _.extend(changes, subchanges);
        return this$.exportReferences(changes, function(err, changes){
          var id;
          if (h.isEmpty(changes)) {
            return h.cbc(callback);
          }
          if (!(id = this$.get('id'))) {
            return this$.collection.create(changes, function(err, data){
              if (err) {
                this$.changes = changesBak;
                return h.cbc(callback, err);
              }
              _.extend(this$.attributes, _.extend(subchanges, data));
              this$.trigger('change:id', this$, data.id);
              h.cbc(callback, err, _.extend(subchanges, data));
              this$.render({}, function(err, data){
                if (!err) {
                  return this$.collection.trigger('create', data);
                }
              });
              this$.collection.trigger('createModel', this$);
              return this$.eventAsync('post_create', this$);
            });
          } else {
            return this$.collection.update({
              id: id
            }, changes, function(err, data){
              if (err) {
                this$.changes = changesBak;
              } else {
                this$.event('post_update', changes);
                this$.render({}, changes, function(err, data){
                  if (!err) {
                    return this$.collection.trigger('update', _.extend({
                      id: id
                    }, data));
                  }
                });
              }
              return h.cbc(callback, err, data);
            });
          }
        });
      };
      if (this.get('id')) {
        return this.eventAsync('update', changes, continue1);
      } else {
        return this.eventAsync('create', changes, continue1);
      }
    },
    render: function(realm, data, callback){
      var this$ = this;
      if (data.constructor === Function) {
        callback = data;
        data = this.attributes;
      }
      return this.exportReferences(data, function(err, data){
        return this$.applyPermissions('read', data, realm, function(err, data){
          return callback(err, data);
        }, false);
      });
    },
    del: function(callback){
      return this.trigger('del', this);
    },
    unsubscribe: function(){
      return true;
    },
    getResolve: function(attribute, cb){
      var model;
      model = this.get(attribute);
      if (model != null && model.resolve) {
        return model.resolve(cb);
      } else {
        return _.defer(function(){
          return h.cbc(cb, undefined, model);
        });
      }
    },
    mapResolve: function(attribute, cb){
      var models;
      models = this.get(attribute);
      return _.each(models, function(model){
        if (model != null && model.resolve) {
          return model.resolve(cb);
        } else {
          return _.defer(function(){
            return h.cbc(cb, undefined, model);
          });
        }
      });
    },
    remove: function(callback){
      var id;
      this.del();
      if (!(id = this.get('id'))) {
        return h.cbc(callback);
      }
      this.collection.remove({
        id: id
      }, callback);
      return this.collection.trigger('remove', {
        id: id
      });
    }
  });
  function curry$(f, bound){
    var context,
    _curry = function(args) {
      return f.length > 1 ? function(){
        var params = args ? args.concat() : [];
        context = bound ? context || this : this;
        return params.push.apply(params, arguments) <
            f.length && arguments.length ?
          _curry.call(context, params) : f.apply(context, params);
      } : f;
    };
    return _curry();
  }
}).call(this);
