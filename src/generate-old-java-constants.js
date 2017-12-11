var gutil = require('gulp-util');
var colors = gutil.colors;
var log = gutil.log;

module.exports = function (javaPackage, apiName) {
    var contents = '';
    var lines = {};
    return {
        start: function () {
            contents += 'package ' + javaPackage + ';\n\n'
                + '/**\n'
                + ' * @deprecated Use ' + classOf(apiName) + ' instead.\n'
                + ' */\n'
                + '@Deprecated\n'
                + 'public final class Paths {\n';
        },
        write: function (obj, raw) {
            write(obj, raw);
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
            log('Generated', colors.magenta('Paths.java'));
            return new gutil.File({
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


function classOf(name) {
    var java = javaOf(name);
    return java.substring(0, 1).toUpperCase() + java.substring(1);
}

function javaOf(name) {
    var s = '';
    var removed = false;
    for (var i = 0; i < name.length; i++) {
        var c = name.charAt(i);
        if ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')) {
            s += removed ? c.toUpperCase() : c;
            removed = false;
        } else {
            removed = true;
        }
    }
    return s;
}
