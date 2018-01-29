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
                traverse(schema).forEach(function (value) {
                    if ((this.key === 'type' || this.key === 'format') && typeof value === 'string') {
                        this.update(normalizeType(value));
                    }
                    if (this.key === 'enum') {
                        enumMembersAsValues(this.parent.node);
                    }
                });
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
                delete schema.extra;
                fs.writeFileSync(schemaFile(name, 'v4'), JSON.stringify(schema, null, 2));
                convertToV3(schema, v3);
                fs.writeFileSync(schemaFile(name, 'v3'), JSON.stringify(schema, null, 2));
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

        function extendsWithoutOwnProperties(schema) {
            return schema.$ref && !schema.type;
        }

        function schemaInfos(schemas) {
            var deps = path.resolve(dependencyPath);
            var relDeps = relativePath(path.resolve(dest, 'model/json-schema'), deps);
            var infos = {};
            for (var name in schemas) {
                var schema = schemas[name];
                var rel = relativePath(deps.toLowerCase(), schema.extra.filename);
                var source = rel.substring(0, 3) === 'ts/' ? relDeps + '/json-schema-v3/' + path.dirname(rel.substring(3)) + '/' : '';
                infos[name] = {
                    source: source,
                    object: schema.type === 'object' || schema.enum || schema.allOf
                };
            }
            return infos;
        }

        function relativePath(from,to){
            return path.relative(from,to).replace(/\\/g,'/');
        }

        function normalizeType(type) {
            type = type.trim();
            var pos = type.indexOf(' ');
            if (pos < 0) {
                return type;
            }
            var norm = type.substring(0, pos);
            log(colors.red('Found illegal type/format "' + type + '", replacing it with "' + norm + '".'));
            return norm;
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
                            log(colors.red(name + ' is not an interface or does inherit from a non-interface'));
                        }
                        if (type.description) {
                            schema.description += (schema.description ? ' and ' : '') + type.description;
                        }
                        Array.prototype.push.apply(schema.required, type.required);
                        for (var p in type.properties) {
                            if (schema.properties[p]) {
                                log(colors.red(name + ' inherits multiple times the same property ' + p));
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
                            log(colors.red(name + ' is not an interface'));
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
                        log(colors.red(name + ' has a non local $ref "' + def.$ref + '". Ignoring it.'));
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
            return path.resolve(schemaDir(version), schemaName(type));
        }

        function schemaName(type) {
            return type.replace(/([^^])([A-Z]+)/g, '$1-$2').toLowerCase() + '.json';
        }

        function schemaDir(version) {
            return path.resolve(dest, 'model/json-schema-' + version);
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
                // required property is undefined on objects without properties
                if (this.key === 'required' && (Array.isArray(value) || value === undefined)) {
                    this.remove();
                }
            });
        }
    }
};

