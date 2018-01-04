var env = require('minimist')(process.argv.slice(2));
var colors = require('ansi-colors');
var log = require('fancy-log');
var fs = require('fs');
var objectPath = require('object-path');

var models = noSlash(env.models || 'ts');

module.exports = {
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
                log(colors.red('Conflicting environment variable, could not write "' + prop + '". Rename the variable if you need it, otherwise just ignore.'));
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
        return env.dependencyPath || 'node_modules/$api-dependencies';
    },
    deploy: function () {
        return env.deploy && env.deploy === 'true'
    },
    serve: function () {
        return !env.serve || env.serve !== 'false';
    },
    openBrowser: function () {
        return !env.openBrowser || env.openBrowser !== 'false';
    },
    minVersion: function () {
        return env.minVersion;
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