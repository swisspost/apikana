const fs = require('fs-extra');
const sandbox = require('./sandbox')();

describe('scaffolding', () => {

    beforeAll(sandbox.init);
    afterAll(sandbox.clean);

    describe('an API', () => {
        var apiDir;
        beforeAll(() => 
            sandbox.scaffold({
                type: 'stream-api',
                domain: 'acme.org',
                author: 'coyote',
                namespace: 'outside.garden.pet',
                shortName: 'garden-pet',
                projectName: 'garden-pet-stream-api',
                npmPackage: '@org.acme.outside/garden-pet-stream-api',
                title: 'Garden Pet Stream API',
                plugins: [ 'maven', 'dotnet' ],
                javaPackage: 'org.acme.outside.garden.pet.v1',
                mavenGroupId: 'org.acme.outside.garden',
                dotnetNamespace: 'Org.Acme.Outside.Garden.Pet',
                dotnetPackageId: 'Org.Acme.Outside.Garden.Pet.StreamApi',
                mqs: 'Kafka'
            })
            .then(({dir}) => apiDir = dir))

        it('should create package.json', () =>
            expect(fs.existsSync(`${apiDir}/package.json`)).toBeTruthy())

        it('should have the correct package name', () =>
            expect(JSON.parse(fs.readFileSync(`${apiDir}/package.json`).toString()).name).toBe('@org.acme.outside/garden-pet-stream-api'))

    })
})




