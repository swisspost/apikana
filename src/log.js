var timestamp = require('time-stamp');
var colors = require('ansi-colors');

function getTimestamp() {
    return '[' + timestamp('HH:mm:ss') + ']';
}

function log() {
    module.exports.info.apply(null, arguments)
    return this;
}

function debug() {
    Array.prototype.unshift.call(arguments, getTimestamp());
    console.info.apply(console, arguments);
    return this;
}

function info() {
    Array.prototype.unshift.call(arguments, getTimestamp());
    console.info.apply(console, arguments);
    return this;
}

function warn() {
    Array.prototype.unshift.call(arguments, getTimestamp());
    console.warn.apply(console, arguments);
    return this;
}

function error() {
    Array.prototype.unshift.call(arguments, getTimestamp());
    console.error.apply(console, arguments);
    return this;
}

function setLevel(level) {
    setNumLevel(numLevel(level));
}

function numLevel(level) {
    switch ((level || 'info').toLowerCase()) {
    case 'error':
        return 0;
    case 'warn':
        return 1;
    default:
        return 2;
    case 'debug':
        return 3;
    }
}

function setNumLevel(level) {
    module.exports.error = level >= 0 ? error : nop;
    module.exports.warn = level >= 1 ? warn : nop;
    module.exports.info = level >= 2 ? info : nop;
    module.exports.debug = level >= 3 ? debug : nop;

    function nop() {
    }
}

module.exports = log;
module.exports.setLevel = setLevel;

setLevel('info');

var inBrowser = function () {
    return typeof window !== 'undefined' && this === window
}();

if (inBrowser) {
    colors.red = colors.magenta = colors.blue = colors.green = colors.underline = colors.black = colors.gray = colors.white = colors.yellow = function (msg) {
        return msg;
    }
}