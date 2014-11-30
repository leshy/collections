Backbone = require 'backbone4000'
_ = require 'underscore'
helpers = require 'helpers'
_.extend exports, require('./remotemodel')
RemoteModel = exports.RemoteModel
subscriptionman2 = require 'subscriptionman2'

settings = exports.settings = {}

sman = subscriptionman2.Core.extend4000 subscriptionman2.asyncCallbackReturnMixin, subscriptionman2.simplestMatcher

# this can be mixed into a RemoteCollection or Collection itself
# it adds findModel method that automatically instantiates propper models for query results depeding on the _t property
ModelMixin = exports.ModelMixin = sman.extend4000
    initialize: ->
        @models = {}

    defineModel: (name,superclasses...,definition) ->
        if not definition.defaults? then definition.defaults = {}
        definition.defaults.collection = this
        definition.defaults._t = name
        @models[name] = RemoteModel.extend4000.apply RemoteModel, superclasses.concat(definition)
        
    resolveModel: (entry) ->
        keys = _.keys(@models)
        if keys.length is 0 then throw "I don't have any models defined"
        if keys.length is 1 or not entry._t? then return @models[_.first(keys)]
        if entry._t and tmp = @models[entry._t] then return tmp
        throw "unable to resolve " + JSON.stringify(entry) + " " + _.keys(@models).join ", "

    updateModel: (pattern, data, realm, callback) ->        
        queue = new helpers.queue size: 3        
        @findModels pattern, {}, (err,model) ->
            queue.push model.id, (callback) ->
                model.update data, realm, (err,data) =>
                    if err then return callback err, data
                    model.flush (err,fdata) ->
                        if not _.keys(data).length then data = undefined
                        callback err,data
                    
        queue.done callback


    removeModel: (pattern, callback) ->
        queue = new helpers.queue size: 3        
        @findModels pattern, {},
        ((err,model) ->
            queue.push model.id, (callback) -> model.remove callback),
        ((err,data) ->
            queue.done callback )
            
    createModel: (data,realm,callback) ->
        @eventAsync 'create', { data: data, realm: realm }, (err,subchanges={}) =>
            if err then return callback err
            subchanges = _.reduce(subchanges, ((all,data) -> _.extend all, data), {})

            if data.id then return callback "can't specify id for new model"
                            
            try
                newModel = new (@resolveModel(data))
            catch err
                return callback err

            newModel.update data, realm, (err,data) ->
                if err then return callback err,data
                newModel.set subchanges
                newModel.flush (err,data) -> callback err, _.extend(subchanges, data)

    findModels: (pattern,limits,callback,callbackDone) ->
        @find(pattern,limits,
            (err,entry) =>
                if err then return callback(err)
                else callback(err, new (@resolveModel(entry))(entry))
            callbackDone)

    findModel: (pattern,callback) ->
        @findOne pattern, (err,entry) =>
            if (not entry or err) then callback(err) else callback(err, new (@resolveModel(entry))(entry))

    fcall: (name,args,pattern,realm,callback) ->
        @findModel pattern, (err,model) ->
            if model then model.remoteCallReceive name, args, realm, (err,data) -> callback err, data
            else callback 'model not found'

# ReferenceMixin can be mixed into a RemoteCollection or Collection itself
# it adds reference functionality

exports.collectionDict = {} # global dict holding all collections.. nasty but required to resolve references, shouldn't be global in theory but I can't invision the need to communicate multiple databases with same collection names right now.

UnresolvedRemoteModel = exports.UnresolvedRemoteModel = Backbone.Model.extend4000
    collection: undefined
    id: undefined
    
    toString: -> 'unresolved model ' + @get('id') + ' of collection ' + @get('collection').name()

    resolve: (callback) ->
        collection = @get 'collection'
        collection.findOne {id: @get 'id'}, (err,entry) =>
            if not entry then callback('unable to resolve reference to ' + @get('id') + ' at ' + collection.get('name'))
            else
                @morph collection.resolveModel(entry), _.extend(@attributes, entry)
                helpers.cbc callback, undefined, @
                
    morph: (myclass,mydata) ->
        @__proto__ = myclass::
        @set mydata
        @initialize()

    del: (callback) ->
        @trigger 'del', @

    remove: (callback) ->
        @del()
        if id = @get 'id' then @collection.remove {id: id}, helpers.cb callback else helpers.cbc callback
          
    reference: -> { _r: @get('id'), _c: @get('collection').name() }


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


    unresolved: (id) -> new UnresolvedRemoteModel id: id, collection: @

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
#        console.log "stringify request", name: @name(), args
        cb = (err,data) => callback err, data, JSON.stringify { name: @name(), args: args }
        @_super 'findOne', args, cb


CachingMixin = exports.CachingMixin = Backbone.Model.extend4000
    timeout: helpers.Minute
    
    initialize: ->
        @cache = {}
        @timeouts = {}
        
    addToCache: (uuid,result,timeout) ->
        if not timeout then timeout = @timeout
#        console.log "adding to cache",uuid
        @cache[uuid] = result
        
        name = new Date().getTime()
        
        @timeouts[name] = helpers.wait timeout, =>
#            console.log "deleting from cache", uuid
            if @timeouts[name] then delete @timeouts[name]
            if @cache[uuid] then delete @cache[uuid]

        result
        
    clearCache: ->
        _.map @timeouts, (f,name) -> f()
        @timeouts = {}
        @cache = {}

    findOne: (args, callback) ->
#        console.log("will cache stringify", @name(), args);
        uuid = JSON.stringify { name: @name(), args: args }
#        console.log("pass 1")
        if loadCache = @cache[uuid]
#            console.log "FINDONE CACHE  #{ uuid }"
            callback undefined, loadCache, uuid
            return uuid

#        console.log "FINDONE REQUEST    #{ uuid }"
        @_super 'findOne', args, (err,data,uuid) =>
            reqCache = @addToCache uuid, data
            callback err, data, uuid, reqCache
            
        return uuid

    find: (args, limits, callback, callbackDone) ->
        if limits.nocache then return @_super 'find', args, limits, callback
#        console.log("will cache stringify", @name(), args, limits);
        uuid = JSON.stringify { name: @name(), args: args, limits: limits }
#        console.log("pass 1")
        if loadCache = @cache[uuid]
#            console.log "FIND CACHE      #{ uuid }"
            _.map loadCache, (data) -> callback undefined, data, uuid
            helpers.cbc callbackDone, undefined, undefined, uuid, loadCache
            return uuid
            
#        console.log "FIND REQUEST    #{ uuid }"
                                                
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

exports.classical = Backbone.Model.extend4000 ModelMixin, ReferenceMixin, RequestIdMixin, CachingMixin
