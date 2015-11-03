Backbone = require 'backbone4000'
_ = require 'underscore'
helpers = require 'helpers'
_.extend exports, require('./remotemodel')
RemoteModel = exports.RemoteModel

subscriptionman2 = require 'subscriptionman2'

settings = exports.settings = {}
settings.model = {}

sman = subscriptionman2.Core.extend4000 subscriptionman2.asyncCallbackReturnMixin, subscriptionman2.simplestMatcher

Core = exports.Core = Backbone.Model.extend4000
  initialize: ->
    @settings = _.extend {}, settings, @settings, @get('settings')

# this can be mixed into a RemoteCollection or Collection itself
# it adds findModel method that automatically instantiates propper models for query results depeding on the _t property
ModelMixin = exports.ModelMixin = sman.extend4000
  initialize: ->
    @models = {}

  defineModel: (name,superclasses...,definition) ->
    if not definition.defaults? then definition.defaults = {}
    definition.defaults.collection = this
    definition.defaults._t = name

    coreModelClass = @modelClass or RemoteModel
    @models[name] = coreModelClass.extend4000.apply coreModelClass, superclasses.concat(definition)

  resolveModel: (entry) ->
    keys = _.keys(@models)
    if keys.length is 0 then throw "I don't have any models defined"
    if keys.length is 1 or not entry._t? then return @models[_.first(keys)]
    if entry._t and tmp = @models[entry._t] then return tmp
    throw "unable to resolve " + JSON.stringify(entry) + " " + _.keys(@models).join ", "

  modelFromData: (entry) ->
    new (@resolveModel(entry))(entry)

  updateModel: (pattern, data, realm, callback) ->
    queue = new helpers.queue size: 3
    @findModels pattern, {}, ((err,model) ->
      queue.push model.id, (callback) ->
        model.update data, realm, (err,data) =>
          if err then return callback err, data
          model.flush (err,fdata) ->
            if not _.keys(data).length then data = undefined
            callback err,data),
      ->
        queue.done callback

  removeModel: (pattern, realm, callback) ->
    queue = new helpers.queue size: 3
    @findModels pattern, {},
    ((err,model) -> queue.push model.id, (callback) -> model.remove callback),
    ((err,data) -> queue.done callback)
    
  createModel: (data, realm, callback) ->
    modelClass = @resolveModel data
    newModel = new modelClass data
    newModel.flush (err,data) -> helpers.cbc callback, err, newModel

  createModel_: (data, realm, callback) ->
    @eventAsync 'create', { data: data, realm: realm }, (err,subchanges={}) =>
      if err then return callback err
      subchanges = _.reduce(subchanges, ((all,data) -> _.extend all, data), {})

      if data.id then return helpers.cbc callback, "can't specify id for new model"
      
      try
        newModel = new (@resolveModel(data))
      catch err
        return helpers.cbc callback, err

      newModel.update data, realm, (err,data) ->
        if err then return helpers.cbc callback, err, data
        newModel.set subchanges
        newModel.flush (err,data) ->
          helpers.cbc callback, err, _.extend(subchanges, data)

  findModels: (pattern,limits,callback,callbackDone) ->
    @find(pattern,limits,
      (err,entry) =>
        if err then return callback(err)
        else callback(err, @modelFromData(entry))
      callbackDone)

  findModel: (pattern,callback) ->
    @findOne pattern, (err,entry) =>
      if (not entry or err)
        callback(err)
      else
        callback(err, @modelFromData(entry))

  fcall: (name,args,pattern,realm,callback,callbackMulti) ->
    @findModel pattern, (err,model) ->
      if model then model.remoteCallReceive name, args, realm, callback, callbackMulti
      else callback 'model not found'

EventMixin = exports.EventMixin = Backbone.Model.extend4000

#  remove: (pattern,callback) ->
#    @_super 'remove', pattern, (err,data) =>
#      if not err then @trigger 'remove', { pattern: pattern }
#      helpers.cbc callback, err, data

#  update: (filter, update, callback) ->
#    @eventAsync 'update', update, (err,subchanges={}) =>
#      if err then return h.cbc callback, err        
#      subchanges = _.reduce(subchanges, ((all,data) -> _.extend all, data), {})      
#      @_super 'update', _.extend(data, subchanges), (err,data) -> helpers.cbc callback, err, data

  create: (data,callback) ->
    @eventAsync 'create', data, (err, subchanges={}) =>
      if err then return h.cbc callback, err
      subchanges = _.reduce(subchanges, ((all,data) -> _.extend all, data), {})
      if data.id then return helpers.cbc callback, "can't specify id for new model"
      
      @_super 'create', _.extend(data, subchanges), (err,data) =>
        helpers.cbc callback, err, data

# ReferenceMixin can be mixed into a RemoteCollection or Collection itself
# it adds reference functionality

exports.collectionDict = {} # global dict holding all collections.. nasty but required to resolve references, shouldn't be global in theory but I can't invision the need to communicate multiple databases with same collection names right now.

UnresolvedRemoteModel = exports.UnresolvedRemoteModel = Backbone.Model.extend4000    
  toString: -> "unresolved model #{@id} of collection #{@collection.name()}"
  
  initialize: ->
    @when 'id', (id) => @id = id
    @when 'collection', (collection) =>
      @collection = collection
      @unset 'collection'


  resolve: (callback) ->
    @collection.findOne {id: @get 'id'}, (err,entry) =>
      if not entry then callback('unable to resolve reference to ' + @get('id') + ' at ' + @collection.get('name'))
      else
        @morph @collection.resolveModel(entry), _.extend(@attributes, entry)
        @trigger 'resolve'
        helpers.cbc callback, undefined, @

  find: (callback) -> 
    @collection.findModel { id: @get 'id' }, callback
    
  morph: (myclass,mydata) ->
    @__proto__ = myclass::
    _.extend @attributes, mydata
    @initialize()

  del: (callback) -> @trigger 'del', @

  remove: (callback) ->
    @del()
    if @id then @collection.remove { id: id }, helpers.cb callback else helpers.cbc callback

  reference: ->
    ref = _.extend {}, @attributes # clone
    ref._r = ref.id
    delete ref.id
    
    ref._c = @collection.name()
    delete ref.collection
    
    ref


