const changeCase = require('change-case');

const os = require("os");
const fs = require('fs');
const path = require('path');

const slash = require('slash');

var log = require('./log');
var colors = require('ansi-colors');

const apikanaVersion = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json').toString())).version;

module.exports = function (plop, cfg) {
    const { defaults, logLevel } = cfg;

    if(logLevel !== undefined) {
        log.setLevel(logLevel);
    }

    const currentPath  = process.cwd();

    plop.setHelper('json', (data) => {
        delete data.apikanaVersion;
        var stringified = JSON.stringify(data, null, 4);
        return stringified;
    });

    plop.setHelper('replaceStr', (match, replace, txt) => {
        return txt.split(match).join(replace);
    });

    plop.setHelper('inArray', (array, str, options) => (array.includes(str)) ? options.fn(this) : options.inverse(this));

    plop.setGenerator('init', {
        description: '',
        prompts: [{
            type: 'list',
            name: 'type',
            choices: [
                { name: 'REST API', value: 'rest-api'},
                { name: 'Stream/Messaging API', value: 'stream-api'},
                { name: 'Generic (only type definitions)', value: 'api' }
            ],
            message: 'Which type of API project do you want to create?'
        },
        {
            type: 'input',
            name: 'domain',
            message: 'What is your organization domain?',
            default: (defaults && defaults.domain || ""),
            filter: changeCase.dot,
            validate: answer => answer.length > 0
        },{
            type: 'input',
            name: 'author',
            message: 'Who is the API author?',
            default: os.userInfo().username
        },{
            type: 'input',
            name: 'namespace',
            message: 'What is the full API name (including namespace)?',
            filter: answer => changeCase.dot(changeCase.dot(changeCase.lower(answer))),
            validate: answer => {
                if(answer.length == 0) return "Please give a name"
                if(answer.endsWith('api')) return "Please give the name without suffix"
                if(defaults.namespace &&
                    defaults.namespace.prefixes &&
                    defaults.namespace.prefixes.values &&
                    defaults.namespace.prefixes.values.filter(prefix => answer.startsWith(prefix)).length == 0) {
                    return defaults.namespace.prefixes.message || 'Namespace not following conventions';
                }
                return true
            }
        },{
            type: 'list',
            name: 'shortName',
            message: 'What is the API short name? Choose the most speaking but concise variant.',
            choices: answers => {
                let segments = answers.namespace.split('.');
                var acc = [];
                return segments.reverse().map(v => acc = [v, ...acc]).map( arr => arr.join('-'));
            }
        },{
            type: 'input',
            name: 'projectName',
            message: 'What is the API project name?',
            default: answers =>
                (answers.shortName || answers.namespace) + '-' +
                (defaults && defaults[answers.type] && defaults[answers.type].suffix || answers.type)
        },{
            type: 'input',
            name: 'npmPackage',
            message: 'What is the NPM package name?',
            default: answers =>
                '@'+changeCase.hyphen([prefix(answers),answers.namespace.slice(0, -answers.shortName.length-1)]
                    .filter(Boolean).join('-'))+'/'+answers.projectName
        },{
            type: 'input',
            name: 'title',
            message: 'What is the API project title?',
            default: answers => changeCase.title(answers.projectName).replace('Rest', 'REST').replace('Api', 'API')
        },{
            type: 'checkbox',
            name: 'plugins',
            message: 'Which plugins do you want to activate?',
            default: Object.keys(defaults && defaults.plugins || {}).filter(key => defaults.plugins[key].active),
            choices: [
                { name: 'Maven artifact with Java classes', value: 'maven' },
                { name: 'C# project', value: 'dotnet' },
                { name: 'Generate README', value: 'readme' }
            ]
        },{
            type: 'input',
            name: 'javaPackage',
            message: 'Which java package do you want to use?',
            when: answers => answers.plugins.includes('maven'),
            default: answers =>
                prefix(answers).replace(new RegExp('^' + (
                    defaults &&
                    defaults.plugins &&
                    defaults.plugins.maven &&
                    defaults.plugins.maven.ignoreDomainPrefix || '') + '\\.', 'g'), '')+'.'+
                answers.namespace.replace(new RegExp('^' + (
                    defaults &&
                    defaults.plugins &&
                    defaults.plugins.maven &&
                    defaults.plugins.maven.ignoreNamespacePrefix || '') + '\\.', 'g'), '')+'.v1'
        }, {
            type: 'input',
            name: 'mavenGroupId',
            message: 'Which Maven groupId do you want to use?',
            when: answers => answers.plugins.includes('maven'),
            default: (answers) => answers.javaPackage.split('.').slice(0,-2).join('.')
        },{
            type: 'input',
            name: 'dotnetNamespace',
            message: 'Which .NET namespace do you want to use?',
            when: answers => answers.plugins.includes('dotnet'),
            default: answers =>
                dotTitle(prefix(answers)).replace(new RegExp('^' + (
                    defaults &&
                    defaults.plugins &&
                    defaults.plugins.dotnet &&
                    defaults.plugins.dotnet.ignoreDomainPrefix || '') + '\\.', 'g'), '')+'.'+
                dotTitle(answers.namespace).replace(new RegExp('^' + (
                    defaults &&
                    defaults.plugins &&
                    defaults.plugins.dotnet &&
                    defaults.plugins.dotnet.ignoreNamespacePrefix || '') + '\\.', 'g'), '')+'.V1'
        },{
            type: 'input',
            name: 'dotnetPackageId',
            message: 'Which .NET PackageId do you want to use?',
            when: answers => answers.plugins.includes('dotnet'),
            default: answers =>
                answers.dotnetNamespace.split('.').slice(0,-1).join('.') + '.' +
                changeCase.pascalCase(defaults && defaults[answers.type] && defaults[answers.type].suffix || answers.type)
        },{
            type: 'list',
            name: 'mqs',
            when: answers => answers.type == 'stream-api',
            message: 'On which message queue system will this API be exposed?',
            default: defaults && defaults.stream && defaults.stream.mqs,
            choices: ['ActiveMQ', 'Kafka', 'MQTT', 'RabbitMQ', 'Other']
        },{
            type: 'input',
            name: 'mqs',
            message: 'Enter the name of the message queue system',
            when: answers => answers.mqs == 'Other',
        }],
        actions: (answers) => {
            answers.customConfig = Object.assign({}, answers);
            delete answers.customConfig.npmPackage;
            answers.customConfig.avro = { enumAsString: true }
            var actions = [];

            var summary = Object.entries({
                'base': true,
                'generic': answers.type == 'api',
                'rest': answers.type == 'rest-api',
                'stream': answers.type == 'stream-api'
            });

            for(let [key, value] of summary) {
                if(value == true) {
                    // by default add default files directly from apikana
                    actions.push({
                        type: 'addMany',
                        data: { apikanaVersion, version: defaults && defaults.version },
                        globOptions: {dot: true},
                        destination: slash(path.join(currentPath, answers.projectName)),
                        base: slash(path.join(__dirname, 'scaffold', 'template', key)),
                        templateFiles: slash(path.join(__dirname, 'scaffold', 'template', key, '**')),
                        force: true
                    });

                    // overwrite all matching if apikana-defaults contains any
                    actions.push({
                        type: 'addMany',
                        data: { apikanaVersion, version: defaults && defaults.version },
                        globOptions: {dot: true},
                        destination: slash(path.join(currentPath, answers.projectName)),
                        base: slash(path.join(os.tmpdir(),'apikana-plugin-packages', 'apikana-defaults', 'templates', 'init', key)),
                        templateFiles: slash(path.join(os.tmpdir(), 'apikana-plugin-packages', 'apikana-defaults', 'templates', 'init', key, '**')),
                        force: true
                    });
                }
            }

            // create .gitignore file
            actions.push({
                type: 'add',
                path: slash(path.join(currentPath, answers.projectName, '.gitignore')),
                template: "node_modules/\ndist/\n/gen/\n.vscode/\n.idea/\n*.iml\n.settings/\n.project/",
                skipIfExists: true
            });

            // create .npmignore file
            actions.push({
                type: 'add',
                path: slash(path.join(currentPath, answers.projectName, '.npmignore')),
                template: "node_modules/\ngen/\n*.iml",
                skipIfExists: true
            });

            actions.push((answers) => {
                log('\nCreation finished. Have a look at it:');
                log(pad('Go to your project:'), colors.green('cd ' + answers.projectName));
                log(pad('Install dependencies:'), colors.green('npm install'));
                log(pad('Create the documentation:'), colors.green('npm start'));
                log(pad('Open a browser at'), colors.blue('http://localhost:8333'));
            });

            return actions;
        }
    });
};

function pad(s) {
    while (s.length < 35) s = s + ' ';
    return s;
}

function prefix(answers) {
    return answers.domain.split('.').reverse().join('.');
}

function dotTitle(s) {
    return changeCase.title(s).replace(/ /g, '.');
}
