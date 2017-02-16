var gutil = require('gulp-util');
var http = require('http');
var path = require('path');
var opn = require('opn');

module.exports = {
    start: function (source, dest, port) {
        var dependencyPath = gutil.env.dependencyPath || 'node_modules/$api-dependencies';
        var sourceRelDependencyPath = path.relative(
            path.resolve(source), path.resolve(dependencyPath)).replace(/\\/g, '/');
        while (sourceRelDependencyPath.substring(0, 3) === '../') {
            sourceRelDependencyPath = sourceRelDependencyPath.substring(3);
        }

        closeOld(startOnce);

        function closeOld(then) {
            var req = http.request({port: port, path: '/close'});
            req.on('socket', function (sock) {
                sock.setTimeout(50);
                sock.on('timeout', function () {
                    req.abort();
                    then(false);
                });
            }).on('error', function () {
                then(false);
            }).on('response', function () {
                then(true);
            }).end();
        }

        var started = false;

        function startOnce(wasRunning) {
            if (!started) {
                if (!wasRunning && (!gutil.env.openBrowser || gutil.env.openBrowser === 'true')) {
                    opn('http://localhost:' + port);
                }
                started = true;
                start();
            }
        }

        function start() {
            var server = require('node-http-server');
            server.onRequest = function (req, res, serve) {
                if (req.url === '/close') {
                    res.on('finish', process.exit).end('ok');
                } else {
                    if (route(req, 'src/', source));
                    else if (route(req, sourceRelDependencyPath, dependencyPath));
                    else if (route(req, '', dest + '/ui'));
                }
            };

            server.deploy({
                //verbose:true,
                port: port,
                root: '.',
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