var gutil = require('gulp-util');

module.exports = {
    readConfigFile: function () {
        if (gutil.env.config) {
            var config = fs.readFileSync(gutil.env.config);
            var configObj = JSON.parse(config);
            for (var prop in configObj) {
                if (!gutil.env[prop]) {
                    gutil.env[prop] = configObj[prop];
                }
            }
        }
    },
    port: function () {
        return gutil.env.port || 8333;
    },
    javaPackage: function () {
        return gutil.env.javaPackage;
    },
    dependencyPath: function () {
        return gutil.env.dependencyPath || 'node_modules/$api-dependencies';
    },
    deploy: function () {
        return gutil.env.deploy && gutil.env.deploy === 'true'
    },
    serve: function () {
        return !gutil.env.serve || gutil.env.serve !== 'false';
    },
    openBrowser: function () {
        return !gutil.env.openBrowser || gutil.env.openBrowser !== 'false';
    }
};