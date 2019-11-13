function renderDocson() {
    $('.info_title').append($('<div>')
        .attr('id', 'simpleView')
        .css('float', 'right')
        .css('font-size', 'smaller')
        .css('color', 'darkgray')
        .css('cursor', 'pointer')
        .css('font-weight', 'normal')
        .text('👁')
        .click(toggleSimpleView)
        .attr('title','Toggle simplified view'))
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

    var url = getUrlParameter('url');
    if (!url) {
        alert('Please specify the API to display using the "url" query parameter.\nE.g. ' + location.origin + location.pathname + '?url=/src/openapi/api.yaml');
        return;
    }
    if (!window.fetch) {
        alert('Please use a Browser.\nIt should at least support "fetch".');
        return;
    }
    var apiUrl = getAbsoluteUrl(url);
    var models;

    fetchApi(apiUrl).then(function (json) {
        spec = json;
        spec.definitions = spec.definitions || {};
        //keep swagger ui happy
        for (var p in spec.paths) {
            if (spec.paths[p] === null) {
                spec.paths[p] = {};
            }
        }

        var apiBase = apiUrl.substring(0, apiUrl.lastIndexOf('/') + 1);
        models = modelFiles(spec, apiBase);
        if (models.length > 0) {
            return generateSchema(models);
        } else {
            return null;
        }
    }).then(function(schema) {
        if (schema) {
            for (var def in schema) {
                processRefs(schema[def]);
                spec.definitions[def] = schema[def];
            }
            if (!spec.paths || spec.paths.length === 0) {
                $('<style>' +
                    '.docson > .box { width: 600px; }' +
                    '.models { font-family: sans-serif; margin: 12px auto; width: 600px; }' +
                    '.models > h1 { font-size: 25px; font-weight: 700; }' +
                    '.models > * { margin-top: 20px; }' +
                    '#swagger-ui-container { display: none; }' +
                    '</style>').appendTo('body');
                var title = ((spec.info || {}).title) || '';
                var desc = ((spec.info || {}).description || '');
                var modelDiv = $('<div class="models"><h1>' + title + '</h1><p>' + desc + '</p></div>').appendTo('body');
                for (var def in schema) {
                    if (isLocalSchema(models, schema[def])) {
                        $('<div class="docson">' + def + '</div>').appendTo(modelDiv);
                    }
                }
            }
        }
        _ = lodash;  //restore lodash
        f();
    }).catch(function (err) {
        alert('Problem loading api: ' + err);
    });

    function generateSchema(models) {
        return new Promise(
            function (resolve, reject) {
                var w = new Worker("worker.js");
                w.onmessage = function(event) {
                    if(event.data) {
                        resolve(event.data);
                    } else {
                        reject(new Error("No schema generated"));
                    }
                    w.terminate();
                };
                w.postMessage(models);
            }
        )
    }

    function isLocalSchema(models, schema) {
        return _.any(models, function (m) {
            return normalize(schema.extra.filename) === normalize(m);
        });

        function normalize(path) {
            path = path.replace(/\\/g, '/');
            var regex = new RegExp('/[^/]+/\\.\\./');
            var res;
            while (res = regex.exec(path)) {
                path = path.substring(0, res.index + 1) + path.substring(res.index + res[0].length);
            }
            return path;
        }
    }

    function processRefs(schema) {
        for (var p in schema) {
            var v = schema[p];
            if (p === '$ref') {
                schema[p] = '#/'+extractTypeNameFromUrlFragment( v );
            }
            if (typeof v === 'object') {
                processRefs(v);
            }
        }
    }

    function extractTypeNameFromUrlFragment( urlFragment ) {
        var groups = /.*\/([^\/]+)$/.exec( urlFragment );
        if( groups && groups[1] ){
            return groups[1];
        }else{
            console.warn("Failed to extract type name from '"+urlFragment+"'.");
            return urlFragment;
        }
    }

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
                    files.push(path + model);
                }
            }
        }
        delete spec.definitions.$ref;
        return files;
    }

    function fetchApi(url) {
        return fetch(url, {credentials: 'include'}).then(function (res) {
            if (res.ok) {
                return res.text().then(function (contents) {
                    return url.substring(url.lastIndexOf('.')) === '.json'
                        ? JSON.parse(replaceVariables(contents))
                        : YAML.parse(replaceVariables(contents));
                });
            }
            throw Error(res.status + ' ' + res.statusText);
        }).catch(function (err) {
            throw Error('Could not load API file ' + url + ': ' + err.message);
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

var simpleView = null;

function toggleSimpleView() {
    if(simpleView != null) {
        simpleView.remove();
        simpleView = null;
        return;
    }
    simpleView = document.createElement('style');
    simpleView.innerHTML = `
    .property-name+.signature-type > .type-keyword {
        display: initial;
    }

    .box-header {
        display: none;
    }

    .signature-button {
        display: none;
    }

    .box {
        border: 0 !important;
        box-shadow: none !important;
        background-color: #ebf3f9 !important
    }

    .signature-type-date, .signature-type-date-time, .signature-type-time, .signature-type-integer, .signature-type-uuid, .signature-type-utc-millisec {
        display: none;
    }

    .type-keyword {
        display: none;
    }

    .docson {
        counter-reset: field-counter
    }

    .docson .property-name:before {
        font-size: smaller;
        margin-right: 6px;
        font-weight: normal;
        color: darkgray;
        content: counter(field-counter);
        counter-increment: field-counter;
    }

    #simpleView {
        color: black !important;
    }
    `;
    document.head.appendChild(simpleView);
}
