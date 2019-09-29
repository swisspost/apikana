const nodePlop = require('node-plop');
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const generator = require(`${__dirname}/../../src/generate`);
const logLevel = 'error'
logLevel === 'error' && 
    require('sparkles')('gulplog') // disable gulp log

var curdir;
var tempdir;
var apiDir;
var scaffolder;

/**
 * The sandbox prepares a temp directory and provides control on
 * scaffolding (apikana init) and generation (apikana start)
 */
module.exports = {    
    /**
     * Creates the temp dir.
     */
    init: () => new Promise((resolve, reject) =>
        fs.mkdtemp(path.join(os.tmpdir(), 'apikana-'), (err, dir) => {
            if (err) reject(err);
            tempdir = dir;
            curdir = process.cwd();
            process.chdir(dir);
            scaffolder = nodePlop(`${__dirname}/../../src/plopfile_init.js`, {logLevel}).getGenerator('init');
            resolve();
        })),
    /** 
     * Removes the temp dir
     */
    clean: () => new Promise((resolve, reject) => {
        process.chdir(curdir);
        fs.remove(tempdir, err => err ? reject(err) : resolve());
    }),
    /**
     * Runs the scaffolding with the answers as input.
     * @returns a promise with info.
     */
    scaffold: (answers) => {
        apiDir = `${tempdir}/${answers.projectName}`
        return scaffolder.runActions(answers)
            .then(actions => ({ actions, dir: apiDir }))
    },
    /**
     * Runs the generation.
     * @returns a promise with info.
     */
    generate: (result) => {
        dir = result && result.dir || apiDir;
        process.chdir(dir)
        const packageJSON = JSON.parse(fs.readFileSync(`./package.json`));
        var plop = nodePlop(`${__dirname}/../../src/plopfile_start.js`, {logLevel});
        return plop.getGenerator('start').runActions(packageJSON)
            .then(_ => new Promise((resolve, reject) =>
                generator.generate('src', 'dist', (err) =>
                    err ? reject(err) : resolve({dir}))))          
    }
}
