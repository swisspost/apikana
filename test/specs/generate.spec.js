const fs = require('fs-extra');
const sandbox = require('./sandbox');

describe('generating', () => {

    describe('an API', () => {
        var dir;
        beforeAll(() => sandbox.init()
            .then(() =>
                sandbox.scaffold({
                    type: 'stream-api',
                    domain: 'acme.org',
                    author: 'coyote',
                    namespace: 'garden.pet',
                    shortName: 'garden-pet',
                    projectName: 'garden-pet-stream-api',
                    title: 'Garden Pet Stream API',
                    plugins: ['maven', 'dotnet'],
                    javaPackage: 'org.acme.garden.pet.v1',
                    mavenGroupId: 'org.acme.garden',
                    dotnetNamespace: 'Org.Acme.Garden.Pet',
                    dotnetPackageId: 'Org.Acme.Garden.Pet.StreamApi',
                    mqs: 'Kafka'
                })
            .then(sandbox.generate))
            .then(result => { dir = result.dir }));
        afterAll(sandbox.clean);

        it('should generate dist', () =>
            expect(fs.existsSync(`${dir}/dist`))
                .toBeTruthy());

        it('should copy default-types in dist', () =>
            expect(fs.existsSync(`${dir}/dist/model/ts/node_modules/apikana/default-types.ts`))
                .toBeTruthy());

        describe('generated JSON API', () => {
            var api;
            beforeAll(() => { api = JSON.parse(fs.readFileSync(`${dir}/dist/model/openapi/api.json`).toString('utf8')) });

            it('should copy version number in generated API', () =>
                expect(api.info.version)
                    .toBe('0.1.0-rc.1'));
        })
    })
})




