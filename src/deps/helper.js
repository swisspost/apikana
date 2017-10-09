function renderDocson() {
    $('.docson').each(function (index, elem) {
        docson.doc(elem, spec.definitions, $(elem).text());
    });
}

var jq = $;  //save jQuery
$ = function (f) {
    $ = jq;  //restore jQuery
    var lodash = _;  //save lodash (will be overwritten by underscore by typson)

    SwaggerUi.partials.signature.getModelSignature = function (name, schema, models, modelPropertyMacro) {
        return '<div class="docson">' + name + '</div>';
    };

    SwaggerUi.partials.signature.getParameterModelSignature = function (type, definitions) {
        return '<div class="docson">' + type + '</div>'
    };

    Handlebars.templates.signature = Handlebars.compile('{{sanitize signature}}');

    var path = '/rest/openapi/';
    var baseUrl = getAbsoluteUrl(getUrlParameter('url')) || 'src';
    if (baseUrl.substring(baseUrl.length - 1) === '/') {
        baseUrl = baseUrl.substring(0, baseUrl.length - 1);
    }

    fetchApi().then(function (json) {
        spec = json;
        spec.definitions = spec.definitions || {};
        //keep swagger ui happy
        for (var p in spec.paths) {
            if (spec.paths[p] === null) {
                spec.paths[p] = {};
            }
        }

        var schema = schemaGen.generate(baseUrl + '/model/ts/tsconfig.json', modelFiles(spec, path));
        if (schema) {
            for (var def in schema) {
                schemaGen.processRefs(schema[def], function (ref) {
                    return ref.replace('/definitions', '');
                });
                spec.definitions[def] = schema[def];
            }
        }
        _ = lodash;  //restore lodash
        f();
    }).catch(function (err) {
        alert('Problem loading api: ' + err);
    });

    function modelFiles(spec, path) {
        var models = spec.definitions.$ref || [];
        if (!Array.isArray(models)) {
            models = [models];
        }
        var files = [];
        for (var i = 0; i < models.length; i++) {
            var parts = models[i].split(/[,\n]/);
            for (var j = 0; j < parts.length; j++) {
                var model = parts[j].trim();
                if (model) {
                    files.push(baseUrl + path + model);
                }
            }
        }
        delete spec.definitions.$ref;
        return files;
    }

    function fetchApi() {
        return fetch(baseUrl + path + 'api.json').then(function (res) {
            if (res.ok) {
                return res.text().then(function (json) {
                    return JSON.parse(replaceVariables(json));
                });
            }
            return fetchYaml();
        }).catch(function (err) {
            if (err instanceof TypeError) { //when a network error occurred
                return fetchYaml();
            }
            throw err;
        });
    }

    function fetchYaml() {
        return fetch(baseUrl + path + 'api.yaml').then(function (res) {
            if (res.ok) {
                return res.text();
            }
            throw Error('Neither ' + path + 'api.json nor ' + path + 'api.yaml found.');
        }).then(function (yaml) {
            return YAML.parse(replaceVariables(yaml));
        });
    }

    function replaceVariables(text) {
        var regex = /@(.*?)@/g;
        var res;
        while ((res = regex.exec(text)) !== null) {
            var val = objectPath.get(variables, res[1]);
            if (val) {
                text = text.substring(0, res.index) + val + text.substring(res.index + res[0].length);
                regex.lastIndex = res.index;
            }
        }
        return text;
    }
};

function getUrlParameter(name) {
    return decodeURI((new RegExp(name + '=' + '(.+?)(&|$)').exec(location.search) || [, ''])[1]);
}

function getAbsoluteUrl(relativeUrl) {
    return relativeUrl && absolutizeUri(document.URL, relativeUrl);
}

function absolutizeUri(base, href) {// RFC 3986
    href = parseUri(href || '');
    base = parseUri(base || '');

    return !href || !base ? null : (href.protocol || base.protocol) +
        (href.protocol || href.authority ? href.authority : base.authority) +
        removeDotSegments(href.protocol || href.authority || href.pathname.charAt(0) === '/' ? href.pathname : (href.pathname ? ((base.authority && !base.pathname ? '/' : '') + base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + href.pathname) : base.pathname)) +
        (href.protocol || href.authority || href.pathname ? href.search : (href.search || base.search)) +
        href.hash;

    function removeDotSegments(input) {
        var output = [];
        input.replace(/^(\.\.?(\/|$))+/, '')
            .replace(/\/(\.(\/|$))+/g, '/')
            .replace(/\/\.\.$/, '/../')
            .replace(/\/?[^\/]*/g, function (p) {
                if (p === '/..') {
                    output.pop();
                } else {
                    output.push(p);
                }
            });
        return output.join('').replace(/^\//, input.charAt(0) === '/' ? '/' : '');
    }
}

function parseUri(url) {
    var m = String(url).replace(/^\s+|\s+$/g, '').match(/^([^:\/?#]+:)?(\/\/(?:[^:@]*(?::[^:@]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/);
    return (m ? {
        href: m[0] || '',
        protocol: m[1] || '',
        authority: m[2] || '',
        host: m[3] || '',
        hostname: m[4] || '',
        port: m[5] || '',
        pathname: m[6] || '',
        search: m[7] || '',
        hash: m[8] || ''
    } : null);
}
