var File = require('vinyl');
var colors = require('ansi-colors');
var log = require('./log');

module.exports = function (model, javaPackage, apiName, host, basePath) {
    apiName += 'Paths';
    var contents = '';
    return {
        start: function () {
            contents += 'package ' + javaPackage + ';\n\n';
            contents += 'public final class ' + classOf(apiName) + ' {\n' +
                '    public static final String BASE_URL = "' + (host || '') + (basePath || '') + '";\n' +
                '    public static final String BASE_PATH = "' + model.prefix + '";\n';
        },
        write: function () {
            write(model.simple, model.prefix);
        },
        finish: function () {
            contents += '}';
        },
        toFile: function () {
            log.info('Generated', colors.magenta(classOf(apiName) + '.java'));
            return new File({
                path: 'java/' + javaPackage.replace(/\./g, '/') + '/' + classOf(apiName) + '.java',
                contents: new Buffer(contents)
            });
        }
    };

    function write(obj, path) {
        doWrite(obj, path, 1);

        function doWrite(obj, path, level, isBased) {
            var keys = Object.keys(obj);
            keys.sort();
            var stat = level === 1 ? 'static ' : '';
            for (var i = 0; i < keys.length; i++) {
                var name = keys[i];
                if (name.charAt(0) !== '/') {
                    var param = obj[name]['/param'];
                    var className = classOf(name);
                    var constructor = 'private ' + className + '(){}';

                    line(level, 'public ' + stat + 'final class ' + className + ' {');
                    {
                        var newPath = path;
                        if (name) {
                            newPath += '/' + (param ? '{' + name + '}' : name);
                        }
                        line(level + 1, constructor + ' public static final String PATH = "' + newPath + '";');
                        doWrite(obj[name], newPath, level + 1, isBased);
                        if (!isBased && hasChildren(obj[name])) {
                            line(level + 1, 'public static final class BASED {');
                            doWrite(obj[name], '', level + 2, true);
                            line(level + 1, '}');
                        }
                    }
                    line(level, '}');
                }
            }
        }
    }

    function line(level, s) {
        contents += pad(level) + s + '\n';
    }
};

function hasChildren(obj) {
    for (var prop in obj) {
        if (prop.charAt(0) !== '/') {
            return true;
        }
    }
    return false;
}

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

function pad(n) {
    var s = '';
    while (s.length < 4 * n) {
        s += ' ';
    }
    return s;
}
