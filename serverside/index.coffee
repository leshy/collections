_ = require 'underscore'
mongo = require './mongodb'
memory = require './memory'
crypto = require 'crypto'
algorithm = 'aes-256-ctr'

_.extend exports, collections = require '../index'
exports.remotemodel = remotemodel = require '../remotemodel'

Backbone = require 'backbone4000'
helpers = require 'helpers'
_ = require 'underscore'


exports.EncryptedMixin = EncryptedMixin = Backbone.Model.extend4000

  patternIn: (pattern) ->
    pattern = _.clone pattern
    
    try
      if pattern.id? then pattern.id = @decrypt pattern.id
    catch err
      console.log 'cannot decrypt ',pattern._id, err, err.stack
            
    @_super 'patternIn', pattern
    
  patternOut: (pattern) ->
    pattern = @_super 'patternOut', pattern
    if not pattern then return
    pattern = _.clone pattern
    if pattern.id? then pattern.id = @encrypt pattern.id
      
    pattern
    

exports.AesMixin = AesMixin = Backbone.Model.extend4000
  initialize: -> if not @password = @get('password') then throw @name + " need password"
    
  encrypt: (text) ->
    cipher = crypto.createCipher(algorithm,@password)
    crypted = cipher.update(text,'utf8','base64')
    crypted += cipher.final('base64');
    crypted

  decrypt: (text) ->
    decipher = crypto.createDecipher(algorithm,@password)
    dec = decipher.update(text,'base64','utf8')
    dec += decipher.final('utf8');
    dec


#remotemodel.settings.storePermissions = true
#whats up with this clone?, bugfix!

#exports.MongoCollection = mongo.MongoCollection.extend4000 collections.ModelMixin, collections.ReferenceMixin, collections.RequestIdMixin, collections.CachingMixin, collections.EventMixin
#exports.MongoCollection = mongo.MongoCollection.extend4000 _.clone(collections.ModelMixin)


#, collections.CachingMixin
#exports.MemoryCollection = memory.MemoryCollection.extend4000 collections.Core, collections.ModelMixin, collections.ReferenceMixin, collections.RequestIdMixin

exports.MongoCollection = mongo.MongoCollection.extend4000 collections.Core, collections.ModelMixin, collections.ReferenceMixin, collections.RequestIdMixin
#, AesMixin

exports.MemoryCollection = memory.MemoryCollection.extend4000 collections.Core, collections.ModelMixin



