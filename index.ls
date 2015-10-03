require! {
  subscriptionman2
  async
  underscore: _
  helpers: h
  'validator2-extras': Validator
  'backbone4000': Backbone
}
v = Validator.v

_.extend exports, require('./remotemodel')
RemoteModel = exports.RemoteModel

settings = exports.settings = {}
settings.model = {}


Core = exports.Core = Backbone.Model.extend4000 do
  initialize: ->
    @settings = _.extend {}, settings, @settings, @get('settings')

# this can be mixed into a RemoteCollection or Collection itself
# it adds findModel method that automatically instantiates propper models for query results depeding on the _t property
ModelMixin = exports.ModelMixin = Backbone.Model.extend4000 do
  initialize: ->
    @models = {}

  defineModel: (name,...superclasses,definition) ->
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

  findModels: (pattern,limits,callback,callbackDone) ->
    @find(pattern,limits,
      (err,entry) ~>
        if err then return callback(err)
        else callback(err, @modelFromData(entry))
      callbackDone)

  findModel: (pattern,callback) ->
    @findOne pattern, (err,entry) ~>
      if (not entry or err)
        callback(err)
      else
        callback(err, @modelFromData(entry))

  fcall: (name,args,pattern,realm,callback,callbackMulti) ->
    @findModel pattern, (err,model) ->
      if model then model.remoteCallReceive name, args, realm, callback, callbackMulti
      else callback 'model not found'



RemoteInterfaceMixin = exports.RemoteInterfaceMixin = Backbone.Model.extend4000 do
  initialize: ->
    @permissions = {}

    parsePermissions = (permissions) ~> 
      if permissions then def = false else def = true      

      parsePermission = (permission) ->
        switch x = permission?@@
          | undefined => def
          | Boolean   => permission
          | Object    => h.dictMap(permission, (value, key) -> if key isnt 'chew' then v value else value)
          | otherwise => throw "I don't know what to do with this " + permission

          
      keys = { +find, +findOne, +call, +create, +remove, +update }
      
      h.dictMap keys, (val, key) ->
        permission = permissions[key]
        if permission?constructor is Array
          res = _.map permission, parsePermission
          console.log "RES", key, permissions[key], res
          return res
        else return parsePermission permission

     
    @permissions = parsePermissions _.extend {}, (@permissions or {}), (@get('permissions') or {})
    
    console.log @name(), @permissions

  applyPermissions: (permissions, msg, realm, cb) -> 
    if permissions.constructor isnt Array then return @applyPermission(permissions,msg,realm,cb)
    async.series(
      _.map(permissions, (permission) ~> (cb) ~>
        @applyPermission permission, msg, realm, (err,data) ->
          cb(data,err)),
      (data,err) ->
        if not data then cb "Access Denied - Multi"
        else cb undefined, data
      )
        
  applyPermission: (permission, msg, realm, cb) ->
    switch x = permission?@@
      | undefined => cb "Access Denied - No Perm"
      | Boolean   =>
        if permission then cb void, msg
        else cb "Access Denied - Forbidden " + permission
      | Object    =>

        checkRealm = (realm, cb) -> 
          if permission.realm? then permission.realm.feed realm, cb 
          else _.defer -> cb void, msg

        checkValue = (msg, cb) -> 
          if permission.value? then permission.value.feed msg, cb
          else _.defer -> cb void, msg

        checkChew = (msg,realm, cb) -> 
          if permission.chew? then permission.chew msg, realm, cb
          else _.defer -> cb void, msg
          
        checkRealm realm, (err,data) ->
          if err then return cb "Access Denied - Realm"
          checkValue msg, (err,msg) ->
            if err then return cb "Access Denied - Value"
            checkChew msg, realm, (err,msg) ->
              if err then return cb "Access Denied - Chew"
              cb void, msg            

  # { data: {} }
  rCreate: (realm, msg, callback) -->
    @applyPermissions @permissions.create, msg, realm, (err,msg) ~> 
      if err then return callback(err)
      modelClass = @resolveModel msg
      newModel = new modelClass!      
      newModel.update msg, realm, (err,data) ->
        if err then return callback err
        else model.flush (err) ->
          if err then return callback err
          else model.render realm, (err,data) ->
            if err then return callback err
            else callback void, data
            
      newModel.flush (err,data) -> h.cbc callback, err, data

  # { pattern: {} }
  rRemove: (realm, msg, callback) ->
    return @applyPermissions @permissions.remove, msg, realm, (err, pattern) ~>
      if err then return callback err
      queue = new h.queue size: 3
      @findModels msg, {},
      ((err,model) -> queue.push model.id, (callback) -> model.remove callback),
      ((err,data) -> queue.done callback)


  # { pattern: {}, data: {} }
  rUpdate: (realm, msg, callback) ->
    return @applyPermissions @permissions.update, msg, realm, (err, msg) ~>
      if err then return callback(err)
      queue = new h.queue size: 3
      @findModels(msg.pattern, {}, ((err,model) ->
        queue.push model.id, (callback) ->
          model.update msg.data, realm, (err,data) ~>
            if err then return callback err, data
            model.flush (err) ->
              if err then return callback err
              model.render realm, (err,data) ->
                if err then return callback err
                callback void, data), (-> queue.done callback))
        
  # { pattern: {} }
  rFindOne: (realm, msg, callback) ->
    return @applyPermissions @permissions.findOne, msg, realm, (err,pattern) ~>
      if err then return callback(err)
      @findOne pattern, (err,entry) ~>
        if (not entry or err) then callback(err)
        else
          @modelFromData(entry).render realm, (err,data) ->
            if err then return callback err
            else return callback void, data

  # { pattern: {}, limits: {} } 
  rFind: (realm, msg, callback, callbackDone) ->
    #console.log "APPLYPERM", @name!, @permissions
    return @applyPermissions @permissions.find, msg, realm, (err, msg) ~>
      console.log "FIND AFTERPERM",err,msg
      if err then return callback(err)
      @find(msg.pattern, (msg.limits or {}),
        (err,entry) ~>
          if err then return callback(err)
          @modelFromData(entry).render realm, callback
        callbackDone)

  # { pattern: {}, name: {}, args: [] }
  rCall: (realm, msg, callback, callbackMulti) ->
    return @applyPermissions @permissions.call, msg, realm, (err,msg) ~>
      if err then return callback(err)
      @findModel msg.pattern, (err,model) ->
        if model then model.remoteCallReceive msg.name, msg.args, realm, callback, callbackMulti
        else callback 'model not found'  

