Validator = require 'validator2-extras'; v = Validator.v; Select = Validator.Select
Backbone = require 'backbone4000'
helpers = require 'helpers'
_ = require 'underscore'
async = require 'async'

MemoryCollection = exports.MemoryCollection = Backbone.Model.extend4000
    initialize: ->
        @idCnt = 1
        @collection = {}

    getId: -> String(@idCnt++)
    
    create: (entry,callback) ->
        entry.id = id = @getId()
        @collection[id] = entry
        helpers.cbc callback, null, entry

    find: (pattern, limits = {}, callbackData, callbackDone) ->
        pattern = v(pattern)

        # totally not eficient because Im converting dict to array, but I don't feel like implementing my proper async function now, async.eachSeries should be able to iterate through dict too.
        async.eachSeries _.values(@collection), ((entry, callback) ->
            pattern.feed entry, (err,data) ->
                if not err then callbackData undefined, data
                callback()), ->
                    helpers.cbc callbackDone
        
    findOne: (pattern,callbackFound) ->
        console.log ':: findOne', pattern        
        pattern = v(pattern)

        values = _.values(@collection)
        if not values.length then return callbackFound()
        async.eachSeries values, ((entry, callback) ->
            pattern.feed entry, (err,data) ->
                if not err
                    helpers.cbc callbackFound, undefined, data
                    return callback(true)
                    
                callback()), (err,data) ->
                    if not err then callbackFound()
                        
    remove: (pattern, callback) ->
        console.log ':: remove', pattern
        @find pattern, {}, 
            ((err,data) =>
                delete @collection[data.id]), -> callback()
                    
            

    update: (pattern,update,callback) -> 
        console.log 'update!',pattern,update
