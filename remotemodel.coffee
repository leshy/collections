Backbone = require 'backbone4000'
_ = require 'underscore'
helpers = require 'helpers'
Validator = require 'validator2-extras'; v = Validator.v; Select = Validator.Select
decorators = require 'decorators2'; decorate = decorators.decorate;
async = require 'async'
collections = require './index'
subscriptionman2 = require 'subscriptionman2'

sman = subscriptionman2.Core.extend4000 subscriptionman2.asyncCallbackReturnMixin, subscriptionman2.simplestMatcher

settings = exports.settings = {}

exports.definePermissions = definePermissions = (f) ->
    permissions = {}
    
    defattr = (name, permission) ->
        if not permissions[name] then permissions[name] = []
        permissions[name].push permission

    deffun = defattr
            
    f(defattr, deffun)

    permissions

SaveRealm = exports.SaveRealm = new Object()

# defines which writes/fcalls to a model are allowed
# and optionally parses the input data somehow (chew function)
# permission can behave differently depending on a particular state of a model
# (optional matchModel validator)
Permission = exports.Permission = Validator.ValidatedModel.extend4000
    initialize: -> if chew = @get 'chew' then @chew = chew
    chew: (value,data,callback) -> callback null, value
    match: (model,realm,callback) ->
        matchModel = @get 'matchModel'
        matchRealm = @get 'matchRealm'
        if not matchModel and not matchRealm then return callback()
        async.series [
            (callback) =>
                if not (validator = @get 'matchModel') then callback()
                else v(validator).feed model.attributes, callback
            (callback) =>
                if not (validator = @get 'matchRealm') then callback()
                else v(validator).feed realm, callback
        ], callback

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
        # this is temporary, permission system will make sure that this is never exported
        @when 'collection', (collection) =>
            @unset 'collection'
            @collection = collection

        # once the object has been saved, we can request a subscription to its changes (this will be automatic for in the future)
        @when 'id', (id) =>
            @id = id
            if exports.settings.autosubscribe then @subscribeModel id
                
        @on 'change', (model,data) =>
            @localChangePropagade(model,data)
            @trigger 'anychange'
            #@trigger 'anychange:... ' blah, later

        # convert all references to actual unresolvedRemoteModels (see index.coffee)            
        @importReferences @attributes, (err,data) => @attributes = data

        # if we haven't been saved yet (no id), we want to flush all our attributes when flush is called..
        if @get 'id' then @changes = {} else @changes = helpers.dictMap(@attributes, -> true)

    subscribeModel: (id) ->
        sub = =>
            if not @collection.subscribeModel then return
            #console.log "subscribemodel", @collection.get('name'), id, @get('name')
            @unsubscribe = @collection.subscribeModel id, @remoteChangeReceive.bind(@)
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
            
                helpers.dictMap change.update, (value,key) =>
                    @trigger 'remotechange:' + key, value
                    @trigger 'anychange:' + key, value
                    
                @trigger 'remotechange'
                @trigger 'anychange'

            #when 'update' then @set change.update, { silent: true }
            
            #when 'remove' then @del()
            
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
        
    remoteCallReceive: (name,args,realm,callback) ->
        if realm then @applyPermission name, args, realm, (err,args) =>
            if err then callback(err); return
            @[name].apply @, args.concat(callback)
        else
            @[name].apply @, args.concat(callback)

    update: (data,realm,callback) ->
        if not realm then @set(data)
            
        else @applyPermissions data, realm, (err,data) =>
            if err then return helpers.cbc callback, err, data
            @set(data)
            helpers.cbc callback, err, data

    applyPermissions: (attrs,realm,callback) ->
        self = @
        async.parallel helpers.dictMap(attrs, (value,attribute) => (callback) => @getPermission(attribute,realm,callback)), (err,permissions) ->
            if err then return callback "permission denied for attribute" + (if err.constructor is Object then "s " + _.keys(err).join(', ') else " " + err)
            async.parallel helpers.dictMap(permissions, (permission,attribute) -> (callback) -> permission.chew(attrs[attribute], { model: self, realm: realm, attribute: attribute }, callback)), callback

    # why not just use applyPermissions with one key value pair in data?
    applyPermission: (attribute,value,realm,callback) ->
        @getPermission attribute, realm, (err,permission) =>
            if err then helperc.cbc callback, err
            permission.chew value, { model: @, realm: realm, attribute: attribute }, callback

    # will find a first permission that matches this realm for this attribute and return it
    getPermission: (attribute,realm,callback) ->
        model = @
        if not attributePermissions = @permissions?[attribute] then return callback attribute + " (not defined)"
        async.series _.map(attributePermissions, (permission) -> (callback) -> permission.match(model, realm, (err,data) -> if not err then callback(permission) else callback() )), (permission) ->
            if permission then callback(undefined,permission) else callback(attribute)

    # looks for references to remote models and replaces them with object ids
    # what do we do if a reference object is not flushed? propagade flush call for now
    exportReferences: (data,callback) ->
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
    flush: (callback) ->
        @flushnow(callback)

    flushnow: (callback) ->
        changes = helpers.hashfilter @changes, (value,property) => @attributes[property]
        @changes = {}


        if settings.storePermissions
            @applyPermissions changes, exports.StoreRealm, (err,data) =>
                if not err then @set(data) else return helpers.cbc callback, err

        continue1 = (err,subchanges) =>
            if err? then return callback err
            subchanges = _.reduce(subchanges, ((all,data) -> _.extend all, data), {})

            _.extend changes, subchanges
            
            @exportReferences changes, (err, changes) =>
                if helpers.isEmpty(changes) then helpers.cbc(callback); return
                if not id = @get 'id' then @collection.create changes, (err,data) =>
                    _.extend @attributes, _.extend(subchanges,data)
                    helpers.cbc callback, err, _.extend(subchanges, data)
                    @eventAsync 'post_create', @
                    
                else
                    @collection.update { id: id }, changes, helpers.cb callback

        if @get 'id' then @eventAsync 'update', changes, continue1
        else @eventAsync 'create', changes, continue1
    # this will have to go through some kind of READ permissions in the future..
    render: (realm, callback) ->
        @exportReferences @attributes, (err,data) ->
            callback(err,data)

    del: (callback) -> @trigger 'del', @

    unsubscribe: -> true
    
    remove: (callback) ->
        @del()
        if id = @get 'id' then @collection.remove {id: id}, helpers.cb callback else helpers.cbc callback
    
