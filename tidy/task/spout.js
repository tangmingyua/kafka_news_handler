const kafka = require('../../lib/Kafka');
const queueHelper = require('../queue-helper.js');

exports.start = (settings, firstQueue) => {
	let logger = settings.logger;

	const onMessage = msg=>{
		console.log(typeof msg);
		let job_data = msg;
		queueHelper.createJob(firstQueue, job_data,_=>{
			//logger.debug('emit a job from spout');
		});
	}
	kafka.consumerGroup1.on("message", onMessage);
	kafka.consumerGroup2.on("message", onMessage);
	kafka.consumerGroup3.on("message", onMessage);//使用group避免其中有挂掉
}
