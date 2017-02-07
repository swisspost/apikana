var fs = require('fs');
var fse = require('fs-extra');
var path = require('path');
var chalk = require('chalk');
var read = require('readline')
    .createInterface({input: process.stdin, output: process.stdout});

read.question(pad('Name of the project:'), function (name) {
    read.question(pad('Use global apikana [Y/n]:'), function (glob) {
        var isGlobal = glob !== 'n' && glob !== 'N';
        init(name, isGlobal);
        read.close();
    });
});

function init(name, isGlobal) {
    if (fs.existsSync(name)) {
        console.log('directory already exists.');
        process.exit(1);
    }
    var tsDir = name + '/src/model/ts';
    var apiDir = name + '/src/rest/openapi';
    fse.mkdirsSync(tsDir);
    fse.mkdirsSync(apiDir);
    copy('pet.ts', __dirname, tsDir);
    copy('api.yaml', __dirname, apiDir);
    copy('package.json', __dirname, name);
    var pack = JSON.parse(fs.readFileSync(name + '/package.json').toString());
    pack.name = name;
    pack.author = require('os').userInfo().username;
    if (!isGlobal) {
        var myPack = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json').toString()));
        pack.devDependencies.apikana = myPack.version;
    }
    fs.writeFileSync(name + '/package.json', JSON.stringify(pack, null, 2));
    console.log(pad('Go to your project:'), chalk.green('cd ' + name));
    if (!isGlobal) {
        console.log(pad('Install dependencies:'), chalk.green('npm install'));
    }
    console.log(pad('Create the documentation:'), chalk.green('npm start'));
    console.log(pad('Open a browser at'), chalk.blue('localhost:8333'));
}

function copy(file, from, to) {
    fse.copySync(path.resolve(from, file), path.resolve(to, file));
}

function pad(s) {
    while (s.length < 30) s = s + ' ';
    return s;
}
