var tjs = require('typescript-json-schema');
var typescript = require('typescript');

var readFile = typescript.sys.readFile;
if (!readFile.patched) {
    typescript.sys.readFile = function (name) {
        var file = readFile(name);
        if (name.substring(name.length - 3) === '.ts' && name.substring(name.length - 5) !== '.d.ts') {
            file = inlineToJsdocComments(file);
            file = makeStringEnums(file);
        }
        return file;

        function inlineToJsdocComments(file) {
            return file.replace(/^([^\/\n]+)\/\/([^\n]+)$/gm, '/** $2 */ $1 ');
        }

        function makeStringEnums(file) {
            return file.replace(/(enum [^]*?\{)([^]*?\})/gm, function (match, s1, s2) {
                return s1 + s2.replace(/(.*?)([A-Z_0-9]+)/gm, '$1 $2="$2" as any');
            });
        }
    };
    typescript.sys.readFile.patched = true;
}

exports = {
    generate: function (tsconfig, files, type) {
        type = type || '*';
        var prg = tjs.getProgramFromFiles(files, compilerOpts());
        var schema = tjs.generateSchema(prg, type, generatorOpts());
        if (schema) {
            addIds(schema, type === '*');
            cleanRefs(schema, type === '*');
        }
        return schema;

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

        function generatorOpts() {
            var generateOpt = tjs.getDefaultArgs();
            generateOpt.useTypeAliasRef = true;
            generateOpt.disableExtraProperties = true;
            generateOpt.generateRequired = true;
            return generateOpt;
        }

        function addIds(schema, definitions) {
            if (definitions) {
                for (var def in schema.definitions) {
                    schema.definitions[def].id = def;
                }
            } else {
                schema.id = type;
            }
        }

        function cleanRefs(schema, definitions) {
            if (definitions) {
                for (var prop in schema) {
                    var v = schema[prop];
                    if (prop === '$ref') {
                        schema[prop] = v.replace('/definitions', '');
                    }
                    if (typeof v === 'object') {
                        cleanRefs(v, definitions);
                    }
                }
            }
        }
    }
};

if (module)module.exports = exports;