var colors = require('ansi-colors');
var log = require('fancy-log');
var traverse = require('traverse');
var fs = require('fs');
var fse = require('fs-extra');
var path = require('path');
var schemaGen = require('./schema-gen');
var params = require('./params');
var generateEnv = require('./generate-env');

module.exports = {
    generate: function (tsconfig, files, dest, dependencyPath) {
        fse.mkdirsSync(schemaDir('v3'));
        fse.mkdirsSync(schemaDir('v4'));

        var schemas = schemaGen.generate(tsconfig, files);
        var schemaInfos = schemaInfos(schemas);
        for (var name in schemas) {
            var info = schemaInfos[name];
            if (info.source === '') {
                log('Found definition', colors.magenta(name));
                var schema = schemas[name];
                for (var type in schema.definitions) {
                    var def = schema.definitions[type];
                    if (schemaInfos[type] && (def.type === 'object' || def.enum)) {
                        delete schema.definitions[type];
                    }
                }
                schemaGen.processRefs(schema, function (ref) {
                    var info = schemaInfos[ref.substring(14)];
                    //TODO types of the same name from different dependencies need structural comparision to find the right source!
                    if (ref.substring(0, 14) === '#/definitions/' && info.source != null && info.object) {
                        return info.source + schemaName(ref.substring(14));
                    }
                    return ref;
                });
                if (params.javaPackage()) {
                    schema.javaType = params.javaPackage() + '.' + schema.id;
                    schema.javaInterfaces = ['java.io.Serializable'];
                }
                delete schema.filename;
                fs.writeFileSync(schemaFile(name, 'v4'), JSON.stringify(schema, null, 2));
                convertToV3(schema);
                fs.writeFileSync(schemaFile(name, 'v3'), JSON.stringify(schema, null, 2));
            }
        }

        function schemaInfos(schemas) {
            var deps = path.resolve(dependencyPath);
            var relDeps = path.relative(path.resolve(dest, 'model/json-schema'), deps);
            var infos = {};
            for (var name in schemas) {
                var schema = schemas[name];
                var rel = path.relative(deps.toLowerCase(), schema.filename);
                var source = rel.substring(0, 3) === 'ts/' ? relDeps + '/json-schema-v3/' + path.dirname(rel.substring(3)) + '/' : '';
                infos[name] = {
                    source: source,
                    object: schema.type === 'object' || schema.enum
                };
            }
            return infos;
        }

        function schemaFile(type, version) {
            return path.resolve(schemaDir(version), schemaName(type));
        }

        function schemaName(type) {
            return type.replace(/([^^])([A-Z]+)/g, '$1-$2').toLowerCase() + '.json';
        }

        function schemaDir(version) {
            return path.resolve(dest, 'model/json-schema-' + version);
        }

        function convertToV3(schema) {
            schema.$schema = 'http://json-schema.org/draft-03/schema#';
            traverse(schema).forEach(function (value) {
                if (value.required) {
                    for (var i = 0; i < value.required.length; i++) {
                        var prop = value.required[i];
                        value.properties[prop].required = true;
                    }
                }
                if (this.key === 'required' && Array.isArray(value)) {
                    this.remove();
                }
            });
        }
    }
};

