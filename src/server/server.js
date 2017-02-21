var path = require('path');
var opn = require('opn');
var params=require('../params');

module.exports = {
    start: function (source, dest, port) {
        var dependencyPath = params.dependencyPath();
        var sourceRelDependencyPath = path.relative(
            path.resolve(source), path.resolve(dependencyPath)).replace(/\\/g, '/');
        while (sourceRelDependencyPath.substring(0, 3) === '../') {
            sourceRelDependencyPath = sourceRelDependencyPath.substring(3);
        }

        require('./stop').stop(port, function (wasRunning) {
            if (!wasRunning && params.openBrowser()) {
                opn('http://localhost:' + port);
            }

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
        });
    }
};