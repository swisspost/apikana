var through = require('through2');
var path = require('path');
var log = require('./log');
var colors = require('ansi-colors');
var fs = require('fs');
var yaml = require('yamljs');
var params = require('./params');
var JavaGen = require('./generate-java-constants');
var JavaBuilderGen = require('./generate-java-builder');
var OldJavaGen = require('./generate-old-java-constants');
var TsGen = require('./generate-ts-constants');

module.exports = {
    generate: function (source, dest) {
        return source
            .pipe(createConstantsFile(params.javaPackage()))
            .pipe(dest);

        function createConstantsFile(javaPackage) {
            return through.obj(function (file, enc, cb) {
                var api = fileContents(file);
                var apiName = ((api.info || {}).title || '');
                var model = createModel(api.paths);

                if (javaPackage) {
                    this.push(generate(new JavaGen(model, javaPackage, apiName, api.host, api.basePath)));
                    this.push(generate(new JavaBuilderGen(model, javaPackage, apiName, api.host, api.basePath)));
                    this.push(generate(new OldJavaGen(model, javaPackage, apiName)));
                }
                this.push(generate(new TsGen(model, apiName, api.host, api.basePath)));
                cb();

                function generate(generator) {
                    generator.start();
                    generator.write();
                    generator.finish();
                    return generator.toFile();
                }

                function createModel(paths) {
                    var full = createFullModel(paths);
                    var simple = full;
                    var prefix = '';
                    var p;
                    var hasPathPrefix = params.pathPrefix() !== null;
                    while ((p = singleProp(simple)) && (!hasPathPrefix || prefix.length < params.pathPrefix().length)) {
                        prefix += '/' + p;
                        simple = simple[p];
                    }
                    if (hasPathPrefix && prefix !== params.pathPrefix()) {
                        log.error(colors.red('Given path prefix "' + params.pathPrefix() + '" is not a prefix of all paths. Using "' + prefix + '" as prefix instead.'));
                    }
                    return {paths: paths, full: full, simple: simple, prefix: prefix};
                }

                function singleProp(obj) {
                    var prop;
                    for (var p in obj) {
                        if (p.charAt(0) !== '/') {
                            if (prop || (obj[p] && obj[p]['/end'])) {
                                return null;
                            }
                            prop = p;
                        }
                    }
                    return prop;
                }

                function createFullModel(paths) {
                    var model = {};

                    for (var path in paths) {
                        var elems = path.trim().split('/');
                        var m = model;
                        for (var i = 0; i < elems.length; i++) {
                            var elem = elems[i];
                            if (elem) {
                                var type = null;
                                if (/\{.*?\}/.test(elem)) {
                                    elem = elem.substring(1, elem.length - 1);
                                    type = findParameterType(paths[path], elem);
                                }
                                if (!m[elem]) {
                                    m[elem] = {'/param': type};
                                }
                                m = m[elem];
                            }
                        }
                        m['/end'] = true;
                    }
                    return model;
                }

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

                function fileContents(file) {
                    var raw = file.contents.toString();
                    return file.path.substring(file.path.lastIndexOf('.') + 1) === 'yaml'
                        ? yaml.parse(raw) : JSON.parse(raw);
                }
            });
        }
    }
};
