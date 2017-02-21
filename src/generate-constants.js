var gutil = require('gulp-util');
var colors = gutil.colors;
var log = gutil.log;
var through = require('through2');
var path = require('path');
var fs = require('fs');
var yaml = require('yamljs');
var params=require('./params');

module.exports = {
    generate: function (source, dest) {
        return source
            .pipe(createConstantsFile(params.javaPackage()))
            .pipe(dest);

        function createConstantsFile(javaPackage) {
            var contents = 'package ' + javaPackage + ';\n\n';

            return through.obj(function (file, enc, cb) {
                var api = fileContents(file);
                var model = {};
                var prefix = '';
                for (var path in api.paths) {
                    prefix = commonPrefix(prefix, path);
                }

                for (var path in api.paths) {
                    var elems = path.substring(prefix.length).split('/');
                    var m = model;
                    for (var i = 0; i < elems.length; i++) {
                        var elem = elems[i];
                        var type = null;
                        if (/\{.*?\}/.test(elem)) {
                            elem = elem.substring(1, elem.length - 1);
                            type = findParameterType(api.paths[path], elem);
                        }
                        if (!m[elem]) {
                            m[elem] = {'/param': type};
                            if (elem === '') {
                                m[elem]['/safeName'] = prefix.substring(prefix.lastIndexOf('/') + 1);
                            }
                        }
                        m = m[elem];
                    }
                    m['/end'] = true;
                }

                if (prefix.charAt(0) === '/') {
                    prefix = prefix.substring(1);
                }
                if (prefix.charAt(prefix.length - 1) === '/') {
                    prefix = prefix.substring(0, prefix.length - 1);
                }
                var pathsName = classOf(prefix) + 'Api';
                contents += 'public class ' + pathsName + ' {\n' +
                    '    public static final String BASE_URL = "' + (api.basePath || '') + '";\n' +
                    '    private static abstract class Path {\n' +
                    '        public abstract String path();\n' +
                    '        public String url() {\n' +
                    '            return BASE_URL + path();\n' +
                    '        }\n' +
                    '        public String url(String base) {\n' +
                    '            return base + path();\n' +
                    '        }\n' +
                    '    }\n';

                write(model, prefix, prefix, 1);
                contents += '}';

                this.push(new gutil.File({
                    path: javaPackage.replace(/\./g, '/') + '/' + pathsName + '.java',
                    contents: new Buffer(contents)
                }));
                log('Generated', colors.magenta(pathsName + '.java'));
                cb();
            });

            function findParameterType(apiPath, param) {
                for (var m in apiPath) {
                    var method = apiPath[m];
                    if (method) {
                        for (var p in method.parameters) {
                            var parameter = method.parameters[p];
                            if (parameter.name === param) {
                                return parameter.type || 'string';
                            }
                        }
                    }
                }
                return 'string';
            }

            function javaType(type) {
                switch (type) {
                    case 'number':
                        return 'long';
                    case 'integer':
                        return 'int';
                    case 'boolean':
                        return 'boolean';
                    default:
                        return 'String';
                }
            }

            function commonPrefix(a, b) {
                if (!a) {
                    return b;
                }
                var i = 0;
                while (i < a.length && i < b.length && a.charAt(i) === b.charAt(i)) {
                    i++;
                }
                return a.substring(0, i);
            }

            function write(obj, path, parent, level) {
                function line(s) {
                    contents += pad(level) + s + '\n';
                }

                var keys = Object.keys(obj);
                keys.sort();
                var stat = level === 1 ? 'static ' : '';
                for (var i = 0; i < keys.length; i++) {
                    var name = keys[i];
                    var safeName = name ? name : obj[name]['/safeName'];
                    if (name.charAt(0) !== '/') {
                        var endpoint = obj[name]['/end'];
                        var param = obj[name]['/param'];

                        var child = 'public ' + stat + classOf(safeName) + ' ' + fieldOf(safeName) +
                            (param
                                ? '(' + javaType(param) + ' ' + fieldOf(safeName) + '){ return new ' + classOf(safeName) + '(' + fieldOf(safeName) + '); }'
                                : ' = new ' + classOf(safeName) + '();');

                        var constructor = 'private ' + classOf(safeName) +
                            (param
                                ? '(' + javaType(param) + ' ' + fieldOf(safeName) + '){ this.value = ' + fieldOf(safeName) + '; }'
                                : '(){}');

                        var pathElem = param ? 'value' : ('"' + name + '"');
                        var pathMethod = (endpoint ? 'public' : 'private') + ' String path() { return ' +
                            (level === 1
                                ? '"' + parent + '" + ' + pathElem + '; }'
                                : classOf(parent) + '.this.path() + "/" + ' + pathElem + '; }');

                        line(child);
                        line('public ' + stat + 'class ' + classOf(safeName) + (endpoint ? ' extends Path' : '') + ' {');

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
                        write(obj[name], newPath, safeName, level);
                        level--;

                        line('}');
                    }
                }
            }

            function pad(n) {
                var s = '';
                while (s.length < 4 * n) {
                    s += ' ';
                }
                return s;
            }

            function fileContents(file) {
                var raw = file.contents.toString();
                return file.path.substring(file.path.lastIndexOf('.') + 1) === 'yaml'
                    ? yaml.parse(raw) : JSON.parse(raw);
            }

            function classOf(name) {
                var java = javaOf(name);
                return java.substring(0, 1).toUpperCase() + java.substring(1);
            }

            function fieldOf(name) {
                var java = javaOf(name);
                return java.substring(0, 1).toLowerCase() + java.substring(1);
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
        }
    }
};