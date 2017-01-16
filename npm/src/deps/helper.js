var jq = $;  //save jQuery
$ = function (f) {
    $ = jq;  //restore jQuery
    var lodash = _;  //save lodash (will be overwritten by underscore by typson)
    var path = '/rest/openapi/';
    require(["vendor/typson-schema"], function (typson) {
        fetchApi().then(function (json) {
            spec = json;
            spec.tsModels = spec.tsModels || [];
            spec.definitions = spec.definitions || {};
            var models = spec.tsModels.length;
            for (var i = 0; i < models; i++) {
                typson.schema('/src' + path + spec.tsModels[i]).then(
                    function (schema) {
                        for (var def in schema.definitions) {
                            spec.definitions[def] = schema.definitions[def];
                        }
                        loaded();
                    }, function (fail) {
                        loaded();
                    });
            }

            function loaded() {
                models--;
                if (models === 0) {
                    _ = lodash;  //restore lodash
                    f();
                }
            }
        }).catch(function (err) {
            alert('Problem loading api: ' + err);
        });
    });

    function fetchApi() {
        return fetch('/src' + path + 'api.json').then(function (res) {
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
        return fetch('/src' + path + 'api.yaml').then(function (res) {
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


function getAbsoluteUrl(relativeUrl) {
    console.log("getAbsoluteUrl: Relative: " + relativeUrl);
    var base = document.URL;
    console.log("getAbsoluteUrl: Base: " + base);
    var absolute = absolutizeURI(base, relativeUrl);
    console.log("getAbsoluteUrl: Output: " + absolute);
    return absolute;
}

function getURLParameter(name) {
    return decodeURI(
        (new RegExp(name + '=' + '(.+?)(&|$)').exec(location.search) || [, ''])[1]
    );
}

function parseURI(url) {
    var m = String(url).replace(/^\s+|\s+$/g, '').match(/^([^:\/?#]+:)?(\/\/(?:[^:@]*(?::[^:@]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/);
    // authority = '//' + user + ':' + pass '@' + hostname + ':' port
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

function absolutizeURI(base, href) {// RFC 3986

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

    href = parseURI(href || '');
    base = parseURI(base || '');

    return !href || !base ? null : (href.protocol || base.protocol) +
    (href.protocol || href.authority ? href.authority : base.authority) +
    removeDotSegments(href.protocol || href.authority || href.pathname.charAt(0) === '/' ? href.pathname : (href.pathname ? ((base.authority && !base.pathname ? '/' : '') + base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + href.pathname) : base.pathname)) +
    (href.protocol || href.authority || href.pathname ? href.search : (href.search || base.search)) +
    href.hash;
}
