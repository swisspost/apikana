var rename = require('gulp-rename');
var gutil = require('gulp-util');
var colors = gutil.colors;
var log = gutil.log;
var through = require('through2');
var typson = require('typson');
var tjs = require('typescript-json-schema');
var traverse = require('traverse');
var fs = require('fs');
var path = require('path');

module.exports = {
    generate: function (source, dest) {
        return source
            .pipe(generateSchemas())
            .pipe(rename({dirname: 'model/json-schema-v4'}))
            .pipe(dest())
            .pipe(convertToV3())
            .pipe(rename({dirname: 'model/json-schema-v3'}))
            .pipe(dest());

        function generateSchemas() {
            return through.obj(function (file, enc, cb) {
                var self = this;
                var f = file.path.replace(/\\/g, '/');
                var ts = file.contents;
                var config = path.resolve(file.path,'../tsconfig.json');
                console.log(config)
                if (fs.existsSync(config)){
                    var prg = tjs.programFromConfig(config);
                }else {
                    var prg = tjs.getProgramFromFiles([f]);
                }
                var args = tjs.getDefaultArgs();
                args.disableExtraProperties = true;
                args.generateRequired = true;
                var schemas = tjs.generateSchema(prg, '*', args);
                // console.log(JSON.stringify(schema));
                log('Scanning', colors.magenta(file.path));
                //  typson.definitions(f).done(function (definitions) {
                //    var n = Object.keys(definitions).length;
                for (var type in schemas.definitions) {
                    // typson.schema(f, type).done(function (schema) {
                    var schema = tjs.generateSchema(prg, type, args);
                    schema.id = type;
                    // console.log(JSON.stringify(schema));
                    log('- ' + schema.id);
                    var id = schema.id;
                    if (id) {
                        traverse(schema).forEach(function (value) {
                            if (this.key === '$ref' && !(/^#\/definitions\//.test(value))) {
                                this.update('#/definitions/' + value);
                            }
                        });
                        self.push(new gutil.File({
                            path: id.replace(/([^^])([A-Z]+)/g, '$1-$2').toLowerCase() + '.json',
                            contents: new Buffer(JSON.stringify(schema, null, 2))
                        }));
                        // if (--n === 0) {
                        //     return cb();
                        // }
                    }
                    // });
                }
                cb();
                //});
            });
        }

        function convertToV3() {
            return through.obj(function (file, enc, cb) {
                var schema = JSON.parse(file.contents);
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
                    if (this.key === '$ref' && value === '#/definitions/' + id) {
                        this.update(id.replace(/([^^])([A-Z]+)/g, '$1-$2').toLowerCase() + '.json');
                    }
                });
                this.push(new gutil.File({
                    path: file.path,
                    contents: new Buffer(JSON.stringify(schema, null, 2))
                }));
                cb();
            });
        }

        function javaType(type) {
            return (gutil.env.javaPackage || '${javaPackage}' ) + '.' + type;
        }
    }
};

