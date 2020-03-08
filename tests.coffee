collections = require './index'


exports.mongo =
    setUp: (callback) ->
        mongodb = require 'mongodb'
        mongo = require './serverside/mongodb'
        
        @collection = mongo.MongoCollection.extend4000 collections.ReferenceMixin, collections.ModelMixin
        @db = new mongodb.Db('testdb',new mongodb.Server('localhost',27017), {safe: true });
        @db.open callback
        @c = new @collection { db: @db, collection: 'test' }

    tearDown: (callback) ->
#        @db.close()
        callback()

    fancy: (test) ->
        model = @c.defineModel 'testmodel', bla: 3
        a = new model()
        a.set something: 666
        
        a.flush (err,data) =>
            @c.findModel id: a.id, (err,model) =>
                test.equals model.get('something'), 666
                model.remove =>
                    @c.findModel { id: a.id }, (err,model) =>
                        test.equals model, undefined
                        test.done()

exports.memory =
    setUp: (callback) ->
        memory = require './serverside/memory'
        @collection = memory.MemoryCollection.extend4000 collections.ModelMixin
        @c = new @collection()
        callback()
        
    
    basics: (test) ->
        @c.create { bla: 666, x: 3 }
        @c.create { bla: 614, x: 2 }
        @c.create { bla: 88, x: 3 }

        test.deepEqual @c.collection, { '1': { bla: 666, x: 3, id: '1' }, '2': { bla: 614, x: 2, id: '2' }, '3': { bla: 88, x: 3, id: '3' } }

        found = []

        @c.find { x: 3 }, {}, ((err,data) ->
            test.equals err, undefined
            found.push data), ->
                test.deepEqual found, [ { bla: 666, x: 3, id: 1 },  { bla: 88, x: 3, id: 3 } ]
                test.done()

    fancy: (test) ->
        model = @c.defineModel 'testmodel', bla: 3
        a = new model()
        a.set something: 666

        a.flush (err,data) =>
            @c.findModel id: a.id, (err,model) =>
                test.equals model.get('something'), 666
                model.remove =>
                    @c.findModel { id: a.id }, (err,model) =>
                        test.equals model, undefined
                        test.done()




    