var fs = require('fs');
var fse = require('fs-extra');
var path = require('path');
var log = require('../log');
var colors = require('ansi-colors');
var read = require('readline')
    .createInterface({input: process.stdin, output: process.stdout});

read.question(pad('Name of the project:'), function (name) {
    read.question(pad('Use global apikana [Y/n]:'), function (glob) {
        var isGlobal = glob !== 'n' && glob !== 'N';
        read.question(pad('Create for Node.js or Maven [N/m]:'), function (node) {
            var forNode = node !== 'm' && node !== 'M';
            if (forNode) {
                init(name, isGlobal, forNode);
                read.close();
            } else {
                read.question(pad('Group ID:'), function (groupId) {
                    read.question(pad('Artifact ID:'), function (artifactId) {
                        read.question(pad('Package name:'), function (pack) {
                            init(name, isGlobal, forNode, {groupId: groupId, artifactId: artifactId, package: pack});
                            read.close();
                        });
                    });
                });
            }
        });
    });
});

function init(name, isGlobal, forNode, opts) {
    if (fs.existsSync(name)) {
        log('directory already exists.');
        process.exit(1);
    }

    fse.copySync(__dirname + '/template/general', name);
    var myPack = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json').toString()));
    if (forNode) {
        fse.copySync(__dirname + '/template/node', name);
        var pack = JSON.parse(fs.readFileSync(name + '/package.json').toString());
        pack.name = name;
        pack.author = require('os').userInfo().username;
        if (!isGlobal) {
            pack.devDependencies.apikana = myPack.version;
        }
        fs.writeFileSync(name + '/package.json', JSON.stringify(pack, null, 2));
    } else {
        fse.copySync(__dirname + '/template/maven', name);
        var pom = fs.readFileSync(name + '/pom.xml').toString();
        // opts.version = myPack.version;
        opts.version = '0.4.12'; //TODO hardcode or myPack.version?
        opts.global = isGlobal;
        for (var opt in opts) {
            pom = pom.replace('%' + opt + '%', opts[opt]);
        }
        fs.writeFileSync(name + '/pom.xml', pom);
        var apiYaml = fs.readFileSync(name + '/src/openapi/api.yaml').toString();
        apiYaml = apiYaml.replace('@version@', '@project.version@');
        fs.writeFileSync(name + '/src/openapi/api.yaml', apiYaml);
    }
    finish();

    function finish() {
        log('\nCreation finished. Have a look at it:');
        log(pad('Go to your project:'), colors.green('cd ' + name));
        if (forNode && !isGlobal) {
            log(pad('Install dependencies:'), colors.green('npm install'));
        }
        if (forNode) {
            log(pad('Create the documentation:'), colors.green('npm start'));
        } else {
            log(pad('Create the documentation:'), colors.green('mvn install'));
        }
        log(pad('Open a browser at'), colors.blue('http://localhost:8333'));
    }
}

function pad(s) {
    while (s.length < 35) s = s + ' ';
    return s;
}
