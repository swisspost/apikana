var File = require('vinyl');
var colors = require('ansi-colors');
var log = require('./log');
var gen = require('./java-gen');

module.exports = function (model, javaPackage, apiName) {
    var contents = '';
    var lines = {};
    return {
        start: function () {
            contents += 'package ' + javaPackage + ';\n\n'
                + '/**\n'
                + ' * @deprecated Use ' + gen.classOf(apiName + 'Paths') + ', ' + gen.classOf(apiName + 'PathVariables') + ' or ' + gen.classOf(apiName + 'PathBuilder') + ' instead.\n'
                + ' */\n'
                + '@Deprecated\n'
                + 'public final class Paths {\n';
        },
        write: function () {
            write(model.full, model.paths);
        },
        finish: function () {
            var ls = Object.keys(lines);
            ls.sort(function (a, b) {
                return a.replace(/\$/g, '|').localeCompare(b.replace(/\$/g, '|'));
            });
            for (var i = 0; i < ls.length; i++) {
                contents += lines[ls[i]];
            }
            contents += '}';
        },
        toFile: function () {
            log.info('Generated', colors.magenta('Paths.java'));
            return new File({
                path: 'java/' + javaPackage.replace(/\./g, '/') + '/Paths.java',
                contents: new Buffer(contents)
            });
        }
    };

    function write(obj, raw) {
        for (var path in raw) {
            var p, p1, s;
            p = p1 = path.replace(/^\/[^\/]*\/?[^\/]*\/v[^\/]*/, '');
            var prefix = path.replace(/^\/([^\/]*\/?[^\/]*\/v[^\/]*).*/, '$1');
            while ((s = p1.lastIndexOf('/')) >= 0) {
                var tail = p1 === p ? '' : '/';
                createLine(p1, prefix + p1 + tail);
                p1 = p1.substring(0, s);
                if (s > 0) {
                    var segments = p.substring(s + 1);
                    createLine(p1 + '$' + segments, segments);
                    if (segments.indexOf('{') === 0) {
                        v = segments.substring(0, segments.indexOf('}') + 1);
                        createLine(p1 + '$' + v, v);
                        createLine(p1 + '$' + v + '$', v.substring(1, v.length - 1));
                    }
                }
            }
        }
    }

    function createLine(key, val) {
        var constant = key
            .replace(/[^A-Za-z0-9{}\$]/g, '_')
            .replace(/[\$_]([^{]*)/g, function (x) {
                return x.toUpperCase();
            })
            .replace(/[{}]/g, '')
            .substring(1);
        var line = '    public static final String ' + constant + ' = "' + val + '";\n';
        lines[constant] = line;
    }

};
