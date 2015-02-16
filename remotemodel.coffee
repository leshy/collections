Backbone = require 'backbone4000'
_ = require 'underscore'
helpers = require 'helpers'
Validator = require 'validator2-extras'; v = Validator.v; Select = Validator.Select
decorators = require 'decorators2'; decorate = decorators.decorate;
async = require 'async'
collections = require './index'
subscriptionman2 = require 'subscriptionman2'

sman = subscriptionman2.Core.extend4000 subscriptionman2.asyncCallbackReturnMixin, subscriptionman2.simplestMatcher

exports.definePermissions = definePermissions = (f) ->
    permissions = { read: {}, write: {}, execute: {} }
    
    defPerm = (perm, name, permission) ->
        if not permissions[perm][name] then permissions[perm][name] = []
        permissions[perm][name].push permission

    write = (name, permission) -> defPerm 'write', name, permission
    read = (name, permission) -> defPerm 'read', name, permission
    execute = (name, permission) -> defPerm 'execute', name, permission # query - callback
    
    f(write, execute, read)

    permissions

SaveRealm = exports.SaveRealm = new Object()


# defines which writes/fcalls to a model are allowed
# and optionally parses the input data somehow (chew function)
# permission can behave differently depending on a particular state of a model
# (optional matchModel validator)
Permission = exports.Permission = Validator.ValidatedModel.extend4000
    initialize: -> if chew = @get 'chew' then @chew = chew
    chew: (value,data,callback) -> callback null, value
    match: (model, value, attribute, realm, callback) ->
        matchModel = @get('matchModel') or @matchModel
        matchValue = @get('matchValue') or @matchValue
        matchRealm = @get('matchRealm') or @matchRealm
        if not matchModel and not matchRealm and not matchValue then return callback undefined, value
        async.series {
            matchRealm: (callback) =>
                if not (validator = matchRealm) then callback()
                else v(validator).feed realm, callback
            matchModel: (callback) =>
                if not (validator = matchModel) then callback()
                else v(validator).feed model.attributes, callback
            matchValue: (callback) =>
                if not (validator = matchValue) then callback()
                else v(validator).feed value, callback
        }, (err,data) =>
            if err then return callback err
            if data.matchValue then value = data.matchValue
            
            if chew = @get 'chew' or chew = @chew
                chew.call model, value, attribute, realm, (err,newValue) ->
                    if err then return callback err else callback null, newValue
            else
                callback null, value


# knows about its collection, knows how to store/create itself and defines the permissions
#
# it logs changes of its attributes (localCallPropagade) 
# and when flush() is called it will call its collection and provide it with its changed data (update or create request depending if the model already exists in the collection)
#
# it will also subscribe to changes to its id on its collection, so it will update itself (remoteChangeReceive) with remote data
#
# it also has localCallPropagade and remoteCallReceive for remote function calling 
RemoteModel = exports.RemoteModel = Validator.ValidatedModel.extend4000 sman,
    validator: v { collection: 'instance' }

    initialize: ->
        @settings = _.extend {}, @settings, @get('settings')
        
        @when 'collection', (collection) =>
            @unset 'collection'
            @collection = collection
            @settings = _.extend @settings, @collection.settings?.model

        # once the object has been saved, we can request a subscription to its changes (this will be automatic for in the future)
        @when 'id', (id) =>
            @id = id
            if @autosubscribe or @settings.autosubscribe then @subscribeModel id
        
        @on 'change', (model,data) =>
            @localChangePropagade(model,data)
            @trigger 'anychange'
            #@trigger 'anychange:... ' blah, later

        # convert all references to actual unresolvedRemoteModels (see index.coffee)            
        @importReferences @attributes, (err,data) => @attributes = data

        # if we haven't been saved yet (no id), we want to flush all our attributes when flush is called..
        if @get 'id' then @changes = {} else @changes = helpers.dictMap(@attributes, -> true)

    refresh: (callback) ->
        @collection.findModel {id: @id}, (err,model) ->
            callback.apply model, [err,model]
