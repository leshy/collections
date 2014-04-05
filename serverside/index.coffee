_ = require 'underscore'
mongo = require './mongodb'
_.extend exports, collections = require '../index'
exports.remotemodel = remotemodel = require '../remotemodel'

remotemodel.settings.storePermissions = true

exports.MongoCollection = mongo.MongoCollection.extend4000 collections.ModelMixin, collections.ReferenceMixin, collections.RequestIdMixin, collections.CachingMixin


