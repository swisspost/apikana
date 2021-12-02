const fs = require('fs-extra');

[
    ['1.0.0', 'NEVER', '1.0.0'],
    ['1.0.0-rc.1', 'NEVER', '1.0.0-rc.1'],
    ['1.0.0-feature-test.1', 'NEVER', '1.0.0-feature-test.1'],
    ['1.0.0', 'RC_ONLY', '1.0.0'],
    ['1.0.0-rc.1', 'RC_ONLY', '1.0.0-SNAPSHOT'],
    ['1.0.0-feature-test.1', 'RC_ONLY', '1.0.0-feature-test.1'],
    ['1.0.0', 'ALL_NON_FINAL', '1.0.0'],
    ['1.0.0-rc.1', 'ALL_NON_FINAL', '1.0.0-SNAPSHOT'],
    ['1.0.0-feature-test.1', 'ALL_NON_FINAL', '1.0.0-feature-SNAPSHOT'],
    ['1.0.0', null, '1.0.0'],
    ['1.0.0-rc.1', null, '1.0.0-SNAPSHOT'],
    ['1.0.0-feature-test.1', null, '1.0.0-feature-test.1']
].forEach(([version, snapshotVersion, expectedMvnVersion]) => {
    describe('an Api with version', () => {
        const sandbox = require('./sandbox')();
        var dir;
        beforeAll(() => sandbox.init()
            .then(() => sandbox.scaffold({
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
                snapshotVersion: snapshotVersion,
                dotnetNamespace: 'Org.Acme.Garden.Pet',
                dotnetPackageId: 'Org.Acme.Garden.Pet.StreamApi',
                mqs: 'Kafka'
            })
            .then(() => sandbox.setVersion(version)
            .then(sandbox.generate)))
            .then(result => { dir = result.dir }));
        afterAll(sandbox.clean);

        it(`should set snapshot version ${expectedMvnVersion} in pom.xml for version ${version} and setting ${snapshotVersion}`, () => {
            var pom = fs.readFileSync(`${dir}/gen/maven/pom.xml`).toString('utf8');
            return expect(pom)
                .toContain(`<version>${expectedMvnVersion}</version>`)
        });
    });
});

