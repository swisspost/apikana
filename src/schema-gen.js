var log = require('./log');
var colors = require('ansi-colors');
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
            return postProcess(gen.createSchemas(isTsFilename));
        } catch (e) {
            if (e.diagnostics) {
                throw new Error('\n' + e.diagnostics.map(function (d) {
                    if(d.file) {
                        var pos = calcPos(d.file.text, d.start);
                        return d.file.fileName + ':' + pos.line + ':' + pos.col + ' ' + d.messageText;
                    } else {
                        return d.messageText
                    }
                }).join('\n'));
            }
            throw e;
        }

        function postProcess(schema) {
            for (var p in schema) {
                schema[p].id = p;
                traverse(schema[p], function (parent, value, key) {
                    if ((key === 'type' || key === 'format') && typeof value === 'string') {
                        return normalizeType(value);
                    }
                    if (key === 'enum') {
                        enumMembersAsValues(parent);
                        return value;
                    }
                    return value;
                });
            }
            return schema;
        }

        function traverse(obj, func) {
            for (var prop in obj) {
                obj[prop] = func(obj, obj[prop], prop);
                if (typeof obj[prop] === 'object') {
                    traverse(obj[prop], func);
                }
            }
        }

        function normalizeType(type) {
            type = type.trim();
            var pos = firstNonWordPos(type);
            if (pos < 0) {
                return type;
            }
            var norm = type.substring(0, pos);
            log.warn('Found illegal type/format "' + colors.red(type) + '", replacing it with "' + colors.green(norm) + '".');
            return norm;

            function firstNonWordPos(s) {
                for (var i = 0; i < s.length; i++) {
                    if (!isWordChar(s.charAt(i))) {
                        return i;
                    }
                }
                return -1;
            }

            function isWordChar(c) {
                return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '-' || c === '_';
            }
        }

        function enumMembersAsValues(schema) {
            if ((schema.type === 'number' || schema.type === 'string') && schema.extra && schema.extra.members) {
                schema.type = 'string';
                for (var i = 0; i < schema.enum.length; i++) {
                    if (schema.enum[i] === i) {
                        schema.enum[i] = schema.extra.members[i];
                    }
                }
            }
        }

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