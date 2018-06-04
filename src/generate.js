var gulp = require('gulp');
var rename = require('gulp-rename');
var inject = require('gulp-inject');
var File = require('vinyl');
var colors = require('ansi-colors');
var log = require('./log');
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

        var apiFile = path.resolve(source, params.api());
        if (!fs.existsSync(apiFile)) {
            log.info('API file ', colors.magenta(source + '/' + params.api()), 'not found, generating one.');
            var apiDir = path.dirname(apiFile);
            var api = {
                swagger: '2.0',
                info: {title: path.basename(path.resolve('')), version: '1.0'},
                paths: [],
                definitions: {$ref: readdir(path.resolve(source, params.models()), apiDir)}
            };
            fse.mkdirsSync(apiDir);
            fs.writeFileSync(apiFile, yaml.stringify(api, 6, 2));
        }

        function readdir(basedir, relativeTo) {
            var res = [];
            readdir(basedir, res);
            return res;

            function readdir(dir, res) {
                var files = fs.readdirSync(dir);
                for (var i = 0; i < files.length; i++) {
                    var name = path.resolve(dir, files[i]);
                    if (fs.statSync(name).isDirectory()) {
                        readdir(name, res);
                    } else if (endsWith(files[i], '.ts')) {
                        res.push(path.relative(relativeTo, name).replace(/\\/g, '/'));
                    }
                }
            }

            function endsWith(s, sub) {
                return s.substring(s.length - sub.length) === sub;
            }
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
                        log.info('Done', colors.green(name), 'in', first ? (Date.now() - first) / 1000 : '?', 's');
                    })
                    .on('error', function (err) {
                        log.error('Error in', colors.green(name), colors.red(err));
                    });
            });
        }

        task('copy-swagger', function () {
            return module('swagger-ui/dist/**').pipe(gulp.dest(uiPath));
        });

        task('copy-custom', ['copy-swagger'], function () {
            return merge(
                copy(path.resolve(dependencyPath, 'style')),
                copy(path.resolve(source, params.style())));

            function copy(dir) {
                return merge(
                    gulp.src('*', {cwd: dir}).pipe(gulp.dest('style', {cwd: uiPath})),
                    gulp.src('favicon*', {cwd: dir}).pipe(gulp.dest('images', {cwd: uiPath})));
            }
        });

        task('copy-package', function () {
            var source = fs.existsSync('package.json')
                ? gulp.src('package.json')
                : streamFromString('{}');

            return generateEnv.generate(source, gulp.dest('patch', {cwd: uiPath}));
        });

        function streamFromString(s) {
            var src = new stream.Readable({objectMode: true});
            src._read = function () {
                this.push(new File({path: '.', contents: new Buffer(s)}));
                this.push(null);
            };
            return src;
        }

        task('copy-deps', function () {
            return merge(
                module(['yamljs/dist/yaml.js']).pipe(gulp.dest('patch', {cwd: uiPath})),
                module(['object-path/index.js'])
                    .pipe(rename('object-path.js'))
                    .pipe(gulp.dest('patch', {cwd: uiPath})),
                gulp.src('src/deps/*.js', {cwd: apikanaPath}).pipe(gulp.dest('patch', {cwd: uiPath})));
        });

        task('copy-lib', function () {
            return gulp.src('lib/*.js', {cwd: apikanaPath}).pipe(gulp.dest('patch', {cwd: uiPath}));
        });

        task('inject-css', ['copy-swagger', 'copy-custom', 'copy-deps', 'copy-lib'], function () {
            return gulp.src('index.html', {cwd: uiPath})
                .pipe(inject(gulp.src('style/*.css', {cwd: uiPath, read: false}), {
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
            return module(['typescript/lib/lib.d.ts']).pipe(gulp.dest('patch', {cwd: uiPath}));
        });

        var restApi, modelFiles = [];
        task('read-rest-api', function () {
            if (restApi) {
                return emptyStream();
            }
            return gulp.src(params.api(), {cwd: source})
                .pipe(through.obj(function (file, enc, cb) {
                    var raw = file.contents.toString();
                    restApi = file.path.substring(file.path.lastIndexOf('.') + 1) === 'yaml'
                        ? yaml.parse(raw) : JSON.parse(raw);
                    var ref = restApi.definitions && restApi.definitions.$ref;
                    if (ref) {
                        var refBase = path.dirname(path.resolve(source, params.api()));
                        var refs = Array.isArray(ref) ? ref : [ref];
                        for (var i = 0; i < refs.length; i++) {
                            var parts = refs[i].split(/[,\n]/);
                            for (var j = 0; j < parts.length; j++) {
                                var model = parts[j].trim();
                                if (model) {
                                    var modelFile = path.resolve(refBase, model);
                                    if (!fs.existsSync(modelFile)) {
                                        log.error(colors.red('Referenced model file ' + modelFile + ' does not exist.'));
                                    } else {
                                        modelFiles.push(modelFile);
                                    }
                                }
                            }
                        }
                    }
                    if (modelFiles.length > 0) {
                        params.models(path.dirname(modelFiles[0]));
                    }
                    cb();
                }));
        });

        task('generate-schema', ['unpack-models', 'generate-tsconfig', 'copy-package', 'read-rest-api'], function () {
            var collector = emptyStream();
            if (modelFiles.length === 0) {
                if (fs.existsSync(path.resolve(source, params.models()))) {
                    collector = gulp.src(params.models() + '/**/*.ts', {cwd: source})
                        .pipe(through.obj(function (file, enc, cb) {
                            modelFiles.push(file.path);
                            cb();
                        }));
                } else {
                    log.warn(colors.red('Model directory ' + source + '/' + params.models() + ' does not exist.'));
                    require('./generate-schema').mkdirs(dest);
                    return emptyStream();
                }
            }
            return collector.on('finish', function () {
                var tsconfig = path.resolve(source, params.models(), 'tsconfig.json');
                require('./generate-schema').generate(tsconfig, modelFiles, dest, params.dependencyPath());
            });
        });

        task('generate-constants', ['read-rest-api'], function () {
            if (restApi.paths == null || restApi.paths.length === 0) {
                return emptyStream();
            }
            return require('./generate-constants').generate(
                gulp.src(params.api(), {cwd: source}),
                gulp.dest('model', {cwd: dest}));
        });

        task('copy-src', function () {
            if (!params.deploy()) {
                return emptyStream();
            }
            return gulp.src('**/*', {cwd: source}).pipe(gulp.dest('src', {cwd: uiPath}));
        });

        task('copy-ts-model', ['read-rest-api'], function () {
            return gulp.src(params.models() + '/**/*.ts', {cwd: source}).pipe(gulp.dest('model/ts', {cwd: dest}));
        });

        task('unpack-models', function () {
            return merge(
                unpack('dist/model', 'json-schema-v3', '**/*.json'),
                unpack('dist/model', 'json-schema-v4', '**/*.json'),
                unpack('dist/ui', 'style', '**/*', true),
                unpack('dist/model', 'ts', '**/*.ts'),
                gulp.src('src/model/ts/**/*.ts', {cwd: apikanaPath}).pipe(gulp.dest('ts/apikana', {cwd: dependencyPath}))
            );
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

        // TODO why should a dependency overwrite a local definition?
        // TODO why must schemas with same name be equal? We have a proper dependency handling.
        // task('overwrite-schemas', ['generate-schema'], function () {
        //overwrite local schemas with dependency schemas
        //- javaType could be different
        //- verify that schemas with same names are structurally equal (no redefinition allowed)
        // return merge(
        //     gulp.src('json-schema-v3/**/*.json', {cwd: dependencyPath})
        //         .pipe(through.obj(function (file, enc, cb) {
        //             var filename = path.parse(file.path);
        //             var existing = path.resolve(dest, 'model/json-schema-v3', filename.base);
        //             if (fs.existsSync(existing)) {
        //                 var schema1 = JSON.parse(fs.readFileSync(existing));
        //                 var schema2 = JSON.parse(file.contents.toString());
        //                 if (!schemaEquals(schema1, schema2)) {
        //                     log(colors.red('Type'), colors.magenta(filename.name),
        //                         colors.red('is defined differently in'),
        //                         colors.magenta(schema1.definedIn, '(', path.relative(source, existing), ')'),
        //                         colors.red('and in'),
        //                         colors.magenta(schema2.definedIn, '(', path.relative(source, file.path), ')'));
        //                     throw new gutil.PluginError('apikana', 'multi definition');
        //                 }
        //             }
        //             this.push(file);
        //             cb();
        //         }))
        //         .pipe(rename(function (path) {
        //             path.dirname = '';
        //             return path;
        //         }))
        //         .pipe(gulp.dest('model/json-schema-v3', {cwd: dest})),
        //     gulp.src('json-schema-v4/**/*.json', {cwd: dependencyPath})
        //         .pipe(rename(function (path) {
        //             path.dirname = '';
        //             return path;
        //         }))
        //         .pipe(gulp.dest('model/json-schema-v4', {cwd: dest})));
        // });

        // function schemaEquals(s1, s2) {
        //     if (Object.keys(s1).length !== Object.keys(s2).length) {
        //         return false;
        //     }
        //     for (var p in s1) {
        //         if (/*p === 'definedIn' ||*/ p === 'javaType') {
        //             continue;
        //         }
        //         var val1 = s1[p];
        //         var val2 = s2[p];
        //         if (typeof val1 === 'object' && val1 != null && val2 != null) {
        //             if (!schemaEquals(val1, val2)) {
        //                 return false;
        //             }
        //         } else if (val1 !== val2) {
        //             return false;
        //         }
        //     }
        //     return true;
        // }

        task('generate-tsconfig', ['read-rest-api'], function () {
            if (!fs.existsSync(path.resolve(source, params.models()))) {
                return emptyStream();
            }
            var tsconfig = path.resolve(source, params.models(), 'tsconfig.json');
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
                    this.push(new File({
                        path: file.path,
                        contents: new Buffer(JSON.stringify(config, null, 2))
                    }));
                    cb();
                }))
                .pipe(gulp.dest(''));
        });

        //TODO same problem as in generate-schema: if there are schemas with the same name from different dependencies,
        //we need structural comparision
        task('generate-full-rest', ['read-rest-api'/*, 'overwrite-schemas'*/], function () {
            var completeApi = Object.assign({}, restApi);
            completeApi.definitions = {};
            delete completeApi.definitions.$ref;
            var fileToType = {};
            return gulp.src('model/json-schema-v4/**/*.json', {cwd: dest})
                .pipe(through.obj(function (file, enc, cb) {
                    var schema = JSON.parse(file.contents.toString());
                    fileToType[path.parse(file.path).base] = schema.id;
                    Object.assign(completeApi.definitions, schema.definitions);
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
                    var out = path.resolve(dest, 'model/openapi');
                    fse.mkdirsSync(out);
                    fs.writeFileSync(path.resolve(out, 'api.json'), JSON.stringify(restApi, null, 2));
                    fs.writeFileSync(path.resolve(out, 'api.yaml'), yaml.stringify(restApi, 6, 2));
                    fs.writeFileSync(path.resolve(out, 'complete-api.json'), JSON.stringify(completeApi, null, 2));
                    fs.writeFileSync(path.resolve(out, 'complete-api.yaml'), yaml.stringify(completeApi, 6, 2));
                });
        });

        task('serve', ['inject-css'], function () {
            if (!params.serve()) {
                return emptyStream();
            }
            //argv is node, apikana, start, options...
            var args = process.argv.slice(3);
            args.unshift(process.argv[1] + '-serve');
            var proc = require('child_process').spawn(process.argv[0], args, {detached: true, stdio: 'ignore'});
            proc.unref();
            var port = params.port();
            log.info('***** Serving API at', colors.blue(colors.underline('http://localhost:' + port)), '*****');
            return emptyStream();
        });

        function emptyStream() {
            return gulp.src([]);
        }

        gulp.start();
    }
};

