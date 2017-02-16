var rename = require('gulp-rename');
var gutil = require('gulp-util');
var through = require('through2');
var objectPath = require('object-path');

module.exports = {
    generate: function (source, dest) {
        return source
            .pipe(rename('variables.js'))
            .pipe(enrichWithEnv())
            .pipe(dest);

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

