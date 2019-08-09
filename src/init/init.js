const nodePlop = require("node-plop");

const registryUrl = require('registry-url');
const PluginManager = require('live-plugin-manager').PluginManager;
const manager = new PluginManager({npmRegistryUrl: registryUrl()})
process.stdout.write("Loading defaults... ");
manager.install('apikana-defaults').then((e) => {  
    process.stdout.write("found "+e.version+"\n");
    var defaults = manager.require('apikana-defaults');
    var plop = nodePlop(__dirname + '/../plopfile_init.js', { defaults });
    var generator = plop.getGenerator('init');

    generator.runPrompts().then(config => generator.runActions(config));
});