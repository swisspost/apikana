var gulp = require('gulp');
var rename = require('gulp-rename');
var inject = require('gulp-inject');
var gutil = require('gulp-util');
var colors = gutil.colors;
var log = gutil.log;
var replace = require('gulp-replace');
var path = require('path');
var fs = require('fs');
var traverse = require('traverse');
var stream = require('stream');
var merge = require('merge-stream');
var through = require('through2');
var yaml = require('yamljs');
var params = require('./params');
var generateEnv = require('./generate-env');
var fse = require('fs-extra');

module.exports = {
    generate: function (source, dest) {
        var uiPath = path.resolve(dest, 'ui');
        var apikanaPath = path.resolve(__dirname, '..');
        var privateModules = path.resolve(apikanaPath, 'node_modules');
        var modulesPath = fs.existsSync(privateModules) ? privateModules : path.resolve('node_modules');
        var dependencyPath = path.resolve(params.dependencyPath());

        var modelsExist = nonEmptyDir(path.resolve(source, 'model/ts'));
        var restExist = fs.existsSync(path.resolve(source, 'rest/openapi/api.yaml')) || fs.existsSync(path.resolve(source, 'rest/openapi/api.json'));
        if (!modelsExist) {
            log(colors.red('Empty model directory ' + source + '/model/ts'));
        }
        if (!restExist) {
            log(colors.red('Empty rest directory ' + source + '/rest/openapi'));
        }

        function nonEmptyDir(path) {
            return fs.existsSync(path) && fs.readdirSync(path).length > 0;
        }

        function module(pattern) {
            return gulp.src(resolve(pattern));
        }

        function resolve(pattern) {
            return Array.isArray(pattern) ? pattern.map(doResolve) : doResolve(pattern);
            function doResolve(p) {
                return path.resolve(modulesPath, p);
            }
        }

        function task(name, deps, func) {
            if (!func) {
                func = deps;
                deps = [];
            }
            gulp.task(name, deps, function () {
                var start = Date.now();
                var first;
                // log('start', colors.green(name));
                return func()
                    .on('readable', function () {
                        if (!first) {
                            first = Date.now();
                        }
                    })
                    .on('finish', function () {
                        log('Done', colors.green(name), 'in', first ? (Date.now() - first) / 1000 : '?', 's');
                    })
                    .on('error', function (err) {
                        log('Error in', colors.green(name), colors.red(err));
                    });
            });
        }

        task('copy-swagger', function () {
            if (!restExist) {
                return emptyStream();
            }
            return module('swagger-ui/dist/**').pipe(gulp.dest(uiPath));
        });

        task('copy-custom', ['copy-swagger'], function () {
            return merge(copy(dependencyPath), copy(source));

            function copy(dir) {
                return merge(
                    gulp.src('style/@(*.ico|*.png|*.gif)', {cwd: dir}).pipe(gulp.dest('images', {cwd: uiPath})),
                    gulp.src('style/*.css', {cwd: dir}).pipe(gulp.dest('custom-css', {cwd: uiPath})));
            }
        });

        task('copy-package', function () {
            if (!restExist) {
                return emptyStream();
            }

            var source = fs.existsSync('package.json')
                ? gulp.src('package.json')
                : streamFromString('{}');

            return generateEnv.generate(source, gulp.dest('patch', {cwd: uiPath}));
        });

        function streamFromString(s) {
            var src = new stream.Readable({objectMode: true});
            src._read = function () {
                this.push(new gutil.File({path: '.', contents: new Buffer(s)}));
                this.push(null);
            };
            return src;
        }

        task('copy-deps', function () {
            if (!restExist) {
                return emptyStream();
            }
            return merge(
                module(['yamljs/dist/yaml.js']).pipe(gulp.dest('patch', {cwd: uiPath})),
                module(['object-path/index.js'])
                    .pipe(rename('object-path.js'))
                    .pipe(gulp.dest('patch', {cwd: uiPath})),
                gulp.src('src/deps/*.js', {cwd: apikanaPath}).pipe(gulp.dest('patch', {cwd: uiPath})));
        });

        task('copy-lib', function () {
            if (!restExist) {
                return emptyStream();
            }
            return gulp.src('lib/*.js', {cwd: apikanaPath}).pipe(gulp.dest('patch', {cwd: uiPath}));
        });

        task('inject-css', ['copy-swagger', 'copy-custom', 'copy-deps', 'copy-lib'], function () {
            return gulp.src('index.html', {cwd: uiPath})
                .pipe(inject(gulp.src('custom-css/*.css', {cwd: uiPath, read: false}), {
                    relative: true,
                    starttag: "<link href='css/print.css' media='print' rel='stylesheet' type='text/css'/>",
                    endtag: '<script '
                }))
                .pipe(inject(gulp.src(['helper.js', 'browserify.js', 'object-path.js', 'variables.js', 'yaml.js'], {
                    cwd: uiPath + '/patch',
                    read: false
                }), {
                    relative: true,
                    starttag: "<!-- <script src='lang/en.js' type='text/javascript'></script> -->",
                    endtag: '<script '
                }))
                .pipe(replace('url: url,', 'url:"", spec:spec, validatorUrl:null,'))
                .pipe(replace('onComplete: function(swaggerApi, swaggerUi){', 'onComplete: function(swaggerApi, swaggerUi){ renderDocson();'))
                .pipe(gulp.dest(uiPath));
        });

        task('copy-deps-unref', function () {
            if (!restExist) {
                return emptyStream();
            }
            return module(['typescript/lib/lib.d.ts']).pipe(gulp.dest('patch', {cwd: uiPath}));
        });

        var restApi;
        task('read-rest-api', function () {
            if (restApi) {
                return emptyStream();
            }
            return gulp.src('rest/openapi/api.@(json|yaml)', {cwd: source})
                .pipe(through.obj(function (file, enc, cb) {
                    var raw = file.contents.toString();
                    restApi = file.path.substring(file.path.lastIndexOf('.') + 1) === 'yaml'
                        ? yaml.parse(raw) : JSON.parse(raw);
                    cb();
                }));
        });

        task('generate-schema', ['unpack-models', 'generate-tsconfig', 'copy-package', 'read-rest-api'], function () {
            var files = [];
            var collector = emptyStream();
            if (restExist) {
                for (var i = 0; i < restApi.tsModels.length; i++) {
                    files.push(path.resolve(source, 'rest/openapi', restApi.tsModels[i]));
                }
            } else if (modelsExist) {
                collector = gulp.src('model/ts/**/*.ts', {cwd: source})
                    .pipe(through.obj(function (file, enc, cb) {
                        files.push(file.path);
                        cb();
                    }));
            }
            return collector.on('finish', function () {
                require('./generate-schema').generate(path.resolve(source, 'model/ts/tsconfig.json'), files, dest);
            });
        });

        task('generate-constants', function () {
            if (!params.javaPackage()) {
                return emptyStream();
            }
            return require('./generate-constants').generate(
                gulp.src('rest/openapi/api.@(json|yaml)', {cwd: source}),
                gulp.dest('model/java', {cwd: dest}));
        });

        task('copy-src', function () {
            if (!params.deploy()) {
                return emptyStream();
            }
            return gulp.src('**/*', {cwd: source}).pipe(gulp.dest('src', {cwd: uiPath}));
        });

        task('unpack-models', function () {
            return merge(
                unpack('dist/model', 'json-schema-v3', '**/*.json'),
                unpack('dist/model', 'json-schema-v4', '**/*.json'),
                unpack('src', 'style', '**/*', true),
                unpack('src/model', 'ts', '**/*.ts'));
        });

        function unpack(baseDir, subDir, pattern, absolute) {
            return gulp.src('**/node_modules/*/' + baseDir + '/' + subDir + '/' + pattern)
                .pipe(rename(function (path) {
                    var dir = path.dirname.replace(/\\/g, '/');
                    dir = dir.substring(dir.lastIndexOf('node_modules/') + 13);
                    var moduleEnd = dir.indexOf('/');
                    var pathStart = dir.indexOf(subDir);
                    dir = absolute ? dir.substring(pathStart) : (subDir + '/' + dir.substring(0, moduleEnd));
                    path.dirname = dir;
                }))
                .pipe(gulp.dest(dependencyPath));
        }

        task('overwrite-schemas', ['generate-schema'], function () {
            //overwrite local schemas with dependency schemas
            //- javaType could be different
            //- verify that schemas with same names are structurally equal (no redefinition allowed)
            return merge(
                gulp.src('json-schema-v3/**/*.json', {cwd: dependencyPath})
                    .pipe(through.obj(function (file, enc, cb) {
                        var filename = path.parse(file.path);
                        var existing = path.resolve(dest, 'model/json-schema-v3', filename.base);
                        if (fs.existsSync(existing)) {
                            var schema1 = JSON.parse(fs.readFileSync(existing));
                            var schema2 = JSON.parse(file.contents.toString());
                            if (!schemaEquals(schema1, schema2)) {
                                log(colors.red('Type'), colors.magenta(filename.name),
                                    colors.red('is defined differently in'),
                                    colors.magenta(schema1.definedIn, '(', path.relative(source, existing), ')'),
                                    colors.red('and in'),
                                    colors.magenta(schema2.definedIn, '(', path.relative(source, file.path), ')'));
                                throw new gutil.PluginError('apikana', 'multi definition');
                            }
                        }
                        this.push(file);
                        cb();
                    }))
                    .pipe(rename(function (path) {
                        path.dirname = '';
                        return path;
                    }))
                    .pipe(gulp.dest('model/json-schema-v3', {cwd: dest})),
                gulp.src('json-schema-v4/**/*.json', {cwd: dependencyPath})
                    .pipe(rename(function (path) {
                        path.dirname = '';
                        return path;
                    }))
                    .pipe(gulp.dest('model/json-schema-v4', {cwd: dest})));
        });

        function schemaEquals(s1, s2) {
            if (Object.keys(s1).length !== Object.keys(s2).length) {
                return false;
            }
            for (var p in s1) {
                if (p === 'definedIn' || p === 'javaType') {
                    continue;
                }
                var val1 = s1[p];
                var val2 = s2[p];
                if (typeof val1 === 'object' && val1 != null && val2 != null) {
                    if (!schemaEquals(val1, val2)) {
                        return false;
                    }
                } else if (val1 !== val2) {
                    return false;
                }
            }
            return true;
        }

        task('generate-tsconfig', function () {
            if (!modelsExist) {
                return emptyStream();
            }
            var tsconfig = path.resolve(source, 'model/ts/tsconfig.json');
            if (!fs.existsSync(tsconfig)) {
                fs.writeFileSync(tsconfig, '{}');
            }
            return gulp.src(tsconfig)
                .pipe(through.obj(function (file, enc, cb) {
                    var config;
                    try {
                        config = JSON.parse(file.contents);
                    } catch (e) {
                        config = {};
                    }
                    var co = config.compilerOptions;
                    if (!co) {
                        co = config.compilerOptions = {};
                    }
                    var configDir = path.dirname(file.path);
                    co.baseUrl = path.relative(configDir, dependencyPath + '/ts').replace(/\\/g, '/');
                    this.push(new gutil.File({
                        path: file.path,
                        contents: new Buffer(JSON.stringify(config, null, 2))
                    }));
                    cb();
                }))
                .pipe(gulp.dest(''));
        });

        task('generate-full-rest', ['read-rest-api', 'overwrite-schemas'], function () {
            var completeApi = Object.assign({}, restApi);
            completeApi.definitions = {};
            delete completeApi.tsModels;
            var fileToType = {};
            return gulp.src('model/json-schema-v3/**/*.json', {cwd: dest})
                .pipe(through.obj(function (file, enc, cb) {
                    var schema = JSON.parse(file.contents.toString());
                    fileToType[path.parse(file.path).base] = schema.id;
                    delete schema.definitions;
                    delete schema.$schema;
                    completeApi.definitions[schema.id] = schema;
                    cb();
                }))
                .on('finish', function () {
                    traverse.forEach(completeApi, function (value) {
                        if (this.key === '$ref' && fileToType[value]) {
                            this.update('#/definitions/' + fileToType[value]);
                        }
                    });
                    var out = path.resolve(dest, 'model/rest/openapi');
                    fse.mkdirsSync(out);
                    fs.writeFileSync(path.resolve(out, 'complete-api.json'), JSON.stringify(completeApi, null, 2));
                    fs.writeFileSync(path.resolve(out, 'complete-api.yaml'), yaml.stringify(completeApi, 6, 2));
                });
        });

        task('serve', ['inject-css'], function () {
            if (!restExist || !params.serve()) {
                return emptyStream();
            }
            //argv is node, apikana, start, options...
            var args = process.argv.slice(3);
            args.unshift(process.argv[1] + '-serve');
            var proc = require('child_process').spawn(process.argv[0], args, {detached: true, stdio: 'ignore'});
            proc.unref();
            var port = params.port();
            log('***** Serving API at', colors.blue.underline('http://localhost:' + port), '*****');
            return emptyStream();
        });

        function emptyStream() {
            return gulp.src([]);
        }

        gulp.start();
    }
};

