const fs = require('fs');
const path = require('path');

module.exports = function (plop) {
    
    const currentPath = process.cwd();

    plop.setHelper('ToMavenDependency', (dependencies) => {
        var result = [];

        for(var key in dependencies) {
            const packageRoot = path.resolve('node_modules', key);
            if(fs.existsSync(packageRoot)) {
                const packageJSON = JSON.parse(fs.readFileSync(path.resolve(packageRoot, './package.json').toString()));

                if(packageJSON.hasOwnProperty('customConfig') 
                    && packageJSON.customConfig.hasOwnProperty('mavenGroupId')) {

                    result.push({
                        groupId: packageJSON.customConfig.mavenGroupId,
                        artifactId: packageJSON.customConfig.projectName,
                        version: dependencies[key]
                    });
                }
            }
        }
           
       return result;
    });

    plop.setGenerator('start', {
        description: '',
        prompts: [],
        actions: (customConfig) => customConfig.plugins.map(plugin => {
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
