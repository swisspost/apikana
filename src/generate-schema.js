var colors = require('ansi-colors');
var log = require('./log');
var traverse = require('traverse');
var fs = require('fs');
var fse = require('fs-extra');
var path = require('path');
var schemaGen = require('./schema-gen');
var params = require('./params');
var migrator = require("./schema-migrate");

module.exports = {
    mkdirs: mkdirs,
    generate: function (tsconfig, files, modelnames, dest, dependencyPath) {
        mkdirs(dest);
        var schemas = schemaGen.generate(tsconfig, files);
        var schemaInfos = schemaInfos(schemas);
        for (var name in schemas) {
            var info = schemaInfos[name];
            if(!name.match(/^[A-Z_].*/)) {
                log.error("Naming Check Error: Type name not capitalized "+name)
                process.exit(1);
            }
            if (info.source === '') {
                log.info('Found definition', colors.magenta(name));
                var schema = schemas[name];
                var v3 = handleAllOf(schema);
                unquoteEnumValues(schema);
                removeDefinitions(schema);
                replaceLocalRef(schema);
                replaceLocalRef(v3);
                if (extendsWithoutOwnProperties(schema)) {
                    v3 = {type: 'object', additionalProperties: false, extends: {$ref: schema.$ref}};
                }

                if (params.javaPackage()) {
                    schema.javaType = params.javaPackage() + '.' + schema.id;
                    schema.javaInterfaces = ['java.io.Serializable'];
                }
                if (params.dotnetNamespace()) {
                    schema.dotnetNamespace = params.dotnetNamespace();
                }
                delete schema.extra;

                // If there are no required fields, the required attribute must be undefined (NOT an empty array)
                // See https://tools.ietf.org/html/draft-fge-json-schema-validation-00#section-5.4.3
                if (schema.required && schema.required.length === 0) {
                    delete schema.required;
                }

                // Copy the schema to be able to cleanly migrate it to a newer draft version.
                var latestSchema = migrator.migrateSchemaToLatestVersion(schema);

                fs.writeFileSync(schemaFile(name, 'v4'), JSON.stringify(schema, null, 2));
                convertToV3(schema, v3);
                fs.writeFileSync(schemaFile(name, 'v3'), JSON.stringify(schema, null, 2));
                fs.writeFileSync(schemaFile(name, 'latest'), JSON.stringify(latestSchema, null, 2));
            }
        }

        function extendsWithoutOwnProperties(schema) {
            return schema.$ref && !schema.type;
        }

        function schemaInfos(schemas) {
            var deps = path.resolve(dependencyPath);
            var relDeps = normPath(path.relative(path.resolve(dest, 'model/json-schema'), deps));
            var infos = {};
            log.debug('Dependencies:   ', colors.magenta(normPath(deps)));
            for (var name in schemas) {
                var schema = schemas[name];
                //thank you MS for messing around with filenames!
                var filename = normPath(schema.extra.filename);
                var relativeDir = params.isCustomDependencyPath() ?
                    (relDeps + '/json-schema-v4' + path.dirname(filename.substring(deps.length + 3)) + '/') :
                    (relDeps + '/ts/' + path.dirname(filename.substring(filename.lastIndexOf('-api-dependencies/ts/') + 21, filename.lastIndexOf('/ts')+3)) + '/json-schema-v4/');
                var source = filename.toLowerCase().startsWith(normPath(deps).toLowerCase()) ? relativeDir : '';
                infos[name] = {
                    source: source,
                    object: schema.type === 'object' || schema.enum || schema.allOf
                };
                log.debug('Source file:    ', colors.magenta(filename));
                log.debug('- as dependency:', colors.magenta(source + name));
            }
            return infos;
        }

        function normPath(p) {
            return path.sep === '\\' ? p.replace(/\\/g, '/') : p;
        }

        function handleAllOf(schema) {
            for (var type in schema.definitions) {
                var def = schema.definitions[type];
                transformAllOf(type, def, schema.definitions);
            }
            return transformAllOf(schema.id, schema, schema.definitions);
        }

        function transformAllOf(name, schema, definitions) {
            if (schema.allOf) {
                schema.type = 'object';
                schema.properties = {};
                schema.additionalProperties = false;
                schema.description = schema.description || '';
                schema.required = [];
                for (var i = 0; i < schema.allOf.length; i++) {
                    var type = expandRefs(schema.allOf[i]);
                    if (type) {
                        if (type.type !== 'object' && !type.allOf) {
                            log.error(colors.red(name + ' is not an interface or does inherit from a non-interface'));
                        }
                        if (type.description) {
                            schema.description += (schema.description ? ' and ' : '') + type.description;
                        }
                        Array.prototype.push.apply(schema.required, type.required);
                        for (var p in type.properties) {
                            if (schema.properties[p]) {
                                log.error(colors.red(name + ' inherits multiple times the same property ' + p));
                            }
                            schema.properties[p] = Object.assign({}, type.properties[p]);
                        }
                    }
                }

                if (schema.allOf.length === 2) {
                    var v3 = {properties: {}};
                    var type = expandRefs(schema.allOf[0]);
                    if (type) {
                        if (type.type !== 'object' && !type.allOf) {
                            log.error(colors.red(name + ' is not an interface'));
                        }
                        v3.required = type.required;
                        for (var p in type.properties) {
                            v3.properties[p] = Object.assign({}, type.properties[p]);
                        }
                    }
                    v3.extends = schema.allOf[1];
                }

                delete schema.allOf;
                return v3;
            }

            function expandRefs(def) {
                if (def.$ref) {
                    if (!isLocalRef(def.$ref)) {
                        log.warn(colors.red(name + ' has a non local $ref "' + def.$ref + '". Ignoring it.'));
                    } else {
                        var res = Object.assign({}, def, definitions[def.$ref.substring(14)]);
                        delete res.$ref;
                        return res;
                    }
                }
                return def;
            }
        }

        function unquoteEnumValues(schema) {
            if (schema.enum) {
                schema.enum = schema.enum.map(v => v
                    .replace(/^"/, "")
                    .replace(/^'/, "")
                    .replace(/"$/, "")
                    .replace(/'$/, ""));
            }
        }

        function removeDefinitions(schema) {
            for (var type in schema.definitions) {
                var info = schemaInfos[type];
                if (info && info.object) {
                    delete schema.definitions[type];
                }
            }
        }

        function replaceLocalRef(schema) {
            traverse(schema).forEach(function (value) {
                if (this.key === '$ref') {
                    var info = schemaInfos[value.substring(14)];
                    //TODO types of the same name from different dependencies need structural comparision to find the right source!
                    if (isLocalRef(value) && info && info.source != null && info.object) {
                        this.update(info.source + schemaName(value.substring(14)));
                    }
                }
            });
        }

        function isLocalRef(ref) {
            return ref.substring(0, 14) === '#/definitions/';
        }

        function schemaFile(type, version) {
            return path.resolve(schemaDir(dest, version), schemaName(type));
        }

        function schemaName(type) {
            return type.replace(/([^^])([A-Z]+)/g, '$1-$2').toLowerCase() + '.json';
        }

        function convertToV3(schema, v3) {
            schema.$schema = 'http://json-schema.org/draft-03/schema#';
            Object.assign(schema, v3);
            delete schema.$ref; // rest when extendsWithoutOwnProperties()
            traverse(schema).forEach(function (value) {
                if (value && value.required) {
                    for (var i = 0; i < value.required.length; i++) {
                        var prop = value.required[i];
                        value.properties[prop].required = true;
                    }
                }
                if( value && value.$ref) {
                    value.$ref = value.$ref.replace('/json-schema-v4/', '/json-schema-v3/');
                }
                // required property is undefined on objects without properties
                if (this.key === 'required' && (Array.isArray(value) || value === undefined)) {
                    this.remove();
                }
            });
        }
    }
};

function mkdirs(dest) {
    fse.mkdirsSync(schemaDir(dest, 'v3'));
    fse.mkdirsSync(schemaDir(dest, 'v4'));
    fse.mkdirsSync(schemaDir(dest, 'latest'));
}

function schemaDir(dest, version) {
    return path.resolve(dest, 'model/json-schema-' + version);
}
