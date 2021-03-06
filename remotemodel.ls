  Backbone = require 'backbone4000'
_ = require 'underscore'
h = require 'helpers'
Validator = require 'validator2-extras'; v = Validator.v; Select = Validator.Select
async = require 'async'
collections = require './index'
subscriptionman2 = require 'subscriptionman2'

sman = subscriptionman2.Core.extend4000 subscriptionman2.asyncCallbackReturnMixin, subscriptionman2.simplestMatcher

exports.definePermissions = definePermissions = (f) ->
  ret = { read: {}, write: {}, exec: {} }

  defPerm = (type, names, permissions) -->
    h.mIter names, (name) ->
      h.mIter permissions, (perm) ->
        h.dictpush ret[type], name, perm
        
  f defPerm('read'), defPerm('write'), defPerm('exec')

  return ret

SaveRealm = exports.SaveRealm = new Object()

# defines which writes/fcalls to a model are allowed
# and optionally parses the input data somehow (chew function)
# permission can behave differently depending on a particular state of a model
# (optional matchModel validator)
Permission = exports.Permission = Validator.ValidatedModel.extend4000 do
  initialize: -> if chew = @get 'chew' then @chew = chew
  
  match: (model, value, attribute, realm, callback) ->
    matchModel = v(@get('matchModel') or @matchModel)
    matchValue = v(@get('matchValue') or @matchValue)
    matchRealm = v(@get('matchRealm') or @matchRealm)

    if (not matchModel) and (not matchRealm) and (not matchValue) then return callback undefined, value
    #console.log 'applying permission for', attribute, value
    async.series {
      matchRealm: (callback) ~>
        if not (validator = matchRealm) then callback()
        else validator.feed realm, callback
      matchModel: (callback) ~>
        if not (validator = matchModel) then callback()
        else validator.feed model.attributes, callback
      matchValue: (callback) ~>
        if not (validator = matchValue) then callback()
        else validator.feed value, callback
    }, (err,data) ~>
      if err then return callback err
      if data.matchValue then value = data.matchValue

      if chew = @get('chew') or chew = @chew
        chew.call model, value, attribute, realm, (err,newValue) ->
          if err then callback err
          else callback undefined, newValue
      else
        callback undefined, value

# knows about its collection, knows how to store/create itself and defines the permissions
#
# it logs changes of its attributes (localCallPropagade)
# and when flush() is called it will call its collection and provide it with its changed data (update or create request depending if the model already exists in the collection)
#
# it will also subscribe to changes to its id on its collection, so it will update itself (remoteChangeReceive) with remote data
#
# it also has localCallPropagade and remoteCallReceive for remote function calling
RemoteModel = exports.RemoteModel = sman.extend4000 do

  initialize: ->
    @settings = _.extend {}, @settings, @get('settings')

    @when 'collection', (collection) ~>
      @unset 'collection'
      @collection = collection
      @settings = _.extend @settings, @collection.settings?.model

    # once the object has been saved, we can request a subscription to its changes (this will be automatic for in the future)
    @when 'id', (id) ~>
      @id = id
      if @autosubscribe or @settings.autosubscribe then @subscribeModel()

    @on 'change', (model,data) ~>
      @localChangePropagade(model,data)
      @trigger 'anychange'
      #@trigger 'anychange:... ' blah, later

    # convert all references to actual unresolvedRemoteModels (see index.coffee)
    @importReferences @attributes, (err,data) ~> @attributes = data

    # if we haven't been saved yet (no id), we want to flush all our attributes when flush is called..
    if @get 'id' then @changes = {} else @changes = h.dictMap(@attributes, -> true)

  refresh: (callback) ->
    @collection.findModel {id: @id}, (err,model) ->
      callback.apply model, [err,model]
