/**
 * logging, winston based
 */
const settings = require('../settings-'+(process.env.profile||'dev')+'.json');
const winston = require('winston');
require('winston-mongodb').MongoDB;
const winston_daily_rotate = require('winston-daily-rotate-file');
const os = require('os');
const fs = require('fs');

const dateFormat = function(date, fmt) {
    var o = {
        "M+": date.getMonth() + 1,
        "d+": date.getDate(),
        "h+": date.getHours(),
        "m+": date.getMinutes(),
        "s+": date.getSeconds(),
        "q+": Math.floor((date.getMonth() + 3) / 3),
        "S": date.getMilliseconds()
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}

const timestamp_fuc = function(){
    return dateFormat(new Date(),'yyyy-MM-dd hh:mm:ss.S');
}

const log_string_formatter = function(options) {
    // Return string will be passed to logger.
    return options.timestamp() +' '+process.pid+' '+ options.level.toUpperCase() +' '+ (undefined !== options.message ? options.message : '') +
        (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
}

const log_json_formatter = function(options) {
    var obj = options.meta||{};
    obj['level'] = options.level.toUpperCase();
    obj['timestamp'] = options.timestamp();
    obj['message'] = options.message||'';
    obj['hostname'] = os.hostname();
    obj['pid'] = process.pid;
    return JSON.stringify(obj);
}

/**
 * logger constructor
 * @param name
 * @param instance
 * @param level
 * @returns {Logger}
 */
exports.getLogger = function(name, level, id, mode) {
    var logConfig = {
        exitOnError: true,
        levels: {
            ua: 0,
            verbose: 7,
            debug: 6,
            info: 5,
            warn: 4,
            error: 3,
            data: 2
        },
        colors: {
            ua: 'white',
            verbose: 'grey',
            debug: 'blue',
            info: 'green',
            warn: 'yellow',
            error: 'red',
            data: 'magenta'
        },
        transports: [
            new winston_daily_rotate({
                name: 'ua',
                timestamp: timestamp_fuc,
//                filename: 'logs/rcmd-'+name+'-'+(arguments.length>=3?id:process.pid)+'.ac.log',
                stream: fs.createWriteStream('logs/flowtidy-'+name+'-'+(arguments.length>=3?id:process.pid)+'.ac.log', { flags: 'a' }),
                datePattern: '.yyyy-MM-dd',
                level: 'data',
                json: false,
                formatter: log_json_formatter
            }),
            new(winston.transports.MongoDB)({
                name: 'article_process_log',
                db: settings['mongo_connect_url'],
                collection: 'article_process_log',
                level: 'ua',
                json:true,
                tryReconnect: true
            })
        ]
    }
    var logger = new(winston.Logger)(logConfig);
    if(arguments.length>=4){
        if(mode % 10 != 0)logger.add(
            winston.transports.Console,
            {
                prettyPrint: true,
                colorize: true,
                silent: false,
                // handleExceptions: false,
                level: level.toLowerCase(),
                timestamp: timestamp_fuc,
                // formatter: log_string_formatter
            }
        );
        if(mode>=110)logger.add(
            winston_daily_rotate,
            {
                name: 'lg',
                timestamp: timestamp_fuc,
                //                filename: 'logs/rcmd-'+name+'-'+(arguments.length>=3?id:process.pid)+'.log',
                stream: fs.createWriteStream('logs/flowtidy-'+name+'-'+(arguments.length>=3?id:process.pid)+'.log', { flags: 'a' }),
                datePattern: '.yyyy-MM-dd',
                level: level.toLowerCase(),
                json: false,
                // handleExceptions: true,
                formatter: log_json_formatter
            }
        );
    }
    return logger;
}
