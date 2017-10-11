var gutil = require('gulp-util');
var fs = require('fs');
var objectPath = require('object-path');

var models = noSlash(gutil.env.models || 'ts');

module.exports = {
    readConfigFile: function () {
        if (gutil.env.config) {
            var config = fs.readFileSync(gutil.env.config);
            var configObj = JSON.parse(config);
            for (var prop in configObj) {
                if (!gutil.env[prop]) {
                    gutil.env[prop] = configObj[prop];
                }
            }
        }
    },
    enrichWithParams: function (target) {
        for (var prop in gutil.env) {
            objectPath.set(target, prop, gutil.env[prop]);
        }
        return target;
    },
    api: function () {
        return noSlash(gutil.env.api || 'openapi/api.yaml');
    },
    models: function (dir) {
        if (dir) {
            models = dir;
        }
        return models;
    },
    port: function () {
        return gutil.env.port || 8333;
    },
    javaPackage: function () {
        return gutil.env.javaPackage;
    },
    dependencyPath: function () {
        return gutil.env.dependencyPath || 'node_modules/$api-dependencies';
    },
    deploy: function () {
        return gutil.env.deploy && gutil.env.deploy === 'true'
    },
    serve: function () {
        return !gutil.env.serve || gutil.env.serve !== 'false';
    },
    openBrowser: function () {
        return !gutil.env.openBrowser || gutil.env.openBrowser !== 'false';
    }
};

function noSlash(s) {
    if (!s){
        return s;
    }
    var first = s.substring(0, 1);
    s = (first === '/' || first === '\\') ? s.substring(1) : s;
    var last = s.substring(s.length - 1);
    return (last === '/' || last === '\\') ? s.substring(0, s.length - 1) : s;
}