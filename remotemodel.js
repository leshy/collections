// Generated by CoffeeScript 1.8.0
(function() {
  var Backbone, Permission, RemoteModel, SaveRealm, Select, Validator, async, collections, decorate, decorators, definePermissions, helpers, sman, subscriptionman2, v, _;

  Backbone = require('backbone4000');

  _ = require('underscore');

  helpers = require('helpers');

  Validator = require('validator2-extras');

  v = Validator.v;

  Select = Validator.Select;

  decorators = require('decorators2');

  decorate = decorators.decorate;

  async = require('async');

  collections = require('./index');

  subscriptionman2 = require('subscriptionman2');

  sman = subscriptionman2.Core.extend4000(subscriptionman2.asyncCallbackReturnMixin, subscriptionman2.simplestMatcher);

  exports.definePermissions = definePermissions = function(f) {
    var defPerm, execute, permissions, read, write;
    permissions = {
      read: {},
      write: {},
      execute: {}
    };
    defPerm = function(perm, name, permission) {
      if (!permissions[perm][name]) {
        permissions[perm][name] = [];
      }
      return permissions[perm][name].push(permission);
    };
    write = function(name, permission) {
      return defPerm('write', name, permission);
    };
    read = function(name, permission) {
      return defPerm('read', name, permission);
    };
    execute = function(name, permission) {
      return defPerm('execute', name, permission);
    };
    f(write, execute, read);
    return permissions;
  };

  SaveRealm = exports.SaveRealm = new Object();

  Permission = exports.Permission = Validator.ValidatedModel.extend4000({
    initialize: function() {
      var chew;
      if (chew = this.get('chew')) {
        return this.chew = chew;
      }
    },
    chew: function(value, data, callback) {
      return callback(null, value);
    },
    match: function(model, value, attribute, realm, callback) {
      var matchModel, matchRealm, matchValue;
      matchModel = this.get('matchModel') || this.matchModel;
      matchValue = this.get('matchValue') || this.matchValue;
      matchRealm = this.get('matchRealm') || this.matchRealm;
      if (!matchModel && !matchRealm && !matchValue) {
        return callback(void 0, value);
      }
      return async.series({
        matchRealm: (function(_this) {
          return function(callback) {
            var validator;
            if (!(validator = matchRealm)) {
              return callback();
            } else {
              return v(validator).feed(realm, callback);
            }
          };
        })(this),
        matchModel: (function(_this) {
          return function(callback) {
            var validator;
            if (!(validator = matchModel)) {
              return callback();
            } else {
              return v(validator).feed(model.attributes, callback);
            }
          };
        })(this),
        matchValue: (function(_this) {
          return function(callback) {
            var validator;
            if (!(validator = matchValue)) {
              return callback();
            } else {
              return v(validator).feed(value, callback);
            }
          };
        })(this)
      }, (function(_this) {
        return function(err, data) {
          var chew;
          if (err) {
            return callback(err);
          }
          if (data.matchValue) {
            value = data.matchValue;
          }
          if (chew = _this.get('chew')) {
            return chew.call(model, value, attribute, realm, function(err, newValue) {
              if (err) {
                return callback(err);
              } else {
                return callback(null, newValue);
              }
            });
          } else {
            return callback(null, value);
          }
        };
      })(this));
    }
  });

  RemoteModel = exports.RemoteModel = Validator.ValidatedModel.extend4000(sman, {
    validator: v({
      collection: 'instance'
    }),
    initialize: function() {
      this.settings = _.extend({}, this.settings, this.get('settings'));
      this.when('collection', (function(_this) {
        return function(collection) {
          var _ref;
          _this.unset('collection');
          _this.collection = collection;
          return _this.settings = _.extend(_this.settings, (_ref = _this.collection.settings) != null ? _ref.model : void 0);
        };
      })(this));
      this.when('id', (function(_this) {
        return function(id) {
          _this.id = id;
          if (_this.autosubscribe || _this.settings.autosubscribe) {
            return _this.subscribeModel(id);
          }
        };
      })(this));
      this.on('change', (function(_this) {
        return function(model, data) {
          _this.localChangePropagade(model, data);
          return _this.trigger('anychange');
        };
      })(this));
      this.importReferences(this.attributes, (function(_this) {
        return function(err, data) {
          return _this.attributes = data;
        };
      })(this));
      if (this.get('id')) {
        return this.changes = {};
      } else {
        return this.changes = helpers.dictMap(this.attributes, function() {
          return true;
        });
      }
    },
    refresh: function(callback) {
      return this.collection.findModel({
        id: this.id
      }, function(err, model) {
        return callback.apply(model, [err, model]);
      });
    },
    subscribeModel: function(id) {
      var sub;
      sub = (function(_this) {
        return function() {
          if (!_this.collection.subscribeModel) {
            return;
          }
          _this.unsubscribe = _this.collection.subscribeModel(id, _this.remoteChangeReceive.bind(_this));
          return _this.once('del', function() {
            return _this.unsubscribeModel();
          });
        };
      })(this);
      if (!id) {
        return this.when('id', id(sub()));
      } else {
        return sub();
      }
    },
    unsubscribeModel: function() {
      return true;
    },
    reference: function(id) {
      if (id == null) {
        id = this.get('id');
      }
      return {
        _r: id,
        _c: this.collection.name()
      };
    },
    depthfirst: function(callback, target) {
      var key, response;
      if (target == null) {
        target = this.attributes;
      }
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
    asyncDepthfirst: function(changef, callback, clone, all, target, depth) {
      var prevtarget, _check, _digtarget;
      if (clone == null) {
        clone = false;
      }
      if (all == null) {
        all = false;
      }
      if (target == null) {
        target = this.attributes;
      }
      if (depth == null) {
        depth = 0;
      }
      _check = function(target, callback) {
        return helpers.forceCallback(changef, target, callback);
      };
      _digtarget = (function(_this) {
        return function(target, callback) {
          var bucket, cb, key, result;
          bucket = new helpers.parallelBucket();
          for (key in target) {
            if (target[key]) {
              cb = bucket.cb();
              result = function(err, data) {
                target[key] = data;
                return cb(err, data);
              };
              _this.asyncDepthfirst(changef, result, clone, all, target[key], depth + 1);
            }
          }
          return bucket.done(function(err, data) {
            return callback(err, target);
          });
        };
      })(this);
      prevtarget = target;
      if (target.constructor === Object || target.constructor === Array) {
        if (clone) {
          target = _.clone(target);
        }
        if (all) {
          return _check(target, (function(_this) {
            return function(err, target) {
              if (err) {
                target = prevtarget;
              }
              if (target.constructor === Object || target.constructor === Array) {
                return _digtarget(target, callback);
              } else {
                return callback(void 0, target);
              }
            };
          })(this));
        } else {
          return _digtarget(target, callback);
        }
      } else {
        return _check(target, callback);
      }
    },
    remoteChangeReceive: function(change) {
      switch (change.action) {
        case 'update':
          return this.importReferences(change.update, (function(_this) {
            return function(err, data) {
              _this.set(data, {
                silent: true
              });
              helpers.dictMap(change.update, function(value, key) {
                _this.trigger('remotechange:' + key, value);
                return _this.trigger('anychange:' + key, value);
              });
              _this.trigger('remotechange');
              return _this.trigger('anychange');
            };
          })(this));
        case 'remove':
          return this.del();
      }
    },
    localChangePropagade: function(model, data) {
      var change;
      change = model.changedAttributes();
      delete change.id;
      return _.extend(this.changes, helpers.dictMap(change, function() {
        return true;
      }));
    },
    dirty: function(attribute) {
      return this.changes[attribute] = true;
    },
    touch: function(attribute) {
      return this.changes[attribute] = true;
    },
    localCallPropagade: function(name, args, callback) {
      return this.collection.fcall(name, args, {
        id: this.id
      }, callback);
    },
    remoteCallReceive: function(name, args, realm, callback, callbackMulti) {
      return this.applyPermission('execute', name, args, realm, (function(_this) {
        return function(err, args, permission) {
          if (err) {
            callback(err);
            return;
          }
          return _this[name].apply(_this, args.concat(callback, callbackMulti));
        };
      })(this));
    },
    update: function(data, realm, callback) {
      return this.applyPermissions('write', data, realm, (function(_this) {
        return function(err, data) {
          if (err) {
            return helpers.cbc(callback, err, data);
          }
          _this.set(data);
          return helpers.cbc(callback, err, data);
        };
      })(this));
    },
    applyPermissions: function(type, attrs, realm, callback, strictPerm) {
      if (strictPerm == null) {
        strictPerm = true;
      }
      if (strictPerm) {
        return async.series(helpers.dictMap(attrs, (function(_this) {
          return function(value, attribute) {
            return function(callback) {
              return _this.applyPermission(type, attribute, value, realm, callback);
            };
          };
        })(this)), callback);
      } else {
        return async.series(helpers.dictMap(attrs, (function(_this) {
          return function(value, attribute) {
            return function(callback) {
              return _this.applyPermission(type, attribute, value, realm, function(err, data) {
                return callback(null, data);
              });
            };
          };
        })(this)), function(err, data) {
          return callback(void 0, helpers.dictMap(data, function(x) {
            return x;
          }));
        });
      }
    },
    applyPermission: function(type, attribute, value, realm, callback) {
      var attributePermissions, model, _ref;
      model = this;
      if (!(attributePermissions = (_ref = this.permissions) != null ? _ref[type][attribute] : void 0)) {
        return callback(attribute + " (not defined)");
      }
      return async.mapSeries(attributePermissions, (function(permission, callback) {
        return permission.match(model, value, attribute, realm, function(err, value) {
          return callback(value, err);
        });
      }), function(value, err) {
        err = _.last(err);
        if (err || !value) {
          return callback('access denied');
        } else {
          return callback(null, value);
        }
      });
    },
    exportReferences: function(data, callback) {
      var _matchf;
      if (data == null) {
        data = this.attributes;
      }
      _matchf = function(value, callback) {
        var id;
        if (value instanceof RemoteModel) {
          if (id = value.get('id')) {
            callback(void 0, value.reference(id));
          } else {
            value.flush(function(err, id) {});
            if (err) {
              callback(err, id);
            } else {
              callback(void 0, value.reference(id));
            }
          }
          return void 0;
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
    importReferences: function(data, callback) {
      var refcheck, _import, _matchf, _resolve_reference;
      _import = function(reference) {
        return true;
      };
      _resolve_reference = (function(_this) {
        return function(ref) {
          var targetcollection;
          if (!(targetcollection = _this.collection.getcollection(ref._c))) {
            throw 'unknown collection "' + ref._c + '"';
          } else {
            return targetcollection.unresolved(ref._r);
          }
        };
      })(this);
      refcheck = v({
        _r: "String",
        _c: "String"
      });
      _matchf = function(value, callback) {
        var error;
        try {
          refcheck.feed(value, function(err, data) {
            if (err) {
              return callback(void 0, value);
            } else {
              return callback(void 0, _resolve_reference(value));
            }
          });
        } catch (_error) {
          error = _error;
          console.log("CATCH ERR", error, value);
          callback(void 0, value);
        }
        return void 0;
      };
      return this.asyncDepthfirst(_matchf, callback, true, true, data);
    },
    flush: function(callback) {
      return this.flushnow(callback);
    },
    flushnow: function(callback) {
      var changes, changesBak, continue1;
      changes = {};
      _.map(this.changes, (function(_this) {
        return function(value, property) {
          return changes[property] = _this.attributes[property];
        };
      })(this));
      changesBak = {};
      this.changes = {};
      if (this.settings.storePermissions) {
        this.applyPermissions('write', changes, exports.StoreRealm, (function(_this) {
          return function(err, data) {
            if (!err) {
              return _this.set(data);
            } else {
              return helpers.cbc(callback, err);
            }
          };
        })(this));
      }
      continue1 = (function(_this) {
        return function(err, subchanges) {
          if (err != null) {
            return callback(err);
          }
          subchanges = _.reduce(subchanges, (function(all, data) {
            return _.extend(all, data);
          }), {});
          _.extend(changes, subchanges);
          return _this.exportReferences(changes, function(err, changes) {
            var id;
            if (helpers.isEmpty(changes)) {
              return helpers.cbc(callback);
            }
            if (!(id = _this.get('id'))) {
              return _this.collection.create(changes, function(err, data) {
                if (err) {
                  _this.changes = changesBak;
                  return helpers.cbc(callback, err);
                }
                _.extend(_this.attributes, _.extend(subchanges, data));
                _this.trigger('change:id', _this, data.id);
                helpers.cbc(callback, err, _.extend(subchanges, data));
                _this.render({}, function(err, data) {
                  if (!err) {
                    return _this.collection.trigger('create', data);
                  }
                });
                return _this.eventAsync('post_create', _this);
              });
            } else {
              return _this.collection.update({
                id: id
              }, changes, function(err, data) {
                if (err) {
                  _this.changes = changesBak;
                } else {
                  _this.render({}, changes, function(err, data) {
                    if (!err) {
                      return _this.collection.trigger('update', _.extend({
                        id: id
                      }, changes));
                    }
                  });
                }
                return helpers.cbc(callback, err, data);
              });
            }
          });
        };
      })(this);
      if (this.get('id')) {
        return this.eventAsync('update', changes, continue1);
      } else {
        return this.eventAsync('create', changes, continue1);
      }
    },
    render: function(realm, data, callback) {
      if (data.constructor === Function) {
        callback = data;
        data = this.attributes;
      }
      return this.exportReferences(data, (function(_this) {
        return function(err, data) {
          return _this.applyPermissions('read', data, realm, (function(err, data) {
            return callback(err, data);
          }), false);
        };
      })(this));
    },
    del: function(callback) {
      return this.trigger('del', this);
    },
    unsubscribe: function() {
      return true;
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
    }
  });

}).call(this);
