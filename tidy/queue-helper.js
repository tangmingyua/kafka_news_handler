'use strict'
const settings = require('../settings'+(process.env.profile?'-'+process.env.profile:'')+'.json');
const Queue = require('bee-queue');
const logger = require('../lib/LogUtil.js').logger;
const fs = require('fs');
const mongo = require('../lib/mongo-ndbc.js');
let col = new mongo.MongoCollection(settings['mongo_connect_url'], 'complete_articles_process', 10);

// const defaultQueueSettings = {
//     prefix: 'bq',
//     stallInterval: 5000,
//     redis: settings['queue_db'],
//     getEvents: true,
//     isWorker: true,
//     sendEvents: true,
//     removeOnSuccess: true,
//     catchExceptions: false
// };

var queue_dict = {};

const createQueue = (name, next) => {
    let nQueue = new Queue(name);
    nQueue.on('succeeded', function (job, result) {
        let cost = 0;
        if(job.data && job.data.created)cost = new Date().getTime() - job.data.created;
        logger.debug(`finish ${name} job(${job.id}), job(${job.data.key}),cost: ${cost}ms`);
        logger.ua(`finish ${name} job(${job.id}), job(${job.data.key}),cost: ${cost}ms`,{"ukey":job.data.key,"level":"info","project":"queue-success"});
        if(job.data && !job.data.drop){
            if(next){
                if(typeof next == 'string'){
                    result['created'] = new Date().getTime();
                    createJob(next, result);
                }else if(typeof next == 'function'){
                    next(null, result);
                }
            }
        } else {
            logger.warn(`drop ${name} job(${job.id}),job(${job.data.key})`);
            var out = fs.appendFile( __dirname+'/../logs/drop-key.txt',`${job.data.key};\n`,'utf-8',function(err){
                if(err){
                    logger.error(`${job.data.key}`+'append failed');
                }
            });
        }
    });

    nQueue.on('error', function (err) {
        logger.error(`${name} Error: ${err.message}`);//,err.stack
    });

    return nQueue;
}

const getQueue = (name, next, override) =>{
    if(!override && queue_dict.hasOwnProperty(name))return queue_dict[name];
    else{
        let q = createQueue(name, next);
        queue_dict[name] = q;
        return q;
    }
}

const createJob = (queue_name, job_data, callback) => {
    let q =  getQueue(queue_name);
    let job = q.createJob(job_data);
    col.update(job.data.key+""+job.id, {
        "ukey":job.data.key,
        "job_id":job.id,
        "process":["create"]
    }, false, true, (err, ret) => {
    });

    job.on('succeeded', function (result) {
        logger.info(queue_name + ' job ' + job.id + ' succeeded'+': '+job.data.key);
        col.update(job.data.key+""+job.id, {"$push":{"process":"success"}}, false, true, (err, ret) => {
        });
    });

    job.on('failed', function (err) {
        logger.error(queue_name + ' job ' + job.id + ' failed');
    });

    job.timeout(120000).retries(0).save((err,job)=>{
        if(callback)callback();
    });
}

const queueChain = (arr, callback) => {
    for(let i=0; i < arr.length; i++){
        getQueue(arr[i], i<arr.length-1 ? arr[i+1] : callback, true);
    }
}

const startWorker = (queue_name, conncurrency, settings, processer) => {
    let q = getQueue(queue_name);
    //q.on('ready', function () {
        q.process(conncurrency||1, (job,done)=>{
            processer(settings, job, done);
        });
        logger.info(`Start ${conncurrency} workers for ${queue_name}`);
    //});

}

module.exports = {
    'getQueue' : getQueue,
    'createJob' : createJob,
    'queueChain' : queueChain,
    'startWorker' : startWorker
}
