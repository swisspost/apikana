var File = require('vinyl');
var colors = require('ansi-colors');
var log = require('./log');
var gen = require('./java-gen');

module.exports = function (model, javaPackage, apiName) {
    apiName += 'PathVariables';
    var contents = '';
    return {
        start: function () {
            contents += 'package ' + javaPackage + ';\n\n';
            contents += 'public final class ' + gen.classOf(apiName) + ' {\n';
        },
        write: function () {
            write(model.full);
        },
        finish: function () {
            contents += '    private ' + gen.classOf(apiName) + '(){}\n}';
        },
        toFile: function () {
            log.info('Generated', colors.magenta(gen.classOf(apiName) + '.java'));
            return new File({
                path: 'java/' + javaPackage.replace(/\./g, '/') + '/' + gen.classOf(apiName) + '.java',
                contents: new Buffer(contents)
            });
        }
    };

    function write(obj) {
        var vars = {};
        doWrite(obj);
        for (var prop in vars) {
            line(1, 'public static final String ' + gen.constOf(prop) + ' = "' + prop + '";');
        }

        function doWrite(obj) {
            for (var prop in obj) {
                if (obj[prop] && obj[prop]['/param']) {
                    vars[prop] = true;
                }
                if (typeof obj[prop] === 'object') {
                    doWrite(obj[prop]);
                }
            }
        }
    }

    function line(level, s) {
        contents += gen.pad(level) + s + '\n';
    }
};

