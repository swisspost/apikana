const fs = require('fs');
const os = require('os');
const path = require('path');
const slash = require('slash');

module.exports = function (plop, cfg) {
    const { defaults } = cfg;
    const defaultsDir = defaults && defaults.dir || path.join(os.tmpdir(), 'apikana-plugin-packages', 'apikana-defaults')

    const currentPath = process.cwd();
    plop.setHelper('ConvertVersion', (version) => {
        return version.replace(/-(?!.*-).*/, "-SNAPSHOT");
    });

    plop.setHelper('urlEncode', function(options) {
        return decodeURIComponent(options.fn(this))
            .replace(/@/g, '%40'); // Some markdown interpreters do not like them
    });

    plop.setHelper('ConvertDependency', (dependencies) => {
        var result = [];

        for(var key in dependencies) {
            const packageRoot = path.resolve(currentPath, 'node_modules', key);
            if(fs.existsSync(packageRoot)) {
                const packageJSON = JSON.parse(fs.readFileSync(path.resolve(packageRoot, './package.json').toString()));

                if(packageJSON.hasOwnProperty('customConfig')) {

                    result.push({
                        groupId: packageJSON.customConfig.mavenGroupId,
                        artifactId: packageJSON.customConfig.projectName,
                        packageId: packageJSON.customConfig.dotnetPackageId,
                        version: packageJSON.version
                    });
                }
            } else {
                console.error("Package " + key + " not found in node_modules. Run `npm install` and try again.");
            }
        }
        return result;
    });

    plop.setHelper('ifEquals', function(arg1, arg2, options) {
        return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });

    plop.setHelper("ifContains", function(array, value, options){
            var aArray = array.split(",");

            for (var i = 0; i < aArray.length; i++) {
                if (value.indexOf(aArray[i]) > -1) {
                    return (value.indexOf(aArray[i]) > -1) ? options.fn( this ) : "";
                }
            }
    });

    function getMajorVersion(version) {
        let majorVersion = version.split(".", 1)[0];
        if (majorVersion === "0") {
            majorVersion = "1";
        }
        return majorVersion;
    }

    plop.setGenerator('start', {
        description: '',
        prompts: [],
        actions: (packageJSON) =>  {
            var actions = [];

            packageJSON.customConfig.majorVersion = getMajorVersion(packageJSON.version);

            packageJSON.customConfig.plugins.map(plugin => {
                // by default add default templates from apikana itself
                actions.push({
                    type: 'addMany',
                    globOptions: {dot: true},
                    destination: currentPath,
                    base: slash(path.join(__dirname, 'scaffold', 'template', plugin)),
                    templateFiles: slash(path.join(__dirname, 'scaffold', 'template', plugin, '**')),
                    force: true
                });

                // overwrite all matching files if apikana-defaults contains templates for the plugins
                actions.push({
                    type: 'addMany',
                    globOptions: {dot: true},
                    destination: currentPath,
                    base: slash(path.join(defaultsDir, 'templates', 'start', plugin)),
                    templateFiles: slash(path.join(defaultsDir, 'templates', 'start', plugin, '**')),
                    force: true
                });

                // overwrite all matching files if the project contains specific template for the plugins
                actions.push({
                    type: 'addMany',
                    globOptions: {dot: true},
                    destination: currentPath,
                    base: slash(path.join(currentPath,'templates', plugin)),
                    templateFiles: slash(path.join(currentPath, 'templates', plugin, '**')),
                    force: true
                });
            });

            return actions;
        }
    });
};
