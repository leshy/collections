_ = require 'underscore'
mongo = require './mongodb'
_.extend exports, collections = require '../index'
exports.remotemodel = remotemodel = require '../remotemodel'

#remotemodel.settings.storePermissions = true

#whats up with this clone?, bugfix!

#exports.MongoCollection = mongo.MongoCollection.extend4000 collections.ModelMixin, collections.ReferenceMixin, collections.RequestIdMixin, collections.CachingMixin, collections.EventMixin
exports.MongoCollection = mongo.MongoCollection.extend4000 collections.Core, collections.ModelMixin, collections.ReferenceMixin, collections.RequestIdMixin
#exports.MongoCollection = mongo.MongoCollection.extend4000 _.clone(collections.ModelMixin)

