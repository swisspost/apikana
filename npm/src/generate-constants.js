var gutil = require('gulp-util');
var through = require('through2');
var path = require('path');
var fs = require('fs');
var yaml = require('yamljs');
var objectPath = require('object-path');

module.exports = {
    generate: function (source, dest) {
        return source
            .pipe(createConstantsFile(gutil.env.javaPackage))
            .pipe(dest);

        function createConstantsFile(javaPackage) {
            var contents = 'package ' + javaPackage + ';\n\n' +
                'public class Paths {\n' +
                '    public interface Path{}\n' +
                '    public interface Elem{}\n' +
                '    public interface Param{}\n';


            return through.obj(addConstants, end);

            function addConstants(file, enc, cb) {
                var api = fileContents(file);
                contents += '    static final String BASE_URL = "' + (api.basePath || '') + '";\n';
                contents += '    public static String path(Path path) {\n' +
                    '        return path.getClass().toString();\n' +
                    '    }\n';
                var model = {};
                for (var path in api.paths) {
                    var prefix = path.replace(/^\/(.*?\/v\d[^\/]*).*/, '$1');
                    var rest = path.substring(prefix.length + 2).replace(/\//g, '.');
                    var existing = objectPath.get(model, rest);
                    if (existing) {
                        existing['/prefix'] = prefix;
                    } else {
                        objectPath.set(model, rest, {'/prefix': prefix});
                    }
                    console.log(prefix, rest)

                    // var p1 = rest;
                    // var s;
                    // while ((s = p1.lastIndexOf('/')) >= 0) {
                    //     var tail = p1 === rest ? '' : '/';
                    //     createLine(p1, prefix + p1 + tail);
                    //     p1 = p1.substring(0, s);
                    //     if (s > 0) {
                    //         var segments = rest.substring(s + 1);
                    //         createLine(p1 + '$' + segments, segments);
                    //         if (segments.indexOf('{') === 0) {
                    //             var v = segments.substring(0, segments.indexOf('}') + 1);
                    //             createLine(p1 + '$' + v, v);
                    //             createLine(p1 + '$' + v + '$', v.substring(1, v.length - 1));
                    //         }
                    //     }
                    // }
                }
                console.log(JSON.stringify(model))
                write(model, 1);
                cb();
            }

            function write(obj, level) {
                var keys = Object.keys(obj);
                keys.sort();
                if (obj['/prefix']) {
                    contents += pad(level * 4) + 'static final String PREFIX = "' + obj['/prefix'] + '";\n';
                }
                for (var i = 0; i < keys.length; i++) {
                    var name = keys[i];
                    if (name.charAt(0) !== '/') {
                        var ifaces = [];
                        if (obj[keys[i]]['/prefix']) {
                            ifaces.push('Path');
                        }
                        if (/\{.*?\}/.test(name)) {
                            name = name.substring(1, name.length - 1);
                            ifaces.push('Param');
                        }
                        if (keys.length === 1) {
                            ifaces.push('Elem');
                        }
                        contents += pad(level * 4) + 'public static class ' + javaize(name) + (ifaces.length === 0 ? '' : ' implements ' + ifaces.join()) + ' {\n';
                        write(obj[keys[i]], level + 1);
                        contents += pad(level * 4) + '}\n';
                    }
                }
            }

            function pad(n) {
                var s = '';
                while (s.length < n) {
                    s += ' ';
                }
                return s;
            }

            function fileContents(file) {
                var raw = file.contents.toString();
                return file.path.substring(file.path.lastIndexOf('.') + 1) === 'yaml'
                    ? yaml.parse(raw) : JSON.parse(raw);
            }

            function createLine(p, q) {
                var constant = p
                    .replace(/[^A-Za-z0-9{}$]/g, '_')
                    .replace(/[$_]([^{]*)/g, upper)
                    .replace(/[{}]/g, '')
                    .substring(1);
                lineSet[constant] = '        ' + constant + ' = "' + q + '";\n';
            }

            function upper(x) {
                return x.toUpperCase();
            }

            function javaize(name) {
                return name.substring(0, 1).toUpperCase() + name.substring(1);
            }

            function end(cb) {
                // var lines = Object.keys(lineSet);
                // lines.sort(function (a, b) {
                //     return a.replace(/\$/g, '|').localeCompare(b.replace(/\$/g, '|'));
                // });
                // for (var i = 0; i < lines.length; i++) {
                //     contents += lineSet[lines[i]];
                // }
                contents += '}';
                this.push(new gutil.File({
                    path: javaPackage.replace(/\./g, '/') + '/Paths.java',
                    contents: new Buffer(contents)
                }));
                // gutil.log('Generated ' + lines.length + ' constants');
                cb();
            }
        }
    }
};