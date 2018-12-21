var env = require('minimist')(process.argv.slice(2));
var colors = require('ansi-colors');
var log = require('./log');
var fs = require('fs');
var objectPath = require('object-path');

log.setLevel(env.log);

var models = noSlash(env.models || 'ts');

module.exports = {
    basePath: function () {
        return env.basePath;
    },
    readConfigFile: function () {
        if (env.config) {
            var config = fs.readFileSync(env.config);
            var configObj = JSON.parse(config);
            for (var prop in configObj) {
                if (!env[prop]) {
                    env[prop] = configObj[prop];
                }
            }
        }
    },
    enrichWithParams: function (target) {
        for (var prop in env) {
            try {
                objectPath.set(target, prop, env[prop]);
            } catch (e) {
                log.warn(colors.red('Conflicting environment variable, could not write "' + prop + '". Rename the variable if you need it, otherwise just ignore.'));
            }
        }
        return target;
    },
    target: function () { //this is undocumented as it breaks dependency resolution when a dependent module has artifacts not in dist/
        return env.target || 'dist';
    },
    api: function () {
        return noSlash(env.api || 'openapi/api.yaml');
    },
    models: function (dir) {
        if (dir) {
            models = dir;
        }
        return models;
    },
    style: function () {
        return noSlash(env.style || 'style');
    },
    port: function () {
        return env.port || 8333;
    },
    javaPackage: function () {
        return env.javaPackage;
    },
    dependencyPath: function () {
        return env.dependencyPath || 'node_modules/-api-dependencies';
    },
    pathPrefix: function () {
        var pp = env.pathPrefix;
        if (pp == null) {
            return null;
        }
        if (pp.substring(0, 1) !== '/') {
            pp = '/' + pp;
        }
        if (pp.substring(pp.length - 1) === '/') {
            pp = pp.substring(0, pp.length - 1);
        }
        return pp;
    },
    deploy: function () {
        return env.deploy && env.deploy === 'true';
    },
    serve: function () {
        return !env.serve || env.serve !== 'false';
    },
    openBrowser: function () {
        return !env.openBrowser || env.openBrowser !== 'false';
    },
    minVersion: function () {
        return env.minVersion;
    },
    generate3rdGenPaths: function(){
        const input = env["generate3rdGenPaths"];
        var result;
        if( input===undefined ){
            result = false; // Disabled by default.
        }else if( input.toUpperCase()==="FALSE" ){
            result = false;
        }else{
            result = true;
        }
        return result;
    }
};

function noSlash(s) {
    if (!s) {
        return s;
    }
    var first = s.substring(0, 1);
    s = (first === '/' || first === '\\') ? s.substring(1) : s;
    var last = s.substring(s.length - 1);
    return (last === '/' || last === '\\') ? s.substring(0, s.length - 1) : s;
}
