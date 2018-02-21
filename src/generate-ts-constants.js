var File = require('vinyl');
var colors = require('ansi-colors');
var log = require('./log');

module.exports = function (model, apiName, host, basePath) {
    apiName+='Paths';
    var contents = '';
    var classes = {};
    return {
        start: function () {
            contents += 'abstract class Path {\n' +
                '    abstract path(): String\n' +
                '    url(base?: string): String {\n' +
                '        return (base ? base : ' + classOf(apiName) + '.baseUrl) + this.path();\n' +
                '    }\n' +
                '}\n\n';
        },
        write: function () {
            classes[''] = 'export default class ' + classOf(apiName) + ' {\n' +
                '    private constructor(){}\n' +
                '    static readonly baseUrl = "' + (host || '') + (basePath || '') + '";\n' +
                '    static readonly basePath = "' + model.prefix + '";\n' +
                '    private path() { return ' + classOf(apiName) + '.basePath; }\n';
            write(model.simple, '', 1);
            for (var cn in classes) {
                if (cn !== '') {
                    contents += classes[cn];
                }
            }
            contents += classes[''];
        },
        finish: function () {
        },
        toFile: function () {
            log.info('Generated', colors.magenta(fieldOf(apiName) + '.ts'));
            return new File({
                path: 'ts/' + fieldOf(apiName) + '.ts',
                contents: new Buffer(contents)
            });
        }
    };

    function write(obj, path, level) {
        var keys = Object.keys(obj);
        keys.sort();
        var stat = level === 1 ? 'static ' : '';
        var thisExpr = level === 1 ? 'new ' + classOf(apiName) + '()' : 'this';
        for (var i = 0; i < keys.length; i++) {
            var name = keys[i];
            if (name.charAt(0) !== '/') {
                var newPath = path;
                if (name) {
                    newPath += '/' + (param ? '{' + name + '}' : name);
                }

                var endpoint = obj[name]['/end'];
                var param = obj[name]['/param'];

                var child = stat + (param
                    ? fieldOf(name) + '(' + fieldOf(name) + '?: ' + tsType(param.type) + '){ return new ' + classOf(newPath) + '(' + thisExpr + ', ' + fieldOf(name) + '); }'
                    : 'readonly ' + fieldOf(name) + ' = new ' + classOf(newPath) + '(' + thisExpr + ');');

                var constructor = 'constructor(private parent' +
                    (param ? ', private value?: ' + tsType(param.type) : '') + '){' +
                    (endpoint ? 'super();' : '') + '}';
                var pathElem = param ? '(this.value ? this.value : "{' + name + '}")' : ('"' + name + '"');
                var pathMethod = (endpoint ? '' : 'private ') + 'path() { return ' + 'this.parent.path() + "/" + ' + pathElem + '; }';

                classes[path] += '    ' + child + '\n';
                classes[newPath] =
                    'class ' + classOf(newPath) + (endpoint ? ' extends Path' : '') + ' {\n' +
                    '    ' + constructor + '\n' +
                    '    ' + pathMethod + '\n';

                write(obj[name], newPath, level + 1);
            }
        }
        classes[path] += '}\n\n';
    }
};

var reservedWords = [
    'any', 'as', 'async', 'await', 'boolean', 'break',
    'case', 'catch', 'class', 'const', 'constructor',
    'continue', 'debugger', 'declare', 'default', 'delete',
    'do', 'else', 'enum', 'export', 'extends', 'false',
    'finally', 'for', 'from', 'function', 'get', 'if',
    'implements', 'import', 'in', 'instanceof', 'interface',
    'let', 'module', 'namespace', 'new', 'number', 'null',
    'of', 'package', 'private', 'protected', 'public',
    'require', 'return', 'set', 'static', 'string', 'super',
    'switch', 'symbol', 'this', 'throw', 'true', 'try', 'type',
    'typeof', 'var', 'void', 'while', 'with', 'yield'];
var reserved = {};
for (var i = 0; i < reservedWords.length; i++) {
    reserved[reservedWords[i]] = true;
}

function classOf(name) {
    var java = tsOf(name);
    return java.substring(0, 1).toUpperCase() + java.substring(1);
}

function fieldOf(name) {
    var java = tsOf(name);
    var lower = java.substring(0, 1).toLowerCase() + java.substring(1);
    return reserved[lower] ? lower + '_' : lower;
}

function tsOf(name) {
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

function tsType(type) {
    switch (type) {
        case 'number':
        case 'integer':
            return 'number';
        case 'boolean':
            return 'boolean';
        case 'array':
            return 'array<string>';
        default:
            return 'string';
    }
}

