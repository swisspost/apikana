const fs = require('fs-extra');
const sandbox = require('./sandbox');

describe('scaffolding', () => {

    beforeAll(sandbox.init);
    afterAll(sandbox.clean);

    it('should create package.json', () =>
        sandbox.scaffold({
            type: 'stream-api',
            domain: 'acme.org',
            author: 'coyote',
            namespace: 'garden.pet',
            shortName: 'garden-pet',
            projectName: 'garden-pet-stream-api',
            title: 'Garden Pet Stream API',
            plugins: [ 'maven', 'dotnet' ],
            javaPackage: 'org.acme.garden.pet.v1',
            mavenGroupId: 'org.acme.garden',
            dotnetNamespace: 'Org.Acme.Garden.Pet',
            dotnetPackageId: 'Org.Acme.Garden.Pet.StreamApi',
            mqs: 'Kafka'
        })
        .then(({dir}) => fs.exists(`${dir}/package.json`, 
                res => res || fail())))
})




