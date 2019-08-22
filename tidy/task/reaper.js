const mongo = require('../../lib/mongo-ndbc.js');
const kafka = require('../../lib/Kafka');


exports.execute = (err, settings, result)=>{
    let col = new mongo.MongoCollection(settings['mongo_connect_url'], 'test', 10);

    col.save({doc:result}, (err,ret)=>{
        kafka.consumerGroup1.commit((err,result)=>{
            console.log(err,result)
        })
    });

}
