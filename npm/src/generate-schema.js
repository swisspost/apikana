var gutil = require('gulp-util');
var colors = gutil.colors;
var log = gutil.log;
var through = require('through2');
var traverse = require('traverse');
var fs = require('fs');
var path = require('path');
var schemaGen = require('./schema-gen');

module.exports = {
    generate: function (tsconfig, source, dest) {
        mkdir(schemaDir('v3'));
        mkdir(schemaDir('v4'));

        var files = [];
        return source
            .pipe(through.obj(function (file, enc, cb) {
                files.push(file.path);
                cb();
            }))
            .on('finish', generateSchemas);

        function generateSchemas() {
            var schemas = schemaGen.generate(tsconfig, files);
            if (schemas) {
                for (var type in schemas.definitions) {
                    log('Found definition', colors.magenta(type));
                    var schema = schemaGen.generate(tsconfig, files, type);
                    fs.writeFileSync(schemaFile(type, 'v4'), JSON.stringify(schema, null, 2));
                    convertToV3(schema);
                    fs.writeFileSync(schemaFile(type, 'v3'), JSON.stringify(schema, null, 2));
                }
            }
        }

        function mkdir(p) {
            if (!fs.existsSync(p)) {
                mkdir(path.dirname(p));
                fs.mkdirSync(p);
            }
        }

        function schemaFile(type, version) {
            return path.resolve(schemaDir(version), type.toLowerCase() + '.json');
        }

        function schemaDir(version) {
            return path.resolve(dest, 'model/json-schema-' + version);
        }

        function convertToV3(schema) {
            schema.$schema = 'http://json-schema.org/draft-03/schema#';
            schema.javaType = javaType(schema.id);
            schema.javaInterfaces = ['java.io.Serializable'];
            traverse(schema).forEach(function (value) {
                if (value.required) {
                    for (var i = 0; i < value.required.length; i++) {
                        var prop = value.required[i];
                        value.properties[prop].required = true;
                    }
                }
                if (value.type == 'object' && this.path.length === 2 && this.path[0] === 'definitions') {
                    value.javaType = javaType(this.key);
                    value.javaInterfaces = ['java.io.Serializable'];
                }
                if (value.enum) {
                    value.javaType = javaType(value.id);
                }
                this.update(value);
            });
            var id = schema.id;
            traverse(schema).forEach(function (value) {
                if (this.key === 'required' && Array.isArray(value)) {
                    this.remove();
                }
            });
        }

        function javaType(type) {
            return (gutil.env.javaPackage || '${javaPackage}' ) + '.' + type;
        }
    }
};

