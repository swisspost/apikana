const fs = require('fs-extra');

describe('generating', () => {

    describe('an API', () => {
        const sandbox = require('./sandbox')();
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

        describe('with a dependency', () => {
            const gulp = require('gulp');
            const depSandbox = require('./sandbox')();
            const mainSandbox = require('./sandbox')();
            var depDir;
            var mainDir;
            beforeAll(() => depSandbox.init()
                .then(() =>
                    depSandbox.scaffold({
                        type: 'rest-api',
                        domain: 'acme.org',
                        author: 'coyote',
                        namespace: 'wild.pet',
                        shortName: 'wild-pet',
                        projectName: 'wild-pet-rest-api',
                        title: 'Wild Pet Rest API',
                        plugins: []
                    }))
                .then(depSandbox.generate)
                .then(result => { depDir = result.dir })
                .then(() => mainSandbox.init())
                .then(() =>
                    mainSandbox.scaffold({
                        type: 'rest-api',
                        domain: 'acme.org',
                        author: 'coyote',
                        namespace: 'zoo.pet',
                        shortName: 'zoo-pet',
                        projectName: 'zoo-pet-rest-api',
                        title: 'Zoo Pet Rest API',
                        plugins: []
                    }))
                .then(result => { mainDir = result.dir })
                .then(() => new Promise(resolve => fs.writeFile(`${mainDir}/src/ts/pet.ts`,`
                import {Pet} from "wild-pet-rest-api/dist/model/ts/pet";
                export interface PetFamily {
                    pets: Pet[]
                }
                `, () => resolve())))
                .then(() =>
                    new Promise(resolve =>
                        gulp.src('src/ts/**/*.ts', {cwd: depDir})
                            .pipe(gulp.dest('node_modules/-api-dependencies/ts/wild-pet-rest-api/dist/model/ts', {cwd: mainDir})).on('finish', resolve)))
                .then(() =>
                    new Promise(resolve =>
                        gulp.src('dist/model/json-schema-v4/*.json', {cwd: depDir})
                            .pipe(gulp.dest('node_modules/-api-dependencies/ts/wild-pet-rest-api/dist/model/json-schema-v4', {cwd: mainDir})).on('finish', resolve)))
                .then(() =>
                    new Promise(resolve =>
                        gulp.src('dist/model/json-schema-v3/*.json', {cwd: depDir})
                            .pipe(gulp.dest('node_modules/-api-dependencies/ts/wild-pet-rest-api/dist/model/json-schema-v3', {cwd: mainDir})).on('finish', resolve)))
                .then(mainSandbox.generate));


            afterAll(depSandbox.clean);
            afterAll(mainSandbox.clean);

            it('generates a complete API file with inlined dependencies', () => {
                expect(JSON.parse(fs.readFileSync(`${mainDir}/dist/model/openapi/complete-api.json`).toString('utf8'))
                    .definitions.Pet.properties.firstName.type).toBe('string');
            })
        })
    })
})
