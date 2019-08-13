const fs = require('fs');
const path = require('path');

module.exports = function (plop) {
    
    const currentPath = process.cwd();

    plop.setHelper('ToMavenDependency', (dependencies) => {
        var result = [];

        for(var key in dependencies) {
            const packageRoot = path.resolve(currentPath+'/node_modules', key);
            if(fs.existsSync(packageRoot)) {
                const packageJSON = JSON.parse(fs.readFileSync(path.resolve(packageRoot, './package.json').toString()));

                if(packageJSON.hasOwnProperty('customConfig') 
                    && packageJSON.customConfig.plugins.includes('maven')) {

                    result.push({
                        groupId: packageJSON.customConfig.mavenGroupId,
                        artifactId: packageJSON.customConfig.projectName,
                        version: dependencies[key]
                    });
                }
            } else {
                console.error("Package " + key + " not found in node_modules. Run `npm install`")
            }
        }
        return result;
    });

    plop.setGenerator('start', {
        description: '',
        prompts: [],
        actions: (packageJSON) => packageJSON.customConfig.plugins.map(plugin => {
            return {
                type: 'addMany',
                destination: currentPath,
                base: './scaffold/template/'+plugin,
                templateFiles: './scaffold/template/'+plugin+'/**',
                force: true
            };
        })
    });
};
