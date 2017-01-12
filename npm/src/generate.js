var gulp = require('gulp');
var rename = require('gulp-rename');
var inject = require('gulp-inject');
var gutil = require('gulp-util');
var colors = gutil.colors;
var log = gutil.log;
var path = require('path');
var through = require('through2');
var typson = require('typson');
var traverse = require('traverse');


module.exports = {
    generate: function (base, source, dest) {
        var uiPath = path.resolve(dest, 'ui');

        gulp.task('copy-swagger', function () {
            var path = gutil.env.env === 'dev' ? '' : 'apikana/node_modules';
            return gulp.src('node_modules/' + path + '/swagger-ui/dist/**', {cwd: base})
                .pipe(gulp.dest(uiPath));
        });

        gulp.task('copy-custom', function () {
            return gulp.src('**/*.css', {cwd: source})
                .pipe(gulp.dest('custom', {cwd: uiPath}));
        });

        gulp.task('inject-css', ['copy-swagger', 'copy-custom'], function () {
            var customCssStart = "<link href='css/print.css' media='print' rel='stylesheet' type='text/css'/>";
            var customCssEnd = '<script src=';
            return gulp.src('index.html', {cwd: uiPath})
                .pipe(inject(gulp.src('custom/**/*.css', {cwd: uiPath, read: false}), {
                    relative: true,
                    starttag: customCssStart,
                    endtag: customCssEnd
                }))
                .pipe(gulp.dest(uiPath));
        });

        gulp.task('generate-schema', function () {
            var v = gutil.env.apiVersion || 'v1';
            gulp.src(v + '/model/**/*.ts', {cwd: source})
                .pipe(generateSchemas())
                .pipe(rename({dirname: v + '/json-schema-v4'}))
                .pipe(gulp.dest(dest))
                .pipe(convertToV3())
                .pipe(rename({dirname: v + '/json-schema-v3'}))
                .pipe(gulp.dest(dest))
        });

        gulp.start(['inject-css', 'generate-schema']);

        function generateSchemas() {
            return through.obj(function (file, enc, cb) {
                var self = this;
                var f = file.path.replace(/\\/g, '/');
                log('Scanning', colors.magenta(file.path));
                typson.definitions(f).done(function (definitions) {
                    var n = Object.keys(definitions).length;
                    for (var type in definitions) {
                        typson.schema(f, type).done(function (schema) {
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
                                if (--n === 0) {
                                    return cb();
                                }
                            }
                        });
                    }
                });
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