#    @collection.findOne { id: @id }, (err,data) ~>
#      if err then return callback err
#      _.extend @attributes, data
#      _.map @attributes, (value,key) ~> if not data[key] then delete @attributes[key] # is there a nicer way to do this?
#      callback(null, @)

  subscribeModel: ->
    sub = (id) ~>
      if not @collection.subscribeModel then return
      @trigger 'subscribeModel'
      @_unsub = @collection.subscribeModel id, (change) ~> @remoteChangeReceive(change)
      @once 'del', ~> @unsubscribeModel()

    if not @id then @when 'id', (id) sub(id) else sub(@id) # wait for id?

  unsubscribeModel: ->
    if not @_unsub then throw "can't unsubscribe this model. it's not subscribed yet"
    @_unsub()
    @trigger 'unsubscribeModel'

  # get a reference for this model
  reference: (id=@get 'id') -> { _r: id, _c: @collection.name() }

  depthfirst: (callback,target=attributes) ->
    if target.constructor is Object or target.constructor is Array
      target = _.clone target
      for key of target
        target[key] = @depthfirst callback, target[key]
      target
    else if response = callback(target) then response else target

  # clone - do I change the original object or do I create one of my own?
  # all - do I call your changef for each object/array or only for attributes?
  asyncDepthfirst: (changef, callback, clone=false, all=false, target=@attributes,depth=0) ->
    _check = (target,callback) -> h.forceCallback changef, target, callback
    _digtarget = (target,callback) ~>
      bucket = new h.parallelBucket()

      for key of target
        if target[key]
          cb = bucket.cb()
          result = (err,data) -> target[key] = data; cb(err,data)
          @asyncDepthfirst changef, result, clone, all, target[key], depth + 1

      bucket.done (err,data) -> callback(err,target)

    prevtarget = target

    if target.constructor is Object or target.constructor is Array
      if clone then target = _.clone target
      if all then _check target, (err,target) ~>
        if err then target = prevtarget # check function can throw
        if target.constructor is Object or target.constructor is Array then _digtarget(target,callback) else callback(undefined,target)
      else _digtarget(target,callback)
    else
      _check target, callback

  remoteChangeReceive: (change) ->
    @changed = true
    switch change.action
      when 'update' then @importReferences change.update, (err,data) ~>

        @set data, { silent: true }

        h.dictMap data, (value,key) ~>
          @trigger 'remotechange:' + key, @, value
          @trigger 'anychange:' + key, @, value

        @trigger 'remotechange'
        @trigger 'anychange'

      #when 'update' then @set change.update, { silent: true }
      when 'remove' then @del()

  # I need to find nested models here and replace them with their ids
  localChangePropagade: (model,data) ->
    change = model.changedAttributes()
    delete change.id
    _.extend @changes, h.dictMap(change, -> true)
    # flush call would go here if it were throtteled properly and if autoflush is enabled

  # mark some attributes as dirty (to be saved)
  # needs to be done explicitly when changing dictionaries or arrays in attributes as change() won't catch this
  # or you can call set _clone(property)
  dirty: (...args) -> @touch.apply @, args

  touch: (...args) ->
    _.each args, (attribute) ~>
      @changes[attribute] = true
      @trigger 'change:' + attribute, @, @get(attribute)

  localCallPropagade: (name,args,callback) ->
    @collection.fcall name, args, { id: @id }, callback

  remoteCallReceive: (name,args,realm,callback,callbackMulti) ->
    @applyPermission @permissions.exec[name], args, realm, (err, args, permission) ~>
      if err then return callback err
      @[name].apply @, args.concat callback, callbackMulti

  update: (data, realm, callback) ->
    console.log "UPDATE CALLED WITH",data
    @applyPermissions @permissions.write, data, realm, true, (err,data) ~>
      if err then return h.cbc callback, err, data
      @importReferences data, (err,data) ~> 
        @set(data)
        h.cbc callback, err, data

  applyPermissions: (permissions, attrs, realm, strict, cb) ->
