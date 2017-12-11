var gutil = require('gulp-util');
var colors = gutil.colors;
var log = gutil.log;

module.exports = function (apiName, host, basePath) {
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
        write: function (obj) {
            classes[''] = 'export default class ' + classOf(apiName) + ' {\n' +
                '    private constructor(){}\n' +
                '    static readonly baseUrl = "' + (host || '') + (basePath || '') + '";\n' +
                '    private path() { return ""; }\n';
            write(obj, '', 1);
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
            log('Generated', colors.magenta(fieldOf(apiName) + '.ts'));
            return new gutil.File({
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
                    ? fieldOf(name) + '(' + fieldOf(name) + '?: ' + tsType(param) + '){ return new ' + classOf(newPath) + '(' + thisExpr + ', ' + fieldOf(name) + '); }'
                    : 'readonly ' + fieldOf(name) + ' = new ' + classOf(newPath) + '(' + thisExpr + ');');

                var constructor = 'constructor(private parent' +
                    (param ? ', private value?: ' + tsType(param) : '') + '){' +
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


function classOf(name) {
    var java = tsOf(name);
    return java.substring(0, 1).toUpperCase() + java.substring(1);
}

function fieldOf(name) {
    var java = tsOf(name);
    return java.substring(0, 1).toLowerCase() + java.substring(1);
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

