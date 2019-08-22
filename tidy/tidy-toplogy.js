const fs = require('fs');
const path = require('path');
const async = require('async');
const logger = require('../lib/LogUtil.js').logger;
const queueHelper = require('./queue-helper.js');
const spout = require('./task/spout.js');
const reaper = require('./task/reaper.js');
const CONNCURRENCY = 10;

const start = (settings) => {
    let dir = path.resolve(__dirname, 'task');
    fs.readdir(dir, function(err, items) {
        let fitems = items.filter(itm => {
            return itm.endsWith('.js') && !itm.includes('spout') && !itm.includes('reaper');
        });
        fitems.sort();
        let queues = fitems.map(itm => {
            return itm.replace('.js', '');
        });
        queueHelper.queueChain(queues, (err, result) => {
            reaper.execute(err, settings, result);
        });

        async.mapLimit(
            fitems,
            10,
            (itm, next) => {
                let workNumber = itm.includes('singleton') ? 1 : CONNCURRENCY;
                let workModule = require('./task/' + itm);
                queueHelper.startWorker(itm.replace('.js', ''), workNumber, settings, workModule.execute);
                if (workModule.hasOwnProperty('init')) { //init module if module defined init method
                    workModule.init(settings, _ => {
                        next();
                    });
                } else next();
            },
            _ => {
                spout.start(settings, queues[0]);
            }
        );
    });
}

if (module.parent) {
    exports.start = start;
} else {
    let settings = require('../settings' + (process.env.profile ? '-' + process.env.profile : '') + '.json');
    settings.logger = logger;
    start(settings);
}