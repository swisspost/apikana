window.docson = require('docson');
window.tjs = require('typescript-json-schema');
window.typescript = require('typescript');

window.typescript.sys = (function () {
    var files = {};

    function readFile(f) {
        if (f === 'lib.d.ts') {
            f = 'patch/lib.d.ts';
        } else if ((!endsWith(f, '.ts') && !endsWith(f, '.json')) || f.indexOf('@types') >= 0 ||
            endsWith(f, 'package.json') || endsWith(f, '.d.ts') || endsWith(f, 'index.ts')) {
            return null;
        }

        if (files[f]) {
            var res = files[f];
            delete files[f];
            return res;
        }
        var request = new XMLHttpRequest();
        request.open('GET', f, false);
        request.send(null);
        if (request.status === 200) {
            return files[f] = request.responseText;
        }
        return null;
    }

    function endsWith(s, end) {
        return s.substring(s.length - end.length) === end;
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
        directoryExists: function (f) {
            if (f.indexOf('@types') >= 0) {
                return false;
            }
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
            // console.log('fileExists', arguments);
            return !!readFile(f);
        }
    };
}());

window.schemaGen = require('./schema-gen');