subscriptionMan = subscriptionman2.Core.extend4000 subscriptionman2.asyncCallbackReturnMixin, subscriptionman2.simplestMatcher
        
EventMixin = exports.EventMixin = subscriptionMan.extend4000 do
#  remove: (pattern,callback) ->
#    @_super 'remove', pattern, (err,data) ~>
#      if not err then @trigger 'remove', { pattern: pattern }
#      h.cbc callback, err, data

#  update: (filter, update, callback) ->
#    @eventAsync 'update', update, (err,subchanges={}) ~>
#      if err then return h.cbc callback, err        
#      subchanges = _.reduce(subchanges, ((all,data) -> _.extend all, data), {})      
#      @_super 'update', _.extend(data, subchanges), (err,data) -> h.cbc callback, err, data

  create: (data,callback) ->
    @eventAsync 'create', data, (err,subchanges={}) ~>
      if err then return h.cbc callback, err
      subchanges = _.reduce(subchanges, ((all,data) -> _.extend all, data), {})
      if data.id then return h.cbc callback, "can't specify id for new model"
      
      @_super 'create', _.extend(data, subchanges), (err,data) ~>
        h.cbc callback, err, data

# ReferenceMixin can be mixed into a RemoteCollection or Collection itself
# it adds reference functionality

exports.collectionDict = {} # global dict holding all collections.. nasty but required to resolve references, shouldn't be global in theory but I can't invision the need to communicate multiple databases with same collection names right now.

UnresolvedRemoteModel = exports.UnresolvedRemoteModel = Backbone.Model.extend4000 do
  toString: -> "unresolved model #{@id} of collection #{@collection.name()}"
  
  initialize: ->
    @when 'id', (id) ~> @id = id
    @when 'collection', (collection) ~>
      @collection = collection
      @unset 'collection'


  resolve: (callback) ->
    @collection.findOne {id: @get 'id'}, (err,entry) ~>
      if not entry then callback('unable to resolve reference to ' + @get('id') + ' at ' + @collection.get('name'))
      else
        @morph @collection.resolveModel(entry), _.extend(@attributes, entry)
        h.cbc callback, undefined, @

  find: (callback) -> 
    @collection.findModel { id: @get 'id' }, callback
    
  morph: (myclass,mydata) ->
    @__proto__ = myclass::
    _.extend @attributes, mydata
    @initialize()
    @trigger 'resolve'

  del: (callback) -> @trigger 'del', @

  remove: (callback) ->
    @del()
    if @id then @collection.remove {id: id}, h.cb callback else h.cbc callback

  reference: ->
    ref = _.extend {}, @attributes # clone
    ref._r = ref.id
    delete ref.id
    
    ref._c = @collection.name()
    delete ref.collection
    
    ref


