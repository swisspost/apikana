var colors = require('ansi-colors');
var log = require('./log');
var traverse = require('traverse');
var fs = require('fs');
var fse = require('fs-extra');
var path = require('path');
var schemaGen = require('./schema-gen');
var params = require('./params');
const refParser = require("json-schema-ref-parser");

module.exports = {
    mkdirs: mkdirs,
    generate: function (tsconfig, files, dest, dependencyPath) {
        mkdirs(dest);
        var schemas = schemaGen.generate(tsconfig, files);
        var schemaInfos = schemaInfos(schemas);
        var rootSchemas = [];
        for (var name in schemas) {
            var info = schemaInfos[name];
            if (info.source === '') {
                log.info('Found definition', colors.magenta(name));
                var schema = schemas[name];
                var v3 = handleAllOf(schema);
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

                files.forEach(rootModel => {
                    if(path.relative(schema.extra.filename, rootModel.toLowerCase()) === '') {
                        // all schemas which comes from a root model
                        var filename = rootModel.replace(/^.*[\\\/]/, '');
                        filename = filename.substring(0, filename.length-3);
                        if(name.toLowerCase() === filename.toLowerCase().replace(/-/g, '')) {
                            // only schemas name with matches rootmodel filename
                            // collect all schemas name of root models while generating them.
                            rootSchemas.push(name);
                        }
                    }
                });

                delete schema.extra;

                // If there are no required fields, the required attribute must be undefined (NOT an empty array)
                // See https://tools.ietf.org/html/draft-fge-json-schema-validation-00#section-5.4.3
                if (schema.required && schema.required.length === 0) {
                    delete schema.required;
                }

                fs.writeFileSync(schemaFile(name, 'v4'), JSON.stringify(schema, null, 2));
                convertToV3(schema, v3);
                fs.writeFileSync(schemaFile(name, 'v3'), JSON.stringify(schema, null, 2));
            }
        }

        // after generating v3 and v4, generate complete standalone schemas.
        // loop through collected schemas name of root models and generate complete standalone schemas.
        rootSchemas.forEach(rootSchema => {
            generateCompleteStandalone(rootSchema, 'v3');
            generateCompleteStandalone(rootSchema, 'v4');
        });

        /**
         * Generates a single standalone complete schema for the rootSchema passed.
         *
         */
        function generateCompleteStandalone(rootSchema, version) {
            var pathToJson = schemaFile(rootSchema, version);
            refParser.dereference(pathToJson, (err, schema) => {
                if(err) {
                    log.error(err);
                 } else {
                    fs.writeFileSync(schemaFile(rootSchema, version+'-full'), JSON.stringify(schema, null, 2));
                 }
            });
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
                var source = filename.toLowerCase().startsWith(normPath(deps).toLowerCase())
                    ? (relDeps + '/ts/' + path.dirname(filename.substring(filename.lastIndexOf('-api-dependencies/ts/') + 21, filename.lastIndexOf('/ts')+3)) + '/json-schema-v4/') : '';
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
    fse.mkdirsSync(schemaDir(dest, 'v3-full'));
    fse.mkdirsSync(schemaDir(dest, 'v4'));
    fse.mkdirsSync(schemaDir(dest, 'v4-full'));
}

function schemaDir(dest, version) {
    return path.resolve(dest, 'model/json-schema-' + version);
}
