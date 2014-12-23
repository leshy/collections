BSON = require('mongodb').BSONPure
Validator = require 'validator2-extras'; v = Validator.v; Select = Validator.Select
Backbone = require 'backbone4000'
helpers = require 'helpers'
_ = require 'underscore'

MongoCollection = exports.MongoCollection = Backbone.Model.extend4000
    validator: v( db: 'instance' )
    
    initialize: ->
        @collection = @get('collection') or @get('name')
        if @collection.constructor is String then @get('db').collection @collection, (err,collection) => @set { collection: @collection = collection }
        if not @get 'name' then @set { name: @collection.collectionName };

    create: (entry,callback) ->
        entry = _.extend({}, entry) # mongodb api will automatically append _.id to this dict, I want to avoid this..
        @collection.insert(entry,(err,data) ->
            console.log 'mongodb create', entry
            if (data?[0]._id)
                data = { id: String(data[0]._id) };
            callback err, data)
        
    # replaces a potential string id with BSON.ObjectID
    patternIn: (pattern) ->
        pattern = _.extend {},pattern
        if pattern.id? then pattern._id = pattern.id; delete pattern.id
        if pattern._id?.constructor is String then pattern._id = new BSON.ObjectID(pattern._id)
        pattern
        
    patternOut: (pattern) ->
        if not pattern then return pattern
        pattern = _.extend {},pattern
        if pattern._id? then pattern.id = String(pattern._id); delete pattern._id
        pattern
    
    find: (pattern,limits,callback,callbackDone) ->
        @collection.find @patternIn(pattern), limits, (err,cursor) =>
            cursor.each (err,entry) =>
                if not entry then return callbackDone()
#                console.log 'got model', @patternOut(entry)
                callback err, @patternOut(entry)
    
    findOne: (pattern,callback) ->
        @collection.findOne @patternIn(pattern), (err,entry) =>
            callback undefined, @patternOut(entry)

    remove: (pattern,callback) ->
        @collection.remove @patternIn(pattern), helpers.cb(callback)

    update: (pattern,update,callback) ->
        set = {}
        unset = {}
        _.map update, (value,key) -> if value is undefined or null then unset[key] = true else set[key] = value
        
        update = {}
        
        if not helpers.isEmpty(set) then update['$set'] = set
        if not helpers.isEmpty(unset) then update['$unset'] = unset
        console.log 'mongodb update', @patternIn(pattern), update
        @collection.update @patternIn(pattern), update, callback

