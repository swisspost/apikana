const fs = require('fs');
const os = require('os');
const path = require('path');
const slash = require('slash');

module.exports = function (plop, cfg) {
    const { defaults } = cfg;
    const currentPath = process.cwd();
    plop.setHelper('ConvertVersion', (version) => {
        return version.replace(/-(?!.*-).*/, "-SNAPSHOT");
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

    plop.setGenerator('start', {
        description: '',
        prompts: [],
        actions: (packageJSON) =>  {
            var actions = [];
            
            packageJSON.customConfig.plugins.map(plugin => {
                // by default add default files directly from apikana
                actions.push({
                    type: 'addMany',
                    globOptions: {dot: true},
                    destination: currentPath,
                    base: slash(path.join(__dirname, 'scaffold', 'template', plugin)),
                    templateFiles: slash(path.join(__dirname, 'scaffold', 'template', plugin, '**')),
                    force: true
                });

                // overwrite all matching if apikana-defaults contains any
                actions.push({
                    type: 'addMany',
                    globOptions: {dot: true},
                    destination: currentPath,
                    base: slash(path.join(os.tmpdir(),'apikana-plugin-packages', 'apikana-defaults', 'templates', 'start', plugin)),
                    templateFiles: slash(path.join(os.tmpdir(),'apikana-plugin-packages', 'apikana-defaults', 'templates', 'start', plugin, '**')),
                    force: true
                });
            });

            return actions;
        }
    });
};
