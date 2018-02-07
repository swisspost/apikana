var File = require('vinyl');
var colors = require('ansi-colors');
var log = require('./log');

module.exports = function (javaPackage, apiName, host, basePath) {
    var contents = '';
    return {
        start: function () {
            contents += 'package ' + javaPackage + ';\n\n';
            contents += 'public final class ' + classOf(apiName) + ' {\n' +
                '    public static final String BASE_URL = "' + (host || '') + (basePath || '') + '";\n' +
                '    private static abstract class Path {\n' +
                '        protected abstract String path();\n' +
                '    }\n' +
                '    private static abstract class Endpoint extends Path {\n' +
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
        write: function (model) {
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
        var classes = {};
        doWrite(obj, path, null, 1);

        function newClass(name) {
            var n = classOf(name);
            while (classes[n]) {
                n += '_';
            }
            classes[n] = true;
            return n;
        }

        function doWrite(obj, path, parentClass, level) {
            function line(s) {
                contents += pad(level) + s + '\n';
            }

            var keys = Object.keys(obj);
            keys.sort();
            var stat = level === 1 ? 'static ' : '';
            for (var i = 0; i < keys.length; i++) {
                var name = keys[i];
                if (name.charAt(0) !== '/') {
                    var endpoint = obj[name]['/end'];
                    var param = obj[name]['/param'];

                    var className = newClass(name);
                    var child = 'public ' + stat + 'final ' + className + ' ' + fieldOf(name) +
                        (param
                            ? '(' + javaType(param) + ' ' + fieldOf(name) + '){ return new ' + className + '(' + fieldOf(name) + '); }'
                            : ' = new ' + className + '();');

                    var constructor = 'private ' + className +
                        (param
                            ? '(' + javaType(param) + ' ' + fieldOf(name) + '){ this.value = ' + fieldOf(name) + '; }'
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
                    line('public static final String PATH = "' + newPath + '";');
                    if (param) {
                        line('private final ' + javaType(param) + ' value;');
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


function classOf(name) {
    var java = javaOf(name);
    return java.substring(0, 1).toUpperCase() + java.substring(1);
}

var reservedWords = [
    'abstract', 'continue', 'for', 'new', 'switch',
    'assert', 'default', 'goto', 'package', 'synchronized',
    'boolean', 'do', 'if', 'private', 'this',
    'break', 'double', 'implements', 'protected', 'throw',
    'byte', 'else', 'import', 'public', 'throws',
    'case', 'enum', 'instanceof', 'return', 'transient',
    'catch', 'extends', 'int', 'short', 'try',
    'char', 'final', 'interface', 'static', 'void',
    'class', 'finally', 'long', 'strictfp', 'volatile',
    'const', 'float', 'native', 'super', 'while'];
var reserved = {};
for (var i = 0; i < reservedWords.length; i++) {
    reserved[reservedWords[i]] = true;
}

function fieldOf(name) {
    var java = javaOf(name);
    var lower = java.substring(0, 1).toLowerCase() + java.substring(1);
    return reserved[lower] ? lower + '_' : lower;
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

function javaType(type) {
    switch (type) {
        case 'number':
            return 'double';
        case 'integer':
            return 'int';
        case 'boolean':
            return 'boolean';
        default:
            return 'String';
    }
}

function pad(n) {
    var s = '';
    while (s.length < 4 * n) {
        s += ' ';
    }
    return s;
}

