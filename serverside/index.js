// Generated by CoffeeScript 1.9.1
(function() {
  var _, collections, memory, mongo, remotemodel;

  _ = require('underscore');

  mongo = require('./mongodb');

  memory = require('./memory');

  _.extend(exports, collections = require('../index'));

  exports.remotemodel = remotemodel = require('../remotemodel');

  exports.MongoCollection = mongo.MongoCollection.extend4000(collections.Core, collections.ModelMixin, collections.ReferenceMixin, collections.RequestIdMixin);

  exports.MemoryCollection = memory.MemoryCollection.extend4000(collections.Core, collections.ModelMixin);

}).call(this);
