window.docson = require('docson');
window.tjs = require('typescript-json-schema');
window.typescript = require('typescript');
window.typescript.sys = (function () {
    var files = {};

    function readFile(f) {
        if (f === 'lib.d.ts') {
            f = 'vendor/lib.d.ts';
        }
        if (files[f]) {
            return files[f];
        }
        var request = new XMLHttpRequest();
        request.open('GET', f, false);
        request.send(null);
        return request.status === 200 ? files[f] = request.responseText : null;
    }

    return {
        readFile: function (f) {
            console.log('readFile', arguments);
            return readFile(f);
        },
        readDirectory: function () {
            console.log('readDirectory', arguments);
            return [];
        },
        getCurrentDirectory: function () {
            console.log('getCurrentDirectory', arguments);
            return '.';
        },
        directoryExists: function () {
            console.log('directoryExists', arguments);
            return true;
        },
        getDirectories: function () {
            console.log('getDirectories', arguments);
            return [];
        },
        getExecutingFilePath: function () {
            console.log('getExecutingFilePath', arguments);
            return '.';
        },
        realpath: function () {
            console.log('realpath', arguments);
            return '.';
        },
        fileExists: function (f) {
            console.log('fileExists', arguments);
            return !!readFile(f);
        }
    };
}());