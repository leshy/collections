// Generated by CoffeeScript 1.4.0
(function() {
  var Backbone, Permission, RemoteModel, SaveRealm, Select, Validator, async, collections, decorate, decorators, definePermissions, helpers, settings, v, _;

  Backbone = require('backbone4000');

  _ = require('underscore');

  helpers = require('helpers');

  Validator = require('validator2-extras');

  v = Validator.v;

  Select = Validator.Select;

  decorators = require('decorators');

  decorate = decorators.decorate;

  async = require('async');

  collections = require('./index');

  settings = exports.settings = {};

  exports.definePermissions = definePermissions = function(f) {
    var defattr, deffun, permissions;
    permissions = {};
    defattr = function(name, permission) {
      if (!permissions[name]) {
        permissions[name] = [];
      }
      return permissions[name].push(permission);
    };
    deffun = defattr;
    f(defattr, deffun);
    return permissions;
  };

  SaveRealm = exports.SaveRealm = new Object();

  Permission = exports.Permission = Validator.ValidatedModel.extend4000({
    validator: v({
      chew: 'Function'
    }),
    initialize: function() {
      return this.chew = this.get('chew');
    },
    match: function(model, realm, callback) {
      var _this = this;
      return async.series([
        function(callback) {
          var validator;
          if (!(validator = _this.get('matchModel'))) {
            return callback();
          } else {
            return validator.feed(model.attributes, callback);
          }
        }, function(callback) {
          var validator;
          if (!(validator = _this.get('matchRealm'))) {
            return callback();
          } else {
            return validator.feed(realm, callback);
          }
        }
      ], callback);
    }
  });

  RemoteModel = exports.RemoteModel = Validator.ValidatedModel.extend4000({
    validator: v({
      collection: 'instance'
    }),
    initialize: function() {
      var _this = this;
      this.when('collection', function(collection) {
        _this.unset('collection');
        return _this.collection = collection;
      });
      this.when('id', function(id) {
        _this.id = id;
        if (exports.settings.autosubscribe) {
          return _this.subscribeModel(id);
        }
      });
      this.on('change', function(model, data) {
        _this.localChangePropagade(model, data);
        return _this.trigger('anychange');
      });
      this.importReferences(this.attributes, function(err, data) {
        return _this.attributes = data;
      });
      if (this.get('id')) {
        return this.changes = {};
      } else {
        return this.changes = helpers.dictMap(this.attributes, function() {
          return true;
        });
      }
    },
    subscribeModel: function(id) {
      var sub,
        _this = this;
      sub = function() {
        if (!_this.collection.subscribeModel) {
          return;
        }
        _this.unsubscribe = _this.collection.subscribeModel(id, _this.remoteChangeReceive.bind(_this));
        return _this.once('del', function() {
          return _this.unsubscribeModel();
        });
      };
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
      var prevtarget, _check, _digtarget,
        _this = this;
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
      _digtarget = function(target, callback) {
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
      prevtarget = target;
      if (target.constructor === Object || target.constructor === Array) {
        if (clone) {
          target = _.clone(target);
        }
        if (all) {
          return _check(target, function(err, target) {
            if (err) {
              target = prevtarget;
            }
            if (target.constructor === Object || target.constructor === Array) {
              return _digtarget(target, callback);
            } else {
              return callback(void 0, target);
            }
          });
        } else {
          return _digtarget(target, callback);
        }
      } else {
        return _check(target, callback);
      }
    },
    remoteChangeReceive: function(change) {
      var _this = this;
      switch (change.action) {
        case 'update':
          return this.importReferences(change.update, function(err, data) {
            _this.set(data, {
              silent: true
            });
            helpers.dictMap(change.update, function(value, key) {
              _this.trigger('remotechange:' + key, value);
              return _this.trigger('anychange:' + key, value);
            });
            _this.trigger('remotechange');
            return _this.trigger('anychange');
          });
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
    localCallPropagade: function(name, args, callback) {
      return this.collection.fcall(name, args, {
        id: this.id
      }, callback);
    },
    remoteCallReceive: function(name, args, realm, callback) {
      var _this = this;
      if (realm) {
        return this.applyPermission(name, args, realm, function(err, args) {
          if (err) {
            callback(err);
            return;
          }
          return _this[name].apply(_this, args.concat(callback));
        });
      } else {
        return this[name].apply(this, args.concat(callback));
      }
    },
    update: function(data, realm) {
      if (!realm) {
        return this.set(data);
      } else {
        return this.applyPermissions(data, realm, function(err, data) {
          if (!err) {
            return this.set(data);
          }
        });
      }
    },
    applyPermissions: function(data, realm, callback) {
      var self,
        _this = this;
      self = this;
      return async.parallel(helpers.dictMap(data, function(value, attribute) {
        return function(callback) {
          return _this.getPermission(attribute, realm, callback);
        };
      }), function(err, permissions) {
        if (err) {
          return callback("permission denied for attribute " + (err.constructor === Object ? "s " + _.keys(err).join(', ') : " " + err));
        }
        return async.parallel(helpers.dictMap(permissions, function(permission, attribute) {
          return function(callback) {
            return permission.chew(data[attribute], {
              model: self,
              realm: realm,
              attribute: attribute
            }, callback);
          };
        }), callback);
      });
    },
    applyPermission: function(attribute, value, realm, callback) {
      var _this = this;
      return this.getPermission(attribute, realm, function(err, permission) {
        if (err) {
          helperc.cbc(callback, err);
        }
        return permission.chew(value, {
          model: _this,
          realm: realm,
          attribute: attribute
        }, callback);
      });
    },
    getPermission: function(attribute, realm, callback) {
      var attributePermissions, model, _ref;
      model = this;
      if (!(attributePermissions = (_ref = this.permissions) != null ? _ref[attribute] : void 0)) {
        callback('permission for attribute not defined');
      }
      return async.series(_.map(attributePermissions, function(permission) {
        return function(callback) {
          return permission.match(model, realm, function(err, data) {
            if (!err) {
              return callback(permission);
            } else {
              return callback();
            }
          });
        };
      }), function(permission) {
        if (permission) {
          return callback(void 0, permission);
        } else {
          return callback(attribute);
        }
      });
    },
    exportReferences: function(data, callback) {
      var _matchf;
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
      var refcheck, _import, _matchf, _resolve_reference,
        _this = this;
      _import = function(reference) {
        return true;
      };
      refcheck = v({
        _r: "String",
        _c: "String"
      });
      _resolve_reference = function(ref) {
        var targetcollection;
        if (!(targetcollection = _this.collection.getcollection(ref._c))) {
          throw 'unknown collection "' + ref._c + '"';
        } else {
          return targetcollection.unresolved(ref._r);
        }
      };
      _matchf = function(value, callback) {
        try {
          refcheck.feed(value, function(err, data) {
            if (err) {
              return callback(void 0, value);
            } else {
              return callback(void 0, _resolve_reference(value));
            }
          });
        } catch (error) {
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
      var changes,
        _this = this;
      changes = helpers.hashfilter(this.changes, function(value, property) {
        return _this.attributes[property];
      });
      if (settings.storePermissions) {
        this.applyPermissions(changes, exports.StoreRealm, function(err, data) {
          if (!err) {
            return _this.set(data);
          } else {
            return helpers.cbc(callback, err);
          }
        });
      }
      return this.exportReferences(changes, function(err, changes) {
        var id;
        if (helpers.isEmpty(changes)) {
          helpers.cbc(callback);
          return;
        }
        if (!(id = _this.get('id'))) {
          return _this.collection.create(changes, function(err, id) {
            _this.set('id', id);
            return helpers.cbc(callback, err, id);
          });
        } else {
          return _this.collection.update({
            id: id
          }, changes, helpers.cb(callback));
        }
      });
    },
    render: function(realm, callback) {
      return this.exportReferences(this.attributes, function(err, data) {
        return callback(err, data);
      });
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
