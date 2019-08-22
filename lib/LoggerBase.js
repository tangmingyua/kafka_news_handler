var logging = require('./logging.js');

var logger;
var init_log = exports.init_log = function(settings){
	var my_child_no = process.env.child_no || 0;
	var service = process.env.service || 'flowtidy';
	var log_level = settings ? settings['log_level'] : 'DEBUG';
	logger = logging.getLogger(service, log_level, my_child_no , settings ? settings['log_appender'] : 111);
};

exports.getLogger = function(){
    if(logger) return logger;
    else {
        console.log('logger init');
        init_log();
        return logger;
    }
};