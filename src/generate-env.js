var rename = require('gulp-rename');
var File = require('vinyl');
var through = require('through2');
var params = require('./params');

var variables = params.enrichWithParams({});

module.exports = {
    variables: function () {
        return variables;
    },
    generate: function (source, dest) {
        return source
            .pipe(rename('variables.js'))
            .pipe(enrichWithEnv())
            .pipe(dest);

        function enrichWithEnv() {
            return through.obj(function (file, enc, cb) {
                variables = params.enrichWithParams(JSON.parse(file.contents));
                this.push(new File({
                    path: file.path,
                    contents: new Buffer('var variables=' + JSON.stringify(variables, null, 2))
                }));
                cb();
            });
        }
    }
};

