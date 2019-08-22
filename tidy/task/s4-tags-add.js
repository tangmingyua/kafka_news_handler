/**
 * Created by feheadline on 17-6-15.
 */

const execute = (settings, job, callback)=>{
    callback(null,job.data);
}

exports.execute = execute;
