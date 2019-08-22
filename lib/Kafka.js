const settings = require('../settings-'+(process.env.profile||'dev')+'.json');
var async = require('async');

const kafka = require('kafka-node'),
    Consumer = kafka.Consumer,
    ConsumerGroup = kafka.ConsumerGroup,
    client = new kafka.KafkaClient({
        kafkaHost: settings['kafka']['url']
    }),
    consumer = new Consumer(
        client,
        [
            { topic: 'test'}
        ],
        {
            autoCommit: true,
            fromOffset: false
        }
    );
let consumerOptions = {
    autoCommit: false,
    autoCommitIntervalMs: 1000,
    host: settings['kafka']['url'],
    groupId: 'ExampleTestGroup',
    sessionTimeout: 15000,
    protocol: ['roundrobin'],
    commitOffsetsOnFirstJoin: false
};

let consumerGroup1 = new ConsumerGroup(Object.assign({id: 'consumer1'}, consumerOptions), settings['kafka']['topics']);
let consumerGroup2 = new ConsumerGroup(Object.assign({id: 'consumer2'}, consumerOptions), settings['kafka']['topics']);
let consumerGroup3 = new ConsumerGroup(Object.assign({id: 'consumer3'}, consumerOptions), settings['kafka']['topics']);




exports.consumer = consumer;
exports.consumerGroup1 = consumerGroup1;
exports.consumerGroup2 = consumerGroup2;
exports.consumerGroup3 = consumerGroup3;
