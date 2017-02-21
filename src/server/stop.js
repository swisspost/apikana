var http = require('http');

module.exports = {
    stop: function (port, then) {
        var ended = false;
        var req = http.request({port: port, path: '/close'});
        req.on('socket', function (sock) {
            sock.setTimeout(50);
            sock.on('timeout', function () {
                req.abort();
                end(false);
            });
        }).on('error', function () {
            end(false);
        }).on('response', function () {
            end(true);
        }).end();

        function end(closed) {
            if (!ended) {
                ended = true;
                then(closed);
            }
        }
    }
};