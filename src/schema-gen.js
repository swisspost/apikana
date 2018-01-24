var typescript = require('typescript');

//important: patch readFile before require typescript-to-json-schema-extra
var readFile = typescript.sys.readFile;
if (!readFile.patched) {
    typescript.sys.readFile = function (name) {
        var file = readFile(name);
        return isTsFilename(name) ? makeAsTypes(file) : file;

        function makeAsTypes(file) {
            return file.replace(/@type /g, '@asType ');
        }
    };
    typescript.sys.readFile.patched = true;
}

function isTsFilename(name) {
    return name.substring(name.length - 3) === '.ts' && name.substring(name.length - 5) !== '.d.ts';
}

var tjs = require('typescript-to-json-schema-extra/dist');
var program = require('typescript-to-json-schema-extra/dist/factory/program');
var parser = require('typescript-to-json-schema/dist/factory/parser');
var formatter = require('typescript-to-json-schema/dist/factory/formatter');

exports = {
    generate: function (tsconfig, files) {
        var cfg = {paths: files, expose: 'all', jsDoc: 'extended', lineComment: true};
        try {
            var prg = program.createProgram(cfg, compilerOpts());
            var gen = new tjs.SchemaGenerator(prg, parser.createParser(prg, cfg), formatter.createFormatter(cfg));
            var s = gen.createSchemas(isTsFilename);
        } catch (e) {
            if (e.diagnostics) {
                throw new Error('\n' + e.diagnostics.map(function (d) {
                    var pos = calcPos(d.file.text, d.start);
                    return d.file.fileName + ':' + pos.line + ':' + pos.col + ' ' + d.messageText;
                }).join('\n'));
            }
            throw e;
        }
        for (var p in s) {
            s[p].id = p;
        }
        return s;

        function calcPos(data, start) {
            var newLine = /\r?\n/g;
            var line = 1, lastIndex = 0, res;
            while ((res = newLine.exec(data)) !== null && res.index < start) {
                line++;
                lastIndex = res.index;
            }
            return {line: line, col: start - lastIndex};
        }

        function compilerOpts() {
            var opts = {};
            if (typescript.sys.fileExists(tsconfig)) {
                var tsc = JSON.parse(typescript.sys.readFile(tsconfig));
                if (tsc.compilerOptions) {
                    var configDir = tsconfig.substring(0, tsconfig.replace(/\\/g, '/').lastIndexOf('/') + 1);
                    opts.baseUrl = configDir + tsc.compilerOptions.baseUrl;
                }
            }
            return opts;
        }
    }
};

if (module) module.exports = exports;