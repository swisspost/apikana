var File = require('vinyl');
var colors = require('ansi-colors');
var log = require('./log');
var gen = require('./java-gen');

module.exports = function (model, javaPackage, apiName, host, basePath) {
    apiName += 'Paths';
    var contents = '';
    return {
        start: function () {
            contents += 'package ' + javaPackage + ';\n\n';
            contents += 'public final class ' + gen.classOf(apiName) + ' {\n' +
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
            log.info('Generated', colors.magenta(gen.classOf(apiName) + '.java'));
            return new File({
                path: 'java/' + javaPackage.replace(/\./g, '/') + '/' + gen.classOf(apiName) + '.java',
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
                    var className = gen.classOf(name);
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
                            line(level + 1, 'public final class BASED {');
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
        contents += gen.pad(level) + s + '\n';
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