ReferenceMixin = exports.ReferenceMixin = Backbone.Model.extend4000
  initialize: ->
    @collectionDict = exports.collectionDict
    @when 'name', (name) => @collectionDict[name] = @

  getcollection: (name) -> @collectionDict[name]

  # will translate a model to its reference its found in find arguments
  find: (args,limits,callback,callbackDone) ->
    RemoteModel::exportReferences.call RemoteModel::, args, (err,args) =>
      if err then return callbackDone err
      @_super( 'find', args, limits, callback, callbackDone)

  # will translate a model to its reference its found in findOne arguments
  findOne: (args,callback) ->
    RemoteModel::exportReferences.call RemoteModel::, args, (err,args) =>
      if err then return callbackDone err
      @_super( 'findOne', args, callback)

  unresolved: (data) ->
    if not data.id and data._r
      data.id = data._r
      delete data._r
      
    delete data._c
    
    new UnresolvedRemoteModel _.extend data, collection: @

  name: -> @get 'name'

# required for caching
RequestIdMixin = exports.RequestIdMixin = Backbone.Model.extend4000
  find: (args,limits,callback,callbackDone) ->
    uuid = JSON.stringify { name: @name(), args: args, limits: limits }
    @_super( 'find', args, limits,
      (err,data) => callback err, data, uuid
      () => helpers.cbc callbackDone, undefined, undefined, uuid
    )

  findOne: (args,callback) ->
    cb = (err,data) => callback err, data, JSON.stringify { name: @name(), args: args }
    @_super 'findOne', args, cb


CachingMixin = exports.CachingMixin = Backbone.Model.extend4000
  timeout: helpers.Minute

  initialize: ->
    @cache = {}
    @timeouts = {}

  addToCache: (uuid,result,timeout) ->
    if not timeout then timeout = @timeout
    @cache[uuid] = result

    name = new Date().getTime()

    @timeouts[name] = helpers.wait timeout, =>
      if @timeouts[name] then delete @timeouts[name]
      if @cache[uuid] then delete @cache[uuid]

    result

  clearCache: ->
    _.map @timeouts, (f,name) -> f()
    @timeouts = {}
    @cache = {}

  findOne: (args, callback) ->
    uuid = JSON.stringify { name: @name(), args: args }
    if loadCache = @cache[uuid]
      callback undefined, loadCache, uuid
      return uuid

    @_super 'findOne', args, (err,data,uuid) =>
      reqCache = @addToCache uuid, data
      callback err, data, uuid, reqCache

    return uuid

  find: (args, limits, callback, callbackDone) ->
    if limits.nocache then return @_super 'find', args, limits, callback

    uuid = JSON.stringify { name: @name(), args: args, limits: limits }
    if loadCache = @cache[uuid]
      _.map loadCache, (data) -> callback undefined, data, uuid
      helpers.cbc callbackDone, undefined, undefined, uuid, loadCache
      return uuid

    cache = []
    fail = false
    @_super('find', args, limits,

      (err,data,uuid) =>
        if not fail
          if err then fail = true
          else cache.push data

        callback err, data, uuid

      (err, done, uuid) =>
        reqCache = @addToCache uuid, cache
        helpers.cbc callbackDone, err, done, uuid, reqCache

      )
    return uuid

  update: (filter,update,callback) ->
    @clearCache()
    @_super 'update', filter, update, callback

  remove: (data,callback) ->
    @clearCache()
    @_super 'remove', data, callback

  create: (data,callback) ->
    @clearCache()
    @_super 'create', data, callback


LiveRemoteModel = RemoteModel.extend4000
  references: 0

  initialize: ->
    @settings = @collection.settings.model or {}
    #console.log ">>>> liveModel: #{@collection.name()} #{@id} wakeup"

  gCollectForce: ->
    @trigger 'gCollectForce'
    @trigger 'gCollect'

  gCollect: ->
    #console.log ">>>> liveModel: #{@collection.name()} #{@id} -- #{@references - 1}"
    if not --@references then @trigger 'gCollect'

  newRef: ->
    @references++
    #console.log ">>>> liveModel: #{@collection.name()} #{@id} ++ #{@references}"
    @

  flush: (args...)->
    if @settings.autoGcollect then @gCollect()
    RemoteModel::flush.apply @, args

  flushStay: (args...) -> RemoteModel::flush.apply @, args

  hold: (callback) ->
    model = @collection.hold @
    callback.call model, -> model.gCollect()

LiveModelMixin = exports.LiveModelMixin = Backbone.Model.extend4000
  initialize: -> @liveModels = {}
  modelClass: LiveRemoteModel

  hold: (model) ->
    if liveModel = @liveModels[model.id] then liveModel.newRef()
    else
      #console.log ">>>> liveModel: #{@name()} #{model.id} -- HOLD"

      liveModel = @liveModels[model.id] = model.newRef()
      liveModel.once 'gCollect', =>
        delete @liveModels[model.id]
      liveModel.trigger 'live'
      liveModel
  
  modelFromData: (entry) ->
    if liveModel = @liveModels[entry.id] then liveModel
    else ModelMixin::modelFromData.call @, entry

exports.classical = Core.extend4000 ModelMixin, ReferenceMixin, RequestIdMixin, CachingMixin


