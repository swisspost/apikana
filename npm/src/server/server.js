var gutil = require('gulp-util');
var http = require('http');

module.exports = {
    start: function (base, source, dest, port) {
        closeOld(startOnce);

        function closeOld(then) {
            var req = http.request({port: port, path: '/close'});
            req.on('socket', function (sock) {
                sock.setTimeout(50);
                sock.on('timeout', function () {
                    req.abort();
                    then();
                });
            }).on('error', function () {
                then();
            }).end();
        }

        var started = false;

        function startOnce() {
            if (!started) {
                started = true;
                start();
            }
        }

        function start() {
            var server = require('node-http-server');
            server.onRequest = function (req, res, serve) {
                if (req.url === '/close') {
                    process.exit();
                } else {
                    if (route(req, 'src/', source)) {
                    }
                    else if (route(req, '', dest + '/ui'));
                }
            };

            server.deploy({
                //verbose:true,
                port: port,
                root: base,
                server: {
                    index: 'index.html',
                    noCache: true
                },
                contentType: {
                    html: 'text/html',
                    ico: 'image/x-icon',
                    css: 'text/css',
                    js: 'text/javascript',
                    png: 'image/png',
                    json: 'application/json',
                    yaml: 'application/yaml',
                    gif: 'image/gif',
                    ts: 'text/plain'
                }
            });

            function route(req, from, to) {
                if (startsWith(req.url, '/' + from)) {
                    req.url = '/' + to + '/' + req.url.substring(from.length + 1);
                    return true;
                }
                return false;
            }

            function startsWith(s, sub) {
                return s.substring(0, sub.length) === sub;
            }
        }
    }
};