'use strict'
var settings = require('../settings'+(process.env.profile?'-'+process.env.profile:'')+'.json');
const LoggerBase = require('./LoggerBase.js');
LoggerBase.init_log(settings);
const logger = LoggerBase.getLogger();
exports.logger = logger;