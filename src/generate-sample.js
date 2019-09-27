var gulp = require('gulp');
var File = require('vinyl');
var colors = require('ansi-colors');
var log = require('./log');
var path = require('path');
var fs = require('fs');
var stream = require('stream');
var through = require('through2');
const jsf = require('json-schema-faker');
var str = require('string-to-stream');
var vinylSource = require('vinyl-source-stream');
const slash = require('slash');

module.exports = {
    generateSample: function (source, dest, typeName) {
        
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
                    } else if (endsWith(files[i], '.json')) {
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
       
        function streamFromString(s) {
            var src = new stream.Readable({objectMode: true});
            src._read = function () {
                this.push(new File({path: '.', contents: new Buffer(s)}));
                this.push(null);
            };
            return src;
        }

        task('generate-sample', function() {
            var samplesPath = path.join(source, 'samples');
            var allSamples = [];
            if(nonEmptyDir(samplesPath)) {
                allSamples = readdir(samplesPath, samplesPath)
            }

            var modelsPath = path.join(dest, 'model', 'json-schema-v4');
            var allModels = [];
            if(nonEmptyDir(modelsPath)) {
                allModels = readdir(modelsPath, modelsPath);
            }

            var modelInfo = [];
            allModels.forEach(model => {
                var modelPath = path.join(modelsPath, model)
                var modelId = require(modelPath).id;
                modelInfo.push({id: modelId, path: modelPath})
            });

            if(allSamples.indexOf(`${typeName}.json`) > -1 | allSamples.indexOf(`generated-${typeName}.json`) > -1) {
                log.warn('Sample for type ' + typeName + ' already exists!');
                return emptyStream();
            } else if(modelInfo.find(info => info.id === typeName) === undefined) {
                log.error('No model found for type ' + typeName + '.');
                return emptyStream();
            } else {
                log.info('Generate sample for type: ' + typeName + '');
                var modelData = modelInfo.find(info => info.id === typeName)
                return gulp.src(modelData.path)
                .pipe(through.obj(function (file, enc, cb) {
                    generateFakeData(file);
                    cb();
                }));
            }
        });

        function generateFakeData(file) {
            var json = require(file.path);

            jsf.option({failOnInvalidTypes: true, fileOnInvalidFormat: true, fillProperties:true});

            jsf.resolve(json, file.base).then(sample => {
                sample['$schema'] = slash(path.relative(path.join(source, 'samples'), file.path));
                var data = JSON.stringify(sample, undefined, 2);
                str(data).pipe(vinylSource('generated-'+typeName+'.json')).pipe(gulp.dest('samples', {cwd: source}));
            }, err => console.error(err));
        };

        function emptyStream() {
            return gulp.src([]);
        }

        gulp.start();
    }
};

