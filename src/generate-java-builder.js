var File = require('vinyl');
var colors = require('ansi-colors');
var log = require('./log');
var gen = require('./java-gen');
var urlUtils = require('./url-utils');

module.exports = function (model, javaPackage, apiName, host, basePath) {
    apiName += 'PathBuilder';
    var contents = '';
    return {
        start: function () {
            contents += 'package ' + javaPackage + ';\n\n';
            contents += 'public final class ' + gen.classOf(apiName) + ' {\n' +
                '    public static final String BASE_URL = "' + (host || '') + (basePath || '') + '";\n' +
                '    public static final String BASE_PATH = "' + urlUtils.dropLeadingSlashes(model.prefix) + '";\n' +
                '    public static abstract class Path {\n' +
                '        protected abstract String path();\n' +
                '    }\n' +
                '    public static abstract class Endpoint extends Path {\n' +
                '        public abstract String path();\n' +
                '        public final String url() {\n' +
                '            return BASE_URL + path();\n' +
                '        }\n' +
                '        public final String url(String base) {\n' +
                '            return base + path();\n' +
                '        }\n' +
                '        public final String relativeTo(String other) {\n' +
                '            if (!path().startsWith(other)) { throw new IllegalArgumentException(other + " is not a prefix of " + path()); }\n' +
                '            return path().substring(other.length());\n' +
                '        }\n' +
                '        public final String relativeTo(Path other) {\n' +
                '            return relativeTo(other.path());\n' +
                '        }\n' +
                '    }\n';
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

        function doWrite(obj, path, parents) {
            var keys = Object.keys(obj);
            keys.sort();
            var stat = parents.length === 0 ? 'static ' : '';
            for (var i = 0; i < keys.length; i++) {
                var name = keys[i];
                if (name.charAt(0) !== '/') {
                    var endpoint = obj[name]['/end'];
                    var param = obj[name]['/param'];
                    var newParents = gen.classOf(name, parents);
                    var child = 'public ' + stat + 'final ' + newParents[0] + ' ' + gen.fieldOf(name) +
                        (param
                            ? '(' + gen.javaType(param.type) + ' ' + gen.fieldOf(name) + '){ return new ' + newParents[0] + '(' + gen.fieldOf(name) + '); }'
                            : ' = new ' + newParents[0] + '();');

                    var constructor = 'private ' + newParents[0] +
                        (param
                            ? '(' + gen.javaType(param.type) + ' ' + gen.fieldOf(name) + '){ this.value = ' + gen.fieldOf(name) + '; }'
                            : '(){}');

                    var pathElem;
                    if (param) {
                        var suff = param.suffix ? ' + "' + param.suffix + '"' : '';
                        pathElem = '"/' + param.prefix + '" + value' + suff;
                    } else {
                        pathElem = '"/' + name + '"';
                    }
                    var pathMethod = (endpoint ? 'public final' : 'protected') + ' String path() { return ' +
                        (parents.length === 0
                            ? '"' + path + '/" + ' + pathElem + '; }'
                            : parents[0] + '.this.path() + ' + pathElem + '; }');

                    line(parents.length, child);
                    line(parents.length, 'public ' + stat + 'final class ' + newParents[0] + ' extends ' + (endpoint ? 'Endpoint' : 'Path') + ' {');
                    {
                        var newPath = path;
                        if (name) {
                            newPath += '/' + (param ? param.original : name);
                        }
                        if (param) {
                            line(parents.length + 1, 'private final ' + gen.javaType(param.type) + ' value;');
                        }
                        line(parents.length + 1, constructor);
                        line(parents.length + 1, pathMethod);
                        doWrite(obj[name], newPath, newParents);
                    }
                    line(parents.length, '}');
                }
            }
        }

        function line(level, s) {
            contents += gen.pad(level + 1) + s + '\n';
        }
    }
};
