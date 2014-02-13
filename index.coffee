Backbone = require 'backbone4000'
_ = require 'underscore'
helpers = require 'helpers'

_.extend exports, require('./remotemodel')
RemoteModel = exports.RemoteModel

# this can be mixed into a RemoteCollection or Collection itself
# it adds findModel method that automatically instantiates propper models for query results
ModelMixin = exports.ModelMixin = Backbone.Model.extend4000
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
        return Backbone.Model
        #throw "unable to resolve " + JSON.stringify(entry) + " " + _.keys(@models).join ", "

    findModels: (pattern,limits,callback,callbackend) ->
        @find pattern,limits,((err,entry) =>
            if not entry? then callback(err) else callback(err, new (@resolveModel(entry))(entry))),callbackend

    findModel: (pattern,callback) ->
        @findOne pattern, (err,entry) =>
            if (not entry? or err) then callback(err) else callback(err, new (@resolveModel(entry))(entry))

    fcall: (name,args,pattern,realm,callback) ->
        @findModel pattern, (err,model) ->
            if model? then model.remoteCallReceive name, args, realm, (err,data) -> callback err, data
            else callback 'model not found'

# ReferenceMixin can be mixed into a RemoteCollection or Collection itself
# it adds reference functionality

exports.collectionDict = {} # global dict holding all collections.. nasty but required to resolve references, shouldn't be global in theory but I can't invision needing to communicate multiple servers with same collection names right now.

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

    unresolved: (id) -> new UnresolvedRemoteModel id: id, collection: @

    name: -> @get 'name'