#    if permissions.constructor isnt Array then return @applyPermission permissions, attrs, realm, cb

    afterPerm = {}
    async.series _.map attrs, ((attr,val) ->
      (callback) ->
        console.log "APPLY PERM FOR ", attr, permission[attr], "TO", val
        @applyPermission permission[attr], val, realm, (err,data) ->
          console.log "RES",err,data
          if err then if strict then return callback "Access Denied to #{attr}: " + err
          else afterPerm[attr] = data), (err,data) ->
            if err then return callback err
            else return callback undefined, afterPerm
        
          
  applyPermission: (permission, msg, realm, cb) ->
    switch x = permission?@@
      | undefined => cb "Access Denied - No Perm"
      | Boolean   =>
        if permission then cb void, msg
        else cb "Access Denied - Forbidden " + permission
      | Object    =>

        checkRealm = (realm, cb) -> 
          if permission.realm? then permission.realm.feed realm, cb 
          else cb void, msg

        checkSelf = (cb) ~>  
          if permission.self? then permission.self.feed @, cb 
          else cb!

        checkValue = (msg, cb) -> 
          if permission.value? then permission.value.feed msg, cb
          else cb void, msg

        checkChew = (msg,realm, cb) -> 
          if permission.chew? then console.log "GOT CHEW!",msg; permission.chew msg, realm, cb
          else cb void, msg

        checkRealm realm, (err,data) ~> 
          if err then return cb "Access Denied - Realm"
          checkSelf (err,data) ~> 
            if err then return cb "Access Denied - Self"
            checkValue msg, (err,msg) ~> 
              if err then return cb "Access Denied - Value"
              checkChew.call @, msg, realm, (err,msg) -> 
                if err then return cb "Access Denied - Chew"
                cb void, msg            


  # looks for references to remote models and replaces them with object ids
  # what do we do if a reference object is not flushed? propagade flush call for now
  exportReferences: (data=@attributes,callback) ->
    # finds a reference to remotemodel, and converts it to saveable reference in a form of a small json that points to the correct collection and id
    _matchf = (value,callback) ->
      if value instanceof RemoteModel
        # has a child model been flushed?
        if id = value.get('id') then callback undefined, value.reference(id)
        else # if not, flush it, and then create a proper reference
          value.flush (err,id) ->
          if err then h.cbc callback, err,id
          else h.cbc callback, undefined, value.reference(id)
        return undefined
      else if value instanceof collections.UnresolvedRemoteModel
        value.reference()
      else
        if typeof value is 'object' and value.constructor isnt Object then throw "something weird is in my attributes"
        value # we can also return a value, and not call the callback, as this function gets wrapped into h.forceCallback
    @asyncDepthfirst _matchf, callback, true, false, data

  importReferences: (data,callback) ->
    _import = (reference) -> true # instantiate an unresolved reference, or the propper model, with an unresolved state.

    _resolve_reference = (ref) ~>
      if not targetcollection = @collection.getcollection(ref._c) then throw 'unknown collection "' + ref._c + '"'
      else targetcollection.unresolved(ref)

    refcheck = v _r: "String", _c: "String"

    _matchf = (value,callback) ->
      try
        refcheck.feed value, (err,data) ->
          if err then return callback undefined, value
          else return callback undefined, _resolve_reference(value)
      catch error
        console.log "CATCH ERR",error, value # investigate this, validator shouldn't throw
        callback undefined, value

      return undefined
    @asyncDepthfirst _matchf, callback, true, true, data

  # simplified for now, will reintroduce when done
  # with model syncing
  # throttle decorator makes sure that we can apply bunch of changes in a series to an object, but the system requests a sync only once.
  # flush: decorate( decorators.MakeDecorator_Throttle({ throttletime: 1 }), (callback) -> @flushnow(callback) )

  flush: (callback) ->
    changes = {}
    _.map @changes, (value,property) ~> changes[property] = @attributes[property]
    changesBak = {}
    @changes = {}

    continue1 = (err,subchanges) ~>
      if err? then return callback err
      subchanges = _.reduce(subchanges, ((all,data) -> _.extend all, data), {})

      _.extend changes, subchanges
      @exportReferences changes, (err, changes) ~>
        if h.isEmpty(changes) then return h.cbc callback
        if not id = @get 'id' then @collection.create changes, (err,data) ~>
          if err
            @changes = changesBak
            return h.cbc callback, err
          _.extend @attributes, _.extend(subchanges,data)
          @trigger 'change:id', @, data.id # when 'id' should trigger

          h.cbc callback, err, _.extend(subchanges, data)

          @collection.eventAsync 'postCreate', @
#          @eventAsync 'post_create', @
        else
          #console.log 'calling update',changes
          @collection.update { id: id }, changes, (err,data) ~>
            if err then @changes = changesBak
            else
              @render {}, changes, (err,data) ~>
                if not err then @collection.trigger 'update', _.extend({id: id}, data)

            return h.cbc callback, err, data

    if @get 'id' then @eventAsync 'update', changes, continue1
    else @eventAsync 'create', changes, continue1

  render: (realm, data, callback) ->
    if data.constructor is Function
      callback = data
      data = @attributes
    @exportReferences data, (err,data) ~>
      @applyPermissions (@permissions?.read or true), data, realm, false, (err,data) ->
        callback err,data

  del: (callback) -> @trigger 'del', @

  unsubscribe: -> true

  getResolve: (attribute, cb) ->
    model = @get attribute
    if model?.resolve then model.resolve cb
    else _.defer -> h.cbc cb, undefined, model

  mapResolve: (attribute, cb) ->
    models = @get attribute
    _.each models, (model) ->
      if model?.resolve then model.resolve cb
      else _.defer -> h.cbc cb, undefined, model


  remove: (callback) ->
    @del()
    if not id = @get 'id' then return h.cbc callback
    @collection.remove { id: id }, callback
    @collection.trigger 'remove', id: id