ReferenceMixin = exports.ReferenceMixin = Backbone.Model.extend4000 do
  initialize: ->
    @collectionDict = exports.collectionDict
    @when 'name', (name) ~> @collectionDict[name] = @

  getcollection: (name) -> @collectionDict[name]

  # will translate a model to its reference its found in find arguments
  find: (args,limits,callback,callbackDone) ->
    RemoteModel::exportReferences.call RemoteModel::, args, (err,args) ~>
      if err then return callbackDone err
      @_super( 'find', args, limits, callback, callbackDone)

  # will translate a model to its reference its found in findOne arguments
  findOne: (args,callback) ->
    RemoteModel::exportReferences.call RemoteModel::, args, (err,args) ~>
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
RequestIdMixin = exports.RequestIdMixin = Backbone.Model.extend4000 do
  find: (args,limits,callback,callbackDone) ->
    uuid = JSON.stringify { name: @name(), args: args, limits: limits }
    @_super( 'find', args, limits,
      (err,data) ~> callback err, data, uuid
      ~> h.cbc callbackDone, undefined, undefined, uuid
    )

  findOne: (args,callback) ->
    cb = (err,data) ~> callback err, data, JSON.stringify { name: @name(), args: args }
    @_super 'findOne', args, cb


CachingMixin = exports.CachingMixin = Backbone.Model.extend4000 do
  timeout: h.Minute

  initialize: ->
    @cache = {}
    @timeouts = {}

  addToCache: (uuid,result,timeout) ->
    if not timeout then timeout = @timeout
    @cache[uuid] = result

    name = new Date().getTime()

    @timeouts[name] = h.wait timeout, ~>
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

    @_super 'findOne', args, (err,data,uuid) ~>
      reqCache = @addToCache uuid, data
      callback err, data, uuid, reqCache

    return uuid

  find: (args, limits, callback, callbackDone) ->
    if limits.nocache then return @_super 'find', args, limits, callback

    uuid = JSON.stringify { name: @name(), args: args, limits: limits }
    if loadCache = @cache[uuid]
      _.map loadCache, (data) -> callback undefined, data, uuid
      h.cbc callbackDone, undefined, undefined, uuid, loadCache
      return uuid

    cache = []
    fail = false
    @_super('find', args, limits,

      (err,data,uuid) ~>
        if not fail
          if err then fail = true
          else cache.push data

        callback err, data, uuid

      (err, done, uuid) ~>
        reqCache = @addToCache uuid, cache
        h.cbc callbackDone, err, done, uuid, reqCache

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


LiveRemoteModel = RemoteModel.extend4000 do
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

  flush: (...args)->
    if @settings.autoGcollect then @gCollect()
    RemoteModel::flush.apply @, args

  flushStay: (...args) -> RemoteModel::flush.apply @, args

  hold: (callback) ->
    model = @collection.hold @
    callback.call model, -> model.gCollect()

LiveModelMixin = exports.LiveModelMixin = Backbone.Model.extend4000 do
  initialize: -> @liveModels = {}
  modelClass: LiveRemoteModel

  hold: (model) ->
    if liveModel = @liveModels[model.id] then liveModel.newRef()
    else
      #console.log ">>>> liveModel: #{@name()} #{model.id} -- HOLD"

      liveModel = @liveModels[model.id] = model.newRef()
      liveModel.once 'gCollect', ~>
        delete @liveModels[model.id]
      liveModel.trigger 'live'
      liveModel
  
  modelFromData: (entry) ->
    if liveModel = @liveModels[entry.id] then liveModel
    else ModelMixin::modelFromData.call @, entry

exports.classical = Core.extend4000 ModelMixin, ReferenceMixin, RequestIdMixin, CachingMixin


