var gutil = require('gulp-util');
var colors = gutil.colors;
var log = gutil.log;
var through = require('through2');
var traverse = require('traverse');
var fs = require('fs');
var fse = require('fs-extra');
var path = require('path');
var schemaGen = require('./schema-gen');
var params = require('./params');

module.exports = {
    generate: function (dependencyTypes, tsconfig, files, dest) {
        fse.mkdirsSync(schemaDir('v3'));
        fse.mkdirsSync(schemaDir('v4'));

        var schemas = schemaGen.generate(tsconfig, files);
        if (schemas) {
            for (var type in schemas.definitions) {
                log('Found definition', colors.magenta(type));
                var sn = schemaName(type);
                // if (dependencyTypes[sn]) {
                //     gutil.log(colors.red('Type'), colors.magenta(type),
                //         colors.red('already defined as dependency in'),
                //         colors.magenta(dependencyTypes[sn] + '/' + sn));
                //     throw new gutil.PluginError('apikana', 'multi definition');
                // }
                var schema = schemaGen.generate(tsconfig, files, type);
                traverse(schema).forEach(function (value) {
                    if (this.key === '$ref' && value.substring(0, 14) === '#/definitions/') {
                        this.update(schemaName(value.substring(14)));
                    }
                });
                if (params.javaPackage()) {
                    schema.javaType = params.javaPackage() + '.' + schema.id;
                    schema.javaInterfaces = ['java.io.Serializable'];
                }
                schema.definitions = [];
                fs.writeFileSync(schemaFile(type, 'v4'), JSON.stringify(schema, null, 2));
                convertToV3(schema);
                fs.writeFileSync(schemaFile(type, 'v3'), JSON.stringify(schema, null, 2));
            }
        }

        function schemaFile(type, version) {
            return path.resolve(schemaDir(version), schemaName(type));
        }

        function schemaName(type) {
            return type.replace(/([^^])([A-Z]+)/g, '$1-$2').toLowerCase() + '.json';
        }

        function schemaDir(version) {
            return path.resolve(dest, 'model/json-schema-' + version);
        }

        function convertToV3(schema) {
            schema.$schema = 'http://json-schema.org/draft-03/schema#';
            traverse(schema).forEach(function (value) {
                if (value.required) {
                    for (var i = 0; i < value.required.length; i++) {
                        var prop = value.required[i];
                        value.properties[prop].required = true;
                    }
                }
                if (this.key === 'required' && Array.isArray(value)) {
                    this.remove();
                }
            });
        }
    }
};

