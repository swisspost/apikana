const nodePlop = require("node-plop");
const registryUrl = require('registry-url');

var os = require('os');
var path = require('path');
var fs = require('fs');

const PluginManager = require('live-plugin-manager').PluginManager;
const manager = new PluginManager({
    npmRegistryUrl: registryUrl(),
    pluginsPath: path.join(os.tmpdir(), 'apikana-plugin-packages')
});

process.stdout.write("Loading defaults... ");

manager.install('apikana-defaults').then((e) => {
    process.stdout.write("found "+e.version+"\n");
    var defaults = manager.require('apikana-defaults');
    var defaultsDir = path.join(os.tmpdir(), 'apikana-plugin-packages', 'apikana-defaults'); 
    defaults.version = JSON.parse(fs.readFileSync(path.join(defaultsDir, 'package.json'))).version;
    var plop = nodePlop(__dirname + '/../plopfile_init.js', { defaults });
    var generator = plop.getGenerator('init');
    generator.runPrompts().then(config => generator.runActions(config));
});