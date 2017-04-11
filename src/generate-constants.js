var through = require('through2');
var path = require('path');
var fs = require('fs');
var yaml = require('yamljs');
var params = require('./params');
var JavaGen = require('./generate-java-constants');
var TsGen = require('./generate-ts-constants');

module.exports = {
    generate: function (source, dest) {
        return source
            .pipe(createConstantsFile(params.javaPackage()))
            .pipe(dest);

        function createConstantsFile(javaPackage) {
            return through.obj(function (file, enc, cb) {
                var api = fileContents(file);
                var apiName = ((api.info || {}).title || '') + 'Paths';
                var model = createModel(api.paths);

                if (javaPackage) {
                    this.push(generate(model, new JavaGen(javaPackage, apiName, api.host)));
                }
                this.push(generate(model, new TsGen(apiName, api.host)));
                cb();

                function generate(model, generator) {
                    generator.start();
                    generator.write(model, (api.basePath || ''));
                    generator.finish();
                    return generator.toFile();
                }

                function createModel(paths) {
                    var model = {};

                    for (var path in paths) {
                        var elems = path.substring(1).split('/');
                        var m = model;
                        for (var i = 0; i < elems.length; i++) {
                            var elem = elems[i];
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
