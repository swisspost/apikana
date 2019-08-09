const fs = require('fs');
const path = require('path');

module.exports = function (plop) {
    
    const currentPath = process.cwd();
    const customConfig = JSON.parse(fs.readFileSync(path.resolve(currentPath, './package.json'))).customConfig;
    
    plop.setGenerator('start', {
        description: '',
        prompts: [],
        actions: (answers) => Object.entries({
            'maven': customConfig.plugins.includes('maven'),
            'nuget': customConfig.plugins.includes('nuget')
        })
        .filter(entry => entry[1])
        .map((entry) => {
            return {
                type: 'addMany',
                destination: currentPath,
                base: './scaffold/template/'+entry[0],
                templateFiles: './scaffold/template/'+entry[0]+'/**',
                force: true
            };
        })
    });
};
