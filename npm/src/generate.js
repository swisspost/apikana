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

        gulp.task('copy-swagger', function () {
            return module('swagger-ui/dist/**').pipe(gulp.dest(uiPath));
        });

        gulp.task('copy-custom', function () {
            return gulp.src('**/*.css', {cwd: source}).pipe(gulp.dest('custom', {cwd: uiPath}));
        });

        gulp.task('copy-package', function () {
            return require('./generate-env').generate(
                gulp.src('package.json', {cwd: base}),
                gulp.dest('patch', {cwd: uiPath}));
        });

        gulp.task('copy-deps', function () {
            module(['typson//requirejs/require.js', 'yamljs/dist/yaml.js'])
                .pipe(gulp.dest('patch', {cwd: uiPath}));
            module(['object-path/index.js'])
                .pipe(rename('object-path.js'))
                .pipe(gulp.dest('patch', {cwd: uiPath}));
            return gulp.src('src/deps/*.js', {cwd: apikanaPath}).pipe(gulp.dest('patch', {cwd: uiPath}));
        });

        gulp.task('browserify-docson', function () {
            return require('./generate-docson').generate(
                path.resolve(apikanaPath, 'src/docson.js'),
                gulp.dest('patch', {cwd: uiPath}));
        });

        gulp.task('inject-css', ['copy-swagger', 'copy-custom', 'copy-deps', 'copy-package', 'browserify-docson'], function () {
            return gulp.src('index.html', {cwd: uiPath})
                .pipe(inject(gulp.src('custom/**/*.css', {cwd: uiPath, read: false}), {
                    relative: true,
                    starttag: "<link href='css/print.css' media='print' rel='stylesheet' type='text/css'/>",
                    endtag: '<script '
                }))
                .pipe(inject(gulp.src(['helper.js', 'docson.js', 'object-path.js', 'require.js', 'variables.js', 'yaml.js'], {
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

        gulp.task('copy-deps-unref', function () {
            module('traverse/index.js')
                .pipe(rename('traverse.js'))
                .pipe(replace('module.exports =', ''))
                .pipe(gulp.dest('vendor', {cwd: uiPath}));
            return module([
                'typson/lib/typson-schema.js', 'typson//underscore/underscore.js', 'typson//q/q.js',
                'traverse/traverse.js', 'typson//superagent/superagent.js', 'typson/lib/typson.js', 'typson/vendor/typescriptServices.js',
                'typescript/lib/lib.d.ts'])
                .pipe(gulp.dest('vendor', {cwd: uiPath}));
        });

        var referencedModels = [];
        gulp.task('referenced-models', function () {
            return gulp.src('rest/openapi/api.@(json|yaml)', {cwd: source})
                .pipe(through.obj(function (file, enc, cb) {
                    var api = fileContents(file);
                    for (var i = 0; i < api.tsModels.length; i++) {
                        referencedModels.push(path.resolve(source, 'rest/openapi', api.tsModels[i]));
                    }
                    cb();
                }));
        });

        gulp.task('generate-schema', ['referenced-models'], function () {
            referencedModels.push('model/ts/**/*.ts');
            return require('./generate-schema').generate(
                gulp.src(referencedModels, {cwd: source}),
                function () {
                    return gulp.dest(dest);
                });
        });

        function fileContents(file) {
            var raw = file.contents.toString();
            return file.path.substring(file.path.lastIndexOf('.') + 1) === 'yaml'
                ? yaml.parse(raw) : JSON.parse(raw);
        }


        gulp.task('generate-constants', function () {
            return require('./generate-constants').generate(
                gulp.src('rest/openapi/api.@(json|yaml)', {cwd: source}),
                gulp.dest('model/java', {cwd: dest}));
        });

        gulp.task('copy-src', function () {
            if (gutil.env.deploy && gutil.env.deploy != 'false') {
                return gulp.src('**/*', {cwd: source}).pipe(gulp.dest('src', {cwd: uiPath}));
            }
        });

        // gulp.task('generate-tsconfig', function () {
        //     var tsconfig = path.resolve(source, 'model/ts/tsconfig.json');
        //     if (!fs.existsSync(tsconfig)) {
        //         fs.writeFileSync(tsconfig, '{}');
        //     }
        //     return gulp.src(tsconfig)
        //         .pipe(through.obj(function (file, enc, cb) {
        //             var config = JSON.parse(file);
        //             var e = json.compilerOptions;
        //             if (!e) {
        //                 e = json.compilerOptions = {};
        //             }
        //             if (!e.paths) {
        //                 e.paths = {};
        //             }
        //             if (!e.paths['*']) {
        //                 e.paths['*'] = {};
        //             }
        //
        //             cb();
        //         }))
        //         .pipe(gulp.dest(''));
        // });


        gulp.start(['inject-css', 'copy-deps-unref', 'generate-schema', 'generate-constants', 'copy-src'/*, 'generate-tsconfig'*/]);
    }
};

