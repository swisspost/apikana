var gulp = require('gulp');
var rename = require('gulp-rename');
var inject = require('gulp-inject');
var gutil = require('gulp-util');
var replace = require('gulp-replace');
var colors = gutil.colors;
var log = gutil.log;
var path = require('path');
var through = require('through2');
var typson = require('typson');
var traverse = require('traverse');


module.exports = {
    generate: function (base, source, dest) {
        var uiPath = path.resolve(dest, 'ui');
        var modulesPath = path.resolve(base, 'node_modules');
        var apikanaPath = gutil.env.env === 'dev' ? base : path.resolve(modulesPath, 'apikana');

        gulp.task('copy-swagger', function () {
            return gulp.src('swagger-ui/dist/**', {cwd: modulesPath})
                .pipe(gulp.dest(uiPath));
        });

        gulp.task('copy-custom', function () {
            return gulp.src('**/*.css', {cwd: source})
                .pipe(gulp.dest('custom', {cwd: uiPath}));
        });

        gulp.task('copy-deps', function () {
            gulp.src(['requirejs/require.js'], {cwd: modulesPath})
                .pipe(gulp.dest('custom', {cwd: uiPath}));
            return gulp.src('src/deps/*.js', {cwd: apikanaPath})
                .pipe(gulp.dest('custom', {cwd: uiPath}));
        });

        gulp.task('copy-deps-unref', function () {
            gulp.src('traverse/index.js', {cwd: modulesPath})
                .pipe(rename('traverse.js'))
                .pipe(replace('module.exports =', ''))
                .pipe(gulp.dest('vendor', {cwd: uiPath}));
            return gulp.src([
                    'typson/lib/typson-schema.js', 'underscore/underscore.js', 'q/q.js', 'traverse/traverse.js',
                    'superagent/superagent.js', 'typson/lib/typson.js', 'typson/vendor/typescriptServices.js'],
                {cwd: modulesPath})
                .pipe(gulp.dest('vendor', {cwd: uiPath}));
        });

        gulp.task('inject-css', ['copy-swagger', 'copy-custom', 'copy-deps'], function () {
            return gulp.src('index.html', {cwd: uiPath})
                .pipe(inject(gulp.src('custom/**/*.css', {cwd: uiPath, read: false}), {
                    relative: true,
                    starttag: "<link href='css/print.css' media='print' rel='stylesheet' type='text/css'/>",
                    endtag: '<script '
                }))
                .pipe(inject(gulp.src('custom/*.js', {cwd: uiPath, read: false}), {
                    relative: true,
                    starttag: "<!-- <script src='lang/en.js' type='text/javascript'></script> -->",
                    endtag: '<script '
                }))
                .pipe(replace('url: url,', 'url:"", spec:spec, validatorUrl:null,'))
                .pipe(gulp.dest(uiPath));
        });

        gulp.task('generate-schema', function () {
            gulp.src('model/**/*.ts', {cwd: source})
                .pipe(generateSchemas())
                .pipe(rename({dirname: 'model/json-schema-v4'}))
                .pipe(gulp.dest(dest))
                .pipe(convertToV3())
                .pipe(rename({dirname: 'model/json-schema-v3'}))
                .pipe(gulp.dest(dest))
        });

        gulp.start(['inject-css', 'copy-deps-unref', 'generate-schema']);

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

