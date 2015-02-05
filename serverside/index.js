// Generated by CoffeeScript 1.8.0
(function() {
  var collections, memory, mongo, remotemodel, _;

  _ = require('underscore');

  mongo = require('./mongodb');

  memory = require('./memory');

  _.extend(exports, collections = require('../index'));

  exports.remotemodel = remotemodel = require('../remotemodel');

  exports.MongoCollection = mongo.MongoCollection.extend4000(collections.Core, collections.ModelMixin, collections.ReferenceMixin, collections.RequestIdMixin, collections.CachingMixin);

  exports.MemoryCollection = memory.MemoryCollection.extend4000(collections.Core, collections.ModelMixin);

}).call(this);
