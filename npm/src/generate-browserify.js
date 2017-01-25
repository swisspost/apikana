var browserify = require('browserify');
var path = require('path');
var brfs = require('brfs');
var sourceStream = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var gutil = require('gulp-util');

module.exports = {
    generate: function (source, dest) {
        return browserify(source, {
            transform: [brfs]
        })
            .ignore('source-map-support')
            .ignore('fs')
            .bundle()
            .pipe(sourceStream('browserify.js'))
            .pipe(buffer())
            .pipe(dest);
    }
};

