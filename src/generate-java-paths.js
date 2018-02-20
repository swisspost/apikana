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
        doWrite(obj, path, []);

        function doWrite(obj, path, parents, isBased) {
            var keys = Object.keys(obj);
            keys.sort();
            var stat = parents.length === 0 ? 'static ' : '';
            for (var i = 0; i < keys.length; i++) {
                var name = keys[i];
                if (name.charAt(0) !== '/') {
                    var value = obj[name];
                    var newParents = gen.classOf(name, parents);
                    line(parents.length, 'public ' + stat + 'final class ' + newParents[0] + ' {');
                    {
                        var newPath = path;
                        if (name) {
                            var param = value['/param'];
                            newPath += '/' + (param ? param.original : name);
                        }
                        var constructor = 'private ' + newParents[0] + '(){}';
                        var pathVar = isBased ? ('"' + newPath + '"') : ('BASE_PATH + "' + newPath.substring(model.prefix.length) + '"');
                        line(parents.length + 1, constructor + ' public static final String PATH = ' + pathVar + ';');
                        doWrite(value, newPath, newParents, isBased);
                        if (!isBased && hasChildren(value)) {
                            line(parents.length + 1, 'public final class BASED {');
                            doWrite(value, '', gen.classOf('_based', newParents), true);
                            line(parents.length + 1, '}');
                        }
                    }
                    line(parents.length, '}');
                }
            }
        }
    }

    function line(level, s) {
        contents += gen.pad(level + 1) + s + '\n';
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
