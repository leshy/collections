collections = require './collections'
mongo = require './serverside/mongodb'

exports.mongo =
    setUp: (callback) ->
        @mongo = require 'mongodb'
        @collection = mongo.MongoCollection.extend4000 collections.ReferenceMixin, collections.ModelMixin
        @db = new @mongo.Db('testdb',new @mongo.Server('localhost',27017), {safe: true });
        @db.open callback
        @c = new @collection { db: @db, collection: 'test' }

    tearDown: (callback) ->
        @db.close()
        callback()

    basics: (test) ->
        model = @c.defineModel 'testmodel', bla: 3
        a = new model()
        a.set something: 666
        
        a.flush =>
            @c.findModel id: a.id, (err,model) =>
                test.equals model.get('something'), 666
                model.del =>
                    @c.findModel id: a.id, (err,model) =>
                        test.equals model,undefined
                        test.done()