describe('an Api with version', () => {
    const sandbox = require('./sandbox')();
    var dir;
    beforeAll(() => sandbox.init()
        .then(() => sandbox.scaffold({
            type: 'stream-api',
            domain: 'acme.org',
            author: 'coyote',
            namespace: 'garden.pet',
            shortName: 'garden-pet',
            projectName: 'garden-pet-stream-api',
            title: 'Garden Pet Stream API',
            plugins: ['maven', 'dotnet'],
            javaPackage: 'org.acme.garden.pet.v1',
            mavenGroupId: 'org.acme.garden', // snapshotVersion undefined
            dotnetNamespace: 'Org.Acme.Garden.Pet',
            dotnetPackageId: 'Org.Acme.Garden.Pet.StreamApi',
            mqs: 'Kafka'
        })
        .then(() => sandbox.setVersion('0.1.0-feature-sample.13')
        .then(sandbox.generate)))
        .then(result => { dir = result.dir }));
    afterAll(sandbox.clean);

    it(`should set snapshot version in pom.xml when default setting is used`, () => {
        var pom = fs.readFileSync(`${dir}/gen/maven/pom.xml`).toString('utf8');
        return expect(pom)
            .toContain(`<version>0.1.0-feature-sample.13</version>`)
    });
});

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

        it('should generate dist v4', () =>
            expect(fs.existsSync(`${dir}/dist/model/json-schema-v4`))
                .toBeTruthy());

        it('should generate dist v3', () =>
            expect(fs.existsSync(`${dir}/dist/model/json-schema-v3`))
                .toBeTruthy());

        it('should generate dist v7', () =>
            expect(fs.existsSync(`${dir}/dist/model/json-schema-v7`))
                .toBeTruthy());

        it('dist v7 should not be empty', () =>
            expect(fs.emptyDirSync(`${dir}/dist/model/json-schema-v7`))
                .toBeFalsy());

        it('should generate pom.xml', () =>
            expect(fs.existsSync(`${dir}/gen/maven/pom.xml`))
                .toBeTruthy());

        it('should generate api.csproj', () =>
            expect(fs.existsSync(`${dir}/gen/dotnet/api.csproj`))
                .toBeTruthy());

        it('should set snapshot version in pom.xml', () => {
            var pom = fs.readFileSync(`${dir}/gen/maven/pom.xml`).toString('utf8');
            return expect(pom)
                .toContain('<version>0.1.0-SNAPSHOT</version>')
        });

        it('should copy default-types in dist', () =>
            expect(fs.existsSync(`${dir}/dist/model/ts/node_modules/apikana/default-types.ts`))
                .toBeTruthy());


        it('generated schema json v4 files should have correct schema defined', () => {
            var fileNames = fs.readdirSync(`${dir}/dist/model/json-schema-v4`);
                for(var i = 0; i < fileNames.length; i++){
                    var json = JSON.parse(fs.readFileSync(`${dir}/dist/model/json-schema-v4/${fileNames[i]}`).toString('utf8'))

                    expect(json.$schema)
                        .toBe("http://json-schema.org/draft-04/schema#");
                    expect(json.id)
                        .toEqual(jasmine.anything());
                }
        });

        it('generated schema json v3 files should have correct schema defined', () => {
            var fileNames = fs.readdirSync(`${dir}/dist/model/json-schema-v3`);
                for(var i = 0; i < fileNames.length; i++){
                    var json = JSON.parse(fs.readFileSync(`${dir}/dist/model/json-schema-v3/${fileNames[i]}`).toString('utf8'))

                    expect(json.$schema)
                        .toBe("http://json-schema.org/draft-03/schema#");
                    expect(json.id)
                        .toEqual(jasmine.anything());
                }
        });

        it('generated schema json v7 files should have correct schema defined', () => {
            var fileNames = fs.readdirSync(`${dir}/dist/model/json-schema-v7`);
                for(var i = 0; i < fileNames.length; i++){
                    var json = JSON.parse(fs.readFileSync(`${dir}/dist/model/json-schema-v7/${fileNames[i]}`).toString('utf8'))

                    expect(json.$schema)
                        .toBe("http://json-schema.org/draft-07/schema");
                    expect(json.$id) // id property gets migrated with draft migration: id -> $id.
                        .toEqual(jasmine.anything());
                }
        });

        it('generated schema full json v7 file should have correct schema defined', () => {
            var fileNames = fs.readdirSync(`${dir}/dist/model/json-schema-v7-full`);
                for(var i = 0; i < fileNames.length; i++){
                    var json = JSON.parse(fs.readFileSync(`${dir}/dist/model/json-schema-v7-full/${fileNames[i]}`).toString('utf8'))

                    expect(json.$schema)
                        .toBe("http://json-schema.org/draft-07/schema");
                    expect(json.$id)
                        .toEqual(jasmine.anything());
                    expect(json.definitions.Pet.properties.firstName.type)
                        .toBe('string');
                }
        });

        describe('generated JSON API', () => {
            var api;
            beforeAll(() => { api = JSON.parse(fs.readFileSync(`${dir}/dist/model/openapi/api.json`).toString('utf8')) });

            it('should copy version number in generated API', () =>
                expect(api.info.version)
                    .toBe('0.1.0-rc.1'));
        });

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
                        gulp.src('dist/model/json-schema-v7/*.json', {cwd: depDir})
                            .pipe(gulp.dest('node_modules/-api-dependencies/ts/wild-pet-rest-api/dist/model/json-schema-v7', {cwd: mainDir})).on('finish', resolve)))
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
