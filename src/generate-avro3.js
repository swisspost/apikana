// NOTE: This file incorporates work covered by the following copyright and permissions notice:

// MIT License

// Copyright (c) 2017 Mark Terry

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// MIT License

const url = require('url')
const jsonSchemaAvro = module.exports = {}

// Json schema on the left, avro on the right
const typeMapping = {
    'string': 'string',
    'null': 'null',
    'boolean': 'boolean',
    'integer': 'int',
    'number': 'float'
}

const reSymbol = /^[A-Za-z_][A-Za-z0-9_]*$/;

jsonSchemaAvro.convert = (jsonSchema) => {
    if (!jsonSchema) {
        throw new Error('No schema given')
    }
    let record = {
        name: jsonSchemaAvro._idToName(jsonSchema.id) || 'main',
        type: 'record',
        doc: jsonSchema.description,
        fields: jsonSchema.properties ? jsonSchemaAvro._convertProperties(jsonSchema) : []
    }
    const nameSpace = jsonSchemaAvro._idToNameSpace(jsonSchema.id)
    if (nameSpace) {
        record.namespace = nameSpace
    }
    return record
}

jsonSchemaAvro._idToNameSpace = (id) => {
    if (!id) {
        return
    }
    const parts = url.parse(id)
    let nameSpace = []
    if (parts.host) {
        const reverseHost = parts.host.split(/\./).reverse()
        nameSpace = nameSpace.concat(reverseHost)
    }
    if (parts.path) {
        const splitPath = parts.path.replace(/^\//, '').replace('.', '_').split(/\//)
        nameSpace = nameSpace.concat(splitPath.slice(0, splitPath.length - 1))
    }
    return nameSpace.join('.')
}

jsonSchemaAvro._idToName = (id) => {
    if (!id) {
        return
    }
    const parts = url.parse(id)
    if (!parts.path) {
        return
    }
    return parts.path.replace(/^\//, '').replace('.', '_').split(/\//).pop()
}

jsonSchemaAvro._isComplex = (schema) => {
    return schema.type === 'object'
}

jsonSchemaAvro._isArray = (schema) => {
    return schema.type === 'array'
}

jsonSchemaAvro._hasEnum = (schema) => {
    return Boolean(schema.enum)
}

jsonSchemaAvro._isRequired = (list, item) => list && list.includes(item)

jsonSchemaAvro._convertProperties = (schema, definitions) => {
    const properties = schema.properties || {};
    return Object.keys(properties).map((item) => {
        const required = jsonSchemaAvro._isRequired(schema.required, item);
        if (jsonSchemaAvro._isComplex(properties[item])) {
            return jsonSchemaAvro._convertComplexProperty(item, properties[item], required, definitions)
        }
        else if (jsonSchemaAvro._isArray(properties[item])) {
            return jsonSchemaAvro._convertArrayProperty(item, properties[item], required, definitions)
        }
        else if (jsonSchemaAvro._hasEnum(properties[item])) {
            return jsonSchemaAvro._convertEnumProperty(item, properties[item], required, definitions)
        }
        return jsonSchemaAvro._convertProperty(item, properties[item], required, definitions);
    })
}

jsonSchemaAvro._resolveType = (contents, definitions, convert) => {
    var type;
    if(contents.$ref) {
        var name = $ref.split('/').slice(-1);
        if(definitions[name]) {
            type = Object.assign({}, {name}, definitions[name]);
        } else {
            type = name; 
        }
    } else {
        type = contents
    }
}

jsonSchemaAvro._convertComplexProperty = (name, contents, required, definitions) => {
    return {
        name: name,
        doc: contents.description || '',
        type: {
            type: 'record',
            name: `${name}_record`,
            fields: jsonSchemaAvro._convertProperties(contents.properties, contents.required)
        }
    }
}

jsonSchemaAvro._convertArrayProperty = (name, contents) => {
    return {
        name: name,
        doc: contents.description || '',
        type: {
            type: 'array',
            items: jsonSchemaAvro._isComplex(contents.items)
                ? {
                    type: 'record',
                    name: `${name}_record`,
                    fields: jsonSchemaAvro._convertProperties(contents.items.properties, contents.items.required)
                }
                : jsonSchemaAvro._convertProperty(name, contents.items)
        }
    }
}

jsonSchemaAvro._convertEnumProperty = (name, contents) => {
    const valid = contents.enum.every((symbol) => reSymbol.test(symbol))
    let prop = {
        name: name,
        doc: contents.description || '',
        type: valid ? {
            type: 'enum',
            name: `${name}_enum`,
            symbols: contents.enum
        } : 'string'
    }
    if (contents.hasOwnProperty('default')) {
        prop.default = contents.default
    }
    return prop
}

jsonSchemaAvro._convertProperty = (name, value, required = false) => {
    let prop = {
        name: name,
        doc: value.description || ''
    }
    let types = []
    if (value.hasOwnProperty('default')) {
        //console.log('has a default')
        prop.default = value.default
    }
    else if (!required) {
        //console.log('not required and has no default')
        prop.default = null
        types.push('null')
    }
    if (Array.isArray(value.type)) {
        types = types.concat(value.type.filter(type => type !== 'null').map(type => typeMapping[type]))
    }
    else {
        types.push(typeMapping[value.type])
    }
    //console.log('types', types)
    //console.log('size', types.length)
    prop.type = types.length > 1 ? types : types.shift()
    //console.log('prop', prop)
    return prop
}