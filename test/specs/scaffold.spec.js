"use strict";

const fs = require('fs-extra');
const sandbox = require('./sandbox');

describe('scaffolding', () => {

    beforeAll(sandbox.init);
    afterAll(sandbox.clean);

    it('should create a directory', done => {
        sandbox.generator().runActions({
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
        .then(_ => {
            fs.exists(`${sandbox.dir()}/garden-pet-stream-api`, res => res || fail())
            done();
        })
    })
})




