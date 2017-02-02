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
var through = require('through2');
var yaml = require('yamljs');


module.exports = {
    generate: function (base, source, dest) {
        var uiPath = path.resolve(dest, 'ui');
        var modulesPath = path.resolve(base, 'node_modules');
        var apikanaPath = gutil.env.env === 'dev' ? base : path.resolve(modulesPath, 'apikana');
        var flatModules = gutil.env.env === 'dev' || !fs.existsSync(path.resolve(apikanaPath, 'node_modules'));
        var dependencyPath = path.resolve(base, gutil.env.dependencyPath || 'node_modules/$api-dependencies');

        log('flat: ' + flatModules);
        log('modules: ' + modulesPath);

        if (!nonEmptyDir(path.resolve(source, 'model/ts'))) {
            log(colors.red('Empty model directory ' + source + '/model/ts'));
        }
        if (!nonEmptyDir(path.resolve(source, 'rest/openapi'))) {
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
                return path.resolve(modulesPath, flatModules
                    ? p.replace(/.*?\/\//, '')
                    : 'apikana/node_modules/' + p.replace(/(.*?)\/\//, '$1/node_modules/'));
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
            })
        }

        task('copy-swagger', function () {
            return module('swagger-ui/dist/**').pipe(gulp.dest(uiPath));
        });

        task('copy-custom', function () {
            return gulp.src('**/*.css', {cwd: source}).pipe(gulp.dest('custom', {cwd: uiPath}));
        });

        task('copy-package', function () {
            return require('./generate-env').generate(
                gulp.src('package.json', {cwd: base}),
                gulp.dest('patch', {cwd: uiPath}));
        });

        task('copy-deps', function () {
            module(['yamljs/dist/yaml.js']).pipe(gulp.dest('patch', {cwd: uiPath}));
            module(['object-path/index.js'])
                .pipe(rename('object-path.js'))
                .pipe(gulp.dest('patch', {cwd: uiPath}));
            return gulp.src('src/deps/*.js', {cwd: apikanaPath}).pipe(gulp.dest('patch', {cwd: uiPath}));
        });

        task('copy-lib', function () {
            return gulp.src('lib/*.js', {cwd: apikanaPath}).pipe(gulp.dest('patch', {cwd: uiPath}));
        });

        task('inject-css', ['copy-swagger', 'copy-custom', 'copy-deps', 'copy-package', 'copy-lib'], function () {
            return gulp.src('index.html', {cwd: uiPath})
                .pipe(inject(gulp.src('custom/**/*.css', {cwd: uiPath, read: false}), {
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

        //
        //needed?
        var referencedModels = [];
        task('referenced-models', function () {
            return gulp.src('rest/openapi/api.@(json|yaml)', {cwd: source})
                .pipe(through.obj(function (file, enc, cb) {
                    var api = fileContents(file);
                    for (var i = 0; i < api.tsModels.length; i++) {
                        referencedModels.push(path.resolve(source, 'rest/openapi', api.tsModels[i]));
                    }
                    cb();
                }));
        });

        function fileContents(file) {
            var raw = file.contents.toString();
            return file.path.substring(file.path.lastIndexOf('.') + 1) === 'yaml'
                ? yaml.parse(raw) : JSON.parse(raw);
        }

        task('generate-schema', ['referenced-models', 'unpack-models'], function () {
            referencedModels.push('model/ts/**/*.ts');
            return require('./generate-schema').generate(
                path.resolve(source, 'model/ts/tsconfig.json'),
                gulp.src(referencedModels, {cwd: source}), dest);
        });

        task('generate-constants', function () {
            return require('./generate-constants').generate(
                gulp.src('rest/openapi/api.@(json|yaml)', {cwd: source}),
                gulp.dest('model/java', {cwd: dest}));
        });

        task('copy-src', function () {
            if (gutil.env.deploy && gutil.env.deploy != 'false') {
                return gulp.src('**/*', {cwd: source}).pipe(gulp.dest('src', {cwd: uiPath}));
            }
            return gulp.src([]);
        });

        task('unpack-models', function () {
            unpack('dist/model', 'json-schema-v3', '**/*.json');
            unpack('dist/model', 'json-schema-v4', '**/*.json');
            return unpack('src/model', 'ts', '**/*.ts');
        });

        function unpack(baseDir, subDir, pattern) {
            return gulp.src('**/node_modules/*/' + baseDir + '/' + subDir + '/' + pattern, {cwd: base})
                .pipe(rename(function (path) {
                    var dir = path.dirname.replace(/\\/g, '/');
                    dir = dir.substring(dir.lastIndexOf('node_modules/') + 13);
                    var ms = dir.indexOf('/');
                    dir = subDir + '/' + dir.substring(0, ms);
                    path.dirname = dir;
                }))
                .pipe(gulp.dest(dependencyPath));
        }

        task('overwrite-schemas', ['generate-schema'], function () {
            return gulp.src('json-schema-v3/**/*.json', {cwd: dependencyPath})
                .pipe(rename(function (path) {
                    path.dirname = '';
                    return path;
                }))
                .pipe(gulp.dest('model/json-schema-v3', {cwd: dest}));
        });

        task('generate-tsconfig', function () {
            var tsconfig = path.resolve(source, 'model/ts/tsconfig.json');
            if (!fs.existsSync(tsconfig)) {
                fs.writeFileSync(tsconfig, '{}');
            }
            return gulp.src(tsconfig)
                .pipe(through.obj(function (file, enc, cb) {
                    var config = JSON.parse(file.contents);
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

        task('serve', ['inject-css'], function () {
            var args = process.argv.slice(1);
            args[0] += '-serve';
            var proc = require('child_process').spawn(process.argv[0], args, {detached: true, stdio: 'ignore'});
            proc.unref();
            return gulp.src([]);
        });

        gulp.start();
    }
};