#        @collection.findOne { id: @id }, (err,data) =>
#            if err then return callback err
#            _.extend @attributes, data
#            _.map @attributes, (value,key) => if not data[key] then delete @attributes[key] # is there a nicer way to do this?
            
#            callback(null, @)

    subscribeModel: (id) ->
        sub = =>
            if not @collection.subscribeModel then return
            @unsubscribe = @collection.subscribeModel id, (change) => @remoteChangeReceive(change)
            @once 'del', => @unsubscribeModel()

        if not id then @when 'id', (id) sub() else sub() # wait for id?
    
    unsubscribeModel: () -> true
    
    # get a reference for this model
    reference: (id=@get 'id') -> { _r: id, _c: @collection.name() }

    depthfirst: (callback,target=@attributes) ->
        if target.constructor is Object or target.constructor is Array
            target = _.clone target
            for key of target
                target[key] = @depthfirst callback, target[key]
            target
        else if response = callback(target) then response else target

    # clone - do I change the original object or do I create one of my own?
    # all - do I call your changef for each object/array or only for attributes?
    asyncDepthfirst: (changef, callback, clone=false, all=false, target=@attributes,depth=0) ->
#        if target is @attributes then console.log 'DF',JSON.stringify(@attributes)
        #spaces = ""
        #_.times depth, -> spaces+= " "
        # call changef on the target, return results
        _check = (target,callback) -> helpers.forceCallback changef, target, callback
        # recursively search through an iterable target
        _digtarget = (target,callback) =>
            bucket = new helpers.parallelBucket()
            
            for key of target
                if target[key]
                    cb = bucket.cb()
                    result = (err,data) -> target[key] = data; cb(err,data)
                    @asyncDepthfirst changef, result, clone, all, target[key], depth + 1
                
            bucket.done (err,data) -> callback(err,target)
            
        prevtarget = target
        
        if target.constructor is Object or target.constructor is Array
            if clone then target = _.clone target
            if all then _check target, (err,target) =>
                if err then target = prevtarget # check function can throw
                if target.constructor is Object or target.constructor is Array then _digtarget(target,callback) else callback(undefined,target)
            else _digtarget(target,callback)
        else
            _check target, callback

    remoteChangeReceive: (change) ->
        switch change.action
            when 'update' then @importReferences change.update, (err,data) =>
                
                @set data, { silent: true }
            
                helpers.dictMap data, (value,key) =>
                    @trigger 'remotechange:' + key, value
                    @trigger 'anychange:' + key, value
                    
                @trigger 'remotechange'
                @trigger 'anychange'

            #when 'update' then @set change.update, { silent: true }
            when 'remove' then @del()
            
    # I need to find nested models here and replace them with their ids
    localChangePropagade: (model,data) ->
        change = model.changedAttributes()
        delete change.id
        _.extend @changes, helpers.dictMap(change, -> true)
        # flush call would go here if it were throtteled properly and if autoflush is enabled

    # mark some attributes as dirty (to be saved)
    # needs to be done explicitly when changing dictionaries or arrays in attributes as change() won't catch this
    # or you can call set _clone(property)
    dirty: (attribute) -> @changes[attribute] = true
    touch: (attribute) -> @changes[attribute] = true

    localCallPropagade: (name,args,callback) ->
        @collection.fcall name, args, { id: @id }, callback
        
    remoteCallReceive: (name,args,realm,callback,callbackMulti) ->
        @applyPermission 'execute', name, args, realm, (err,args,permission) =>
            if err then callback(err); return
            @[name].apply @, args.concat(callback,callbackMulti)
            
    update: (data,realm,callback) ->
        @applyPermissions 'write', data, realm, (err,data) =>
            if err then return helpers.cbc callback, err, data
            @set(data)
            helpers.cbc callback, err, data

    applyPermissions: (type, attrs, realm, callback, strictPerm=true) ->
        if strictPerm
            async.series helpers.dictMap(attrs, (value, attribute) => (callback) => @applyPermission(type,attribute, value, realm, callback)), callback
        else
            async.series helpers.dictMap(attrs, (value, attribute) => (callback) => @applyPermission(type,attribute, value, realm, (err,data) -> callback null, data)), (err,data) ->
                callback undefined, helpers.dictMap data, (x) -> x

    # will find a first permission that matches this realm for this attribute and return it
    applyPermission: (type,attribute,value,realm,callback) ->
        model = @
        if not attributePermissions = @permissions?[type][attribute] then return callback "access denied (#{attribute})"

        async.mapSeries attributePermissions, ((permission,callback) ->
            permission.match model, value, attribute, realm, (err,value) -> callback(value,err)),
            (value, err) ->
                err = _.last(err)
