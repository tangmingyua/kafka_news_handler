'use strict'
/**
 * Created by Cherokee on 16-3-9.
 * Usage: 
 * const col = new mongo.MongoCollection(settings['mongo_connect_url'], 'collection_name', settings['mongo_pool_size']);
 * col.find(query,fields,sort,pagesize,pagenum,finalCallback)
 * col.aggregate(query,finalCallback)
 * col.get(id,incrementField,increment,finalCallback)
 * col.findOne(id,fields,finalCallback)
 * col.increment(id,incrementField,increment,finalCallback)
 * col.update(id,document,overide,upsert,finalCallback)
 * col.remove(id,finalCallback)
 * col.save(document,finalCallback)
 */
var async = require('async');
var mongo = require('mongodb');
var poolModule = require('generic-pool');

var pools = {};

/**
 * get pool from system pools
 * @param  {[type]} mongo_connect_url [description]
 * @param  {[type]} mongo_pool_size   [description]
 * @return {[type]}                   [description]
 */
var getPool = function(mongo_connect_url, mongo_pool_size){
    if(pools.hasOwnProperty(mongo_connect_url)){
        // console.log(`get ${mongo_connect_url} from pools`);
        return pools[mongo_connect_url];
    }else{
        // console.log(`new pool for ${mongo_connect_url}`);
        var pool = poolModule.Pool({
                name     : mongo_connect_url,
                create   : function(callback) {
                    mongo.MongoClient.connect(mongo_connect_url, {
                        server:{poolSize:1}
                    }, function(err,db){
                        callback(err,db);
                    });
                },
                destroy  : function(db) { db.close(); },
                max      : mongo_pool_size,
                idleTimeoutMillis : 30000,
                log : false
            });
        pools[mongo_connect_url] = pool;
        return pool;
    }
}

/**
 * Mongo collection class
 * @type {[type]}
 */
