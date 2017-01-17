var gulp = require('gulp');
var rename = require('gulp-rename');
var inject = require('gulp-inject');
var gutil = require('gulp-util');
var replace = require('gulp-replace');
var path = require('path');
var fs = require('fs');
var through = require('through2');
var traverse = require('traverse');
var objectPath = require('object-path');

module.exports = {
    generate: function (base, source, dest) {
        var uiPath = path.resolve(dest, 'ui');
        var modulesPath = path.resolve(base, 'node_modules');
        var apikanaPath = gutil.env.env === 'dev' ? base : path.resolve(modulesPath, 'apikana');
        var flatModules = gutil.env.env === 'dev' || !fs.existsSync(path.resolve(apikanaPath, 'node_modules'));

        console.log('flat: ' + flatModules);
        console.log('modules: ' + modulesPath);

        function module(pattern) {
            var p = resolve(pattern);
            console.log('copy ' + p);
            return gulp.src(p);
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
            return gulp.src('package.json', {cwd: base})
                .pipe(rename('variables.js'))
                .pipe(enrichWithEnv())
                .pipe(gulp.dest('patch', {cwd: uiPath}));
        });

        gulp.task('copy-deps', function () {
            module(['typson//requirejs/require.js', 'yamljs/dist/yaml.js'])
                .pipe(gulp.dest('patch', {cwd: uiPath}));
            module(['object-path/index.js'])
                .pipe(rename('object-path.js'))
                .pipe(gulp.dest('patch', {cwd: uiPath}));
            return gulp.src('src/deps/*.js', {cwd: apikanaPath}).pipe(gulp.dest('patch', {cwd: uiPath}));
        });

        gulp.task('copy-deps-unref', function () {
            module('traverse/index.js')
                .pipe(rename('traverse.js'))
                .pipe(replace('module.exports =', ''))
                .pipe(gulp.dest('vendor', {cwd: uiPath}));
            return module([
                'typson/lib/typson-schema.js', 'typson//underscore/underscore.js', 'typson//q/q.js',
                'traverse/traverse.js', 'typson//superagent/superagent.js', 'typson/lib/typson.js', 'typson/vendor/typescriptServices.js'])
                .pipe(gulp.dest('vendor', {cwd: uiPath}));
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

        gulp.task('generate-schema', function () {
            return require('./generate-schema').generate(
                gulp.src('model/**/*.ts', {cwd: source}),
                function () {
                    return gulp.dest(dest);
                });
        });

        gulp.task('browserify-docson', function () {
            return require('./generate-docson').generate(
                path.resolve(apikanaPath, 'src/docson.js'),
                gulp.dest('patch', {cwd: uiPath}));
        });

        gulp.start(['inject-css', 'copy-deps-unref', 'generate-schema']);

        function enrichWithEnv() {
            return through.obj(function (file, enc, cb) {
                var json = JSON.parse(file.contents);
                for (var prop in gutil.env) {
                    objectPath.set(json, prop, gutil.env[prop]);
                }
                this.push(new gutil.File({
                    path: file.path,
                    contents: new Buffer('var variables=' + JSON.stringify(json, null, 2))
                }));
                cb();
            });
        }
    }
};

