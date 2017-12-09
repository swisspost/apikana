var gutil = require('gulp-util');
var colors = gutil.colors;
var log = gutil.log;
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
        for (var name in schemas) {
            log('Found definition', colors.magenta(name));
            var schema = schemas[name];
            var extRef = {};
            extRef[name] = true;
            for (var type in schema.definitions) {
                var def = schema.definitions[type];
                if (def.type === 'object' || def.enum) {
                    delete schema.definitions[type];
                    extRef[type] = true;
                }
            }
            schemaGen.processRefs(schema, function (ref) {
                if (ref.substring(0, 14) === '#/definitions/' && extRef[ref.substring(14)]) {
                    return schemaName(ref.substring(14));
                }
                return ref;
            });
            if (params.javaPackage()) {
                schema.javaType = params.javaPackage() + '.' + schema.id;
                schema.javaInterfaces = ['java.io.Serializable'];
            }
            schema.definedIn = myProject();
            fs.writeFileSync(schemaFile(name, 'v4'), JSON.stringify(schema, null, 2));
            convertToV3(schema);
            fs.writeFileSync(schemaFile(name, 'v3'), JSON.stringify(schema, null, 2));
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

