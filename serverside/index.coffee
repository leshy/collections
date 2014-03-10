
collections = require '../index'
mongo = require './mongodb'

remotemodel = require '../remotemodel'

remotemodel.settings.autosubscribe = false

exports.MongoCollection = mongo.MongoCollection.extend4000 collections.ModelMixin, collections.ReferenceMixin, collections.RequestIdMixin
