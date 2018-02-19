var File = require('vinyl');
var colors = require('ansi-colors');
var log = require('./log');
var gen = require('./java-gen');

module.exports = function (model, javaPackage, apiName, host, basePath) {
    apiName += 'PathBuilder';
    var contents = '';
    return {
        start: function () {
            contents += 'package ' + javaPackage + ';\n\n';
            contents += 'public final class ' + gen.classOf(apiName) + ' {\n' +
                '    public static final String BASE_URL = "' + (host || '') + (basePath || '') + '";\n' +
                '    public static final String BASE_PATH = "' + model.prefix + '";\n' +
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
        doWrite(obj, path, null, 1);

        function doWrite(obj, path, parentClass, level) {
            function line(s) {
                contents += gen.pad(level) + s + '\n';
            }

            var keys = Object.keys(obj);
            keys.sort();
            var stat = level === 1 ? 'static ' : '';
            for (var i = 0; i < keys.length; i++) {
                var name = keys[i];
                if (name.charAt(0) !== '/') {
                    var endpoint = obj[name]['/end'];
                    var param = obj[name]['/param'];

                    var className = gen.classOf(name);
                    var child = 'public ' + stat + 'final ' + className + ' ' + gen.fieldOf(name) +
                        (param
                            ? '(' + gen.javaType(param) + ' ' + gen.fieldOf(name) + '){ return new ' + className + '(' + gen.fieldOf(name) + '); }'
                            : ' = new ' + className + '();');

                    var constructor = 'private ' + className +
                        (param
                            ? '(' + gen.javaType(param) + ' ' + gen.fieldOf(name) + '){ this.value = ' + gen.fieldOf(name) + '; }'
                            : '(){}');

                    var pathElem = param ? 'value' : ('"' + name + '"');
                    var pathMethod = (endpoint ? 'public final' : 'protected') + ' String path() { return ' +
                        (level === 1
                            ? '"' + path + '/" + ' + pathElem + '; }'
                            : parentClass + '.this.path() + "/" + ' + pathElem + '; }');

                    line(child);
                    line('public ' + stat + 'final class ' + className + ' extends ' + (endpoint ? 'Endpoint' : 'Path') + ' {');

                    level++;
                    var newPath = path;
                    if (name) {
                        newPath += '/' + (param ? '{' + name + '}' : name);
                    }
                    if (param) {
                        line('private final ' + gen.javaType(param) + ' value;');
                    }
                    line(constructor);
                    line(pathMethod);
                    doWrite(obj[name], newPath, className, level);
                    level--;

                    line('}');
                }
            }
        }
    }
};
