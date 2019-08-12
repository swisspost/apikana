const fs = require('fs');
const path = require('path');

module.exports = function (plop) {
    
    const currentPath = process.cwd();
    const customConfig = JSON.parse(fs.readFileSync(path.resolve(currentPath, './package.json'))).customConfig;
    
    plop.setGenerator('start', {
        description: '',
        prompts: [],
        actions: (answers) => customConfig.plugins.map(plugin => {
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
