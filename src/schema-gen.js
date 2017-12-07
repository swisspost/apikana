var typescript = require('typescript');

//important: patch readFile before require typescript-to-json-schema-extra
var readFile = typescript.sys.readFile;
if (!readFile.patched) {
    typescript.sys.readFile = function (name) {
        var file = readFile(name);
        if (name.substring(name.length - 3) === '.ts' && name.substring(name.length - 5) !== '.d.ts') {
            file = makeStringEnums(file);
        }
        return file;

        function makeStringEnums(file) {
            return file.replace(/(enum [^]*?\{)([^]*?\})/gm, function (match, s1, s2) {
                return s1 + s2.replace(/(.*?)([A-Z_0-9]+)/gm, '$1 $2="$2" as any');
            });
        }
    };
    typescript.sys.readFile.patched = true;
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
            var s = gen.createSchemas(function (fileName) {
                return fileName.match('\.ts$') && !fileName.match('\.d\.ts$');
            });
        } catch (e) {
            throw new Error('\n' + e.diagnostics.map(function (d) {
                    var pos = calcPos(d.file.text, d.start);
                    return d.file.fileName + ':' + pos.line + ':' + pos.col + ' ' + d.messageText;
                }).join('\n'));
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
    },

    processRefs: function proc(schema, func) {
        for (var prop in schema) {
            var v = schema[prop];
            if (prop === '$ref') {
                schema[prop] = func(v);
            }
            if (typeof v === 'object') {
                proc(v, func);
            }
        }
    }
};

if (module)module.exports = exports;