#                if err then console.log "permission denied: ",err
                if err or not value then callback 'access denied' else callback null, value
            
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
                    if err then callback(err,id)
                    else callback undefined, value.reference(id)
                return undefined
            else if value instanceof collections.UnresolvedRemoteModel
                value.reference()
            else
                if typeof value is 'object' and value.constructor isnt Object then throw "something weird is in my attributes"
                value # we can also return a value, and not call the callback, as this function gets wrapped into helpers.forceCallback
        @asyncDepthfirst _matchf, callback, true, false, data

    importReferences: (data,callback) ->
        _import = (reference) -> true # instantiate an unresolved reference, or the propper model, with an unresolved state.
        
        _resolve_reference = (ref) =>
            if not targetcollection = @collection.getcollection(ref._c) then throw 'unknown collection "' + ref._c + '"'
            else targetcollection.unresolved(ref._r)
        
        refcheck = v { _r: "String", _c: "String" }
        
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
    flush: (callback) -> @flushnow(callback)

    flushnow: (callback) ->
        changes = {}
        _.map @changes, (value,property) => changes[property] = @attributes[property]
        changesBak = {}
        @changes = {}
        
        if @settings.storePermissions
            @applyPermissions 'write', changes, exports.StoreRealm, (err,data) =>
                if not err then @set(data) else return helpers.cbc callback, err

        continue1 = (err,subchanges) =>
            if err? then return callback err
            subchanges = _.reduce(subchanges, ((all,data) -> _.extend all, data), {})

            _.extend changes, subchanges
            
            @exportReferences changes, (err, changes) =>
                if helpers.isEmpty(changes) then return helpers.cbc callback
                if not id = @get 'id' then @collection.create changes, (err,data) =>
                    if err
                        @changes = changesBak
                        return helpers.cbc callback, err
                        
                    _.extend @attributes, _.extend(subchanges,data)
                    @trigger 'change:id', @, data.id # when 'id' should trigger

                    helpers.cbc callback, err, _.extend(subchanges, data)

                    @render {}, (err,data) => if not err then @collection.trigger 'create', data
                    @eventAsync 'post_create', @
                else
                    @collection.update { id: id }, changes, (err,data) =>
                        if err then @changes = changesBak
                        else @render {}, changes, (err,data) =>
                            if not err then @collection.trigger 'update', _.extend({id: id}, changes)
                            
                        return helpers.cbc callback, err, data

        if @get 'id' then @eventAsync 'update', changes, continue1
        else @eventAsync 'create', changes, continue1

    render: (realm, data, callback) ->
        if data.constructor is Function
            callback = data
            data = @attributes
            
        @exportReferences data, (err,data) =>
            @applyPermissions('read',
                data,
                realm,
                ((err,data) -> callback err,data),
                false)

    del: (callback) -> @trigger 'del', @

    unsubscribe: -> true
    
    remove: (callback) ->
        @del()
        if not id = @get 'id' then return helpers.cbc callback
        
        @collection.remove { id: id }
        @collection.trigger 'remove', id: id
        