exports.MongoCollection = class  {

    constructor(mongo_connect_url, mongo_collection, mongo_pool_size){
        this.mongo_connect_url = mongo_connect_url;
        this.mongo_pool_size = mongo_pool_size||100;
        this.mongo_collection = mongo_collection;
    }

    getOwnPoll(){
        return getPool(this.mongo_connect_url, this.mongo_pool_size);
    }

    generateObjectId(idstr){
        return new mongo.ObjectID(idstr);
    }

    /**
     * query documents
     * @param  {[type]} query         [description]
     * @param  {[type]} fields        [description]
     * @param  {[type]} sort          [description]
     * @param  {[type]} pagesize      [description]
     * @param  {[type]} pagenum       [description]
     * @param  {[type]} finalCallback [description]
     * @return {[type]}               [description]
     */
    find(query,fields,sort,pagesize,pagenum,finalCallback){
        let self = this;
        let NOTHING = {
            'count' : 0,
            'pagesize':0,
            'pagenum':0,
            'list':[]
        };
        async.waterfall(
            [
                function(callback){
                    self.getOwnPoll().acquire(function(err, db) {
                        if(err){
                            self.getOwnPoll().release(db);
                            finalCallback(NOTHING);
                            return;
                        } else {
                            callback(null,db);
                        }
                    });
                }
                ,
                function(db,callback){
                    db.collection(self.mongo_collection).count(query, function(err, count) {
                        if(err){self.getOwnPoll().release(db);finalCallback(NOTHING);return;}
                        else callback(null,db,count);
                    });
                }
                ,
                function(db,count,callback){
                    var skipNumber =  pagesize * (pagenum - 1);
                    var project = {};
                    if(fields){
                        if(Array.isArray(fields)){
                            fields.forEach(f=>{
                                project[f] = 1;
                            });
                        }else project = fields;
                    }
                    var sorts = [];
                    if(sort){
                        if(Array.isArray(sort))sorts = sort;
                        else {
                            for(let k in sort){
                                if(sort.hasOwnProperty(k))sorts.push([k,sort[k]]);
                            }
                        }
                    }
                    db.collection(self.mongo_collection).find(query).project(project).sort(sorts).skip(skipNumber).limit(pagesize).toArray(function(err, docs) {
                        self.getOwnPoll().release(db);
                        callback(err,err?NOTHING:{
                            'count' : count,
                            'pagesize':pagesize,
                            'pagenum':pagenum,
                            'list':docs
                        });
                    });
                }
           ],
           function (err, result) {
            finalCallback(result);
            }
        );
    }

    /**
     * aggregate
     * @param  {[type]} query         [description]
     * @param  {[type]} finalCallback [description]
     * @return {[type]}               [description]
     */
    aggregate(query,finalCallback){
        let self = this;
        let NOTHING = [];
        async.waterfall(
            [
                function(callback){
                    self.getOwnPoll().acquire(function(err, db) {
                        if(err){
                            self.getOwnPoll().release(db);
                            finalCallback(NOTHING);
                            return;
                        } else {
                            callback(null,db);
                        }
                    });
                }
                ,
                function(db,callback){
                    db.collection(self.mongo_collection).aggregate(query).toArray(function(err, docs) {
                        self.getOwnPoll().release(db);
                        callback(err,err?NOTHING:docs);
                    });
                }
           ],
           function (err, result) {
            finalCallback(result);
            }
        );
    }

    /**
     * get one record, specify fields
     * @param  {[object or string]} id            [id or query condition]
     * @param  {[array ]} fields        [return fields]
     * @param  {[function]} finalCallback [call back function]
     * @return {[none]}               [callback]
     */
    get(id,fields,finalCallback){
        let self = this;
        let NOTHING = {};
        async.waterfall([
            function(callback){
                self.getOwnPoll().acquire(function(err, db) {
                    if(err){
                        self.getOwnPoll().release(db);
                        finalCallback(NOTHING);
                        return;
                    } else {
                        callback(null,db);
                    }
                });
            }
            ,
            function(db,callback){
                var query_cond;
                if(typeof id == 'object')query_cond = id;
                else{
                    var objectId = id;
                    if(/^[0-9a-z]{24}$/ig.test(id))objectId = new mongo.ObjectID(id);
                    query_cond = {_id:objectId}
                }
                var options = {};
                if(fields)options['fields'] = fields;
                db.collection(self.mongo_collection).findOne(query_cond, options, function(err, document) {
                    self.getOwnPoll().release(db);
                    callback(err,document?(document.value||document):NOTHING);
                });
            }
        ], function (err, result) {
            finalCallback(result);
        });
    }
    /**
     * just increment field value
     * @param  {[type]} id             [description]
     * @param  {[type]} incrementField [description]
     * @param  {[type]} increment      [description]
     * @param  {[type]} finalCallback  [description]
     * @return {[type]}                [description]
     */
    increment(id,incrementField,increment,finalCallback){
        let self = this;
        let NOTHING = 0;
        async.waterfall([
            function(callback){
                self.getOwnPoll().acquire(function(err, db) {
                    if(err){
                        self.getOwnPoll().release(db);
                        finalCallback(NOTHING);
                        return;
                    } else {
                        callback(null,db);
                    }
                });
            }
            ,
            function(db,callback){
                var objectId = id;
                if(/^[0-9a-z]{24}$/ig.test(id)){objectId = new mongo.ObjectID(id);}

                var incrementObj = {};
                incrementObj[incrementField] = increment;
                var updateObj = {'$inc':incrementObj}

                db.collection(self.mongo_collection).update({_id:objectId},updateObj,{'w': 1},function(err, result){
                    self.getOwnPoll().release(db);
                    callback(err,result||NOTHING);
                });
            }
        ], function (err, result) {
            finalCallback(err,result);
        });
    }
    /**
     * update documents
     * @param  {[type]} id            [description]
     * @param  {[type]} document      [description]
     * @param  {[type]} overide       [description]
     * @param  {[type]} upsert        [description]
     * @param  {[type]} finalCallback [description]
     * @return {[type]}               [description]
     */
    update(id,document,overide,upsert,finalCallback){
        let self = this;
        let NOTHING = 0;
        async.waterfall([
            function(callback){
                self.getOwnPoll().acquire(function(err, db) {
                    if(err){
                        self.getOwnPoll().release(db);
                        finalCallback(NOTHING);
                        return;
                    } else {
                        callback(null,db);
                    }
                });
            }
            ,
            function(db,callback){
                var objectId = id;
                if(/^[0-9a-z]{24}$/ig.test(id)){objectId = new mongo.ObjectID(id);}
                delete document['_id'];

                var updateObj = {'$set':document}
                if(overide==true){
                    updateObj = document;
                }
                db.collection(self.mongo_collection).update({_id:objectId},updateObj,{'upsert':upsert,'w': 1},function(err, result){
                    self.getOwnPoll().release(db);
                    callback(err,result||NOTHING);
                });
            }
        ], function (err, result) {
            finalCallback(err,result);
        });
    }
    /**
     * remove document
     * @param  {[type]} id            [description]
     * @param  {[type]} finalCallback [description]
     * @return {[type]}               [description]
     */
    remove(id,finalCallback){
        let self = this;
        let NOTHING = 0;
        async.waterfall([
            function(callback){
                self.getOwnPoll().acquire(function(err, db) {
                    if(err){
                        self.getOwnPoll().release(db);
                        finalCallback(NOTHING);
                        return;
                    } else {
                        callback(null,db);
                    }
                });
            }
            ,
            function(db,callback){
                var objectId = id;
                if(/^[0-9a-z]{24}$/ig.test(id))objectId = new mongo.ObjectID(id);
                db.collection(self.mongo_collection).remove({_id:objectId},{'w': 1},function(err, result){
                    self.getOwnPoll().release(db);
                    callback(err,result||NOTHING);
                });
            }
        ], function (err, result) {
            finalCallback(result);
        });
    }
    /**
     * Just save document
     * @param  {[type]} document      [description]
     * @param  {[type]} finalCallback [description]
     * @return {[type]}               [description]
     */
    save(document,finalCallback){
        let self = this;
        let NOTHING = 0;
        async.waterfall([
            function(callback){
                self.getOwnPoll().acquire(function(err, db) {
                    if(err){
                        self.getOwnPoll().release(db);
                        finalCallback(NOTHING);
                        return;
                    } else {
                        callback(null,db);
                    }
                });
            }
            ,
            function(db,callback){
                db.collection(self.mongo_collection).insert(document,{'w': 1},function(err, result){
                    self.getOwnPoll().release(db);
                    callback(err,result||NOTHING);
                });
            }
        ], function (err, result) {
            finalCallback(err,result);
        });
    }
}
