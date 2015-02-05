_ = require 'underscore'
mongo = require './mongodb'
memory = require './memory'
_.extend exports, collections = require '../index'
exports.remotemodel = remotemodel = require '../remotemodel'

#remotemodel.settings.storePermissions = true

#whats up with this clone?, bugfix!

#exports.MongoCollection = mongo.MongoCollection.extend4000 collections.ModelMixin, collections.ReferenceMixin, collections.RequestIdMixin, collections.CachingMixin, collections.EventMixin
#exports.MongoCollection = mongo.MongoCollection.extend4000 _.clone(collections.ModelMixin)

 
exports.MongoCollection = mongo.MongoCollection.extend4000 collections.Core, collections.ModelMixin, collections.ReferenceMixin, collections.RequestIdMixin
#exports.MemoryCollection = memory.MemoryCollection.extend4000 collections.Core, collections.ModelMixin, collections.ReferenceMixin, collections.RequestIdMixin

exports.MemoryCollection = memory.MemoryCollection.extend4000 collections.Core, collections.ModelMixin


