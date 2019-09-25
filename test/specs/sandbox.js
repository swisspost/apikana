const nodePlop = require('node-plop');
const os = require('os');
const path = require('path');
const fs = require('fs-extra');

var curdir;
var tempdir;
var generator;

module.exports = {
    init: done =>
        fs.mkdtemp(path.join(os.tmpdir(), 'apikana-'), (err, folder) => {
            if (err) throw err;
            tempdir = folder;
            curdir = process.cwd();
            process.chdir(folder);
            generator = nodePlop(__dirname + '/../../src/plopfile_init.js').getGenerator('init');
            done()
        }),
    clean: done => {
        process.chdir(curdir);
        fs.remove(tempdir, done);
    },
    generator: () => generator,
    dir: () => tempdir
}
