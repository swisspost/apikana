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
var generateEnv = require('./generate-env');

module.exports = {
    generate: function (tsconfig, files, dest) {
        fse.mkdirsSync(schemaDir('v3'));
        fse.mkdirsSync(schemaDir('v4'));

        var schemas = schemaGen.generate(tsconfig, files);
        if (schemas) {
            for (var type in schemas.definitions) {
                log('Found definition', colors.magenta(type));
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
                schema.definedIn = myProject();
                fs.writeFileSync(schemaFile(type, 'v4'), JSON.stringify(schema, null, 2));
                convertToV3(schema);
                fs.writeFileSync(schemaFile(type, 'v3'), JSON.stringify(schema, null, 2));
            }
        }

        function myProject() {
            var vars = generateEnv.variables();
            return vars.name || (vars.project && vars.project.artifactId) || path.parse(path.resolve('.')).name;
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

