const plopDef = require('../../src/plopfile_init');
const plopMock = require('./plop-utils').plopMock;

describe('init', () => {
    const plop = plopMock(plopDef, 'init');

    it('should use the default domain', () =>
        expect(plop.prompt('domain', { domain: "my.domain"}).default)
            .toBe('my.domain'));

    it('should format domain with dots', () =>
        expect(plop.prompt('domain').filter("My Domain"))
            .toBe('my.domain'));

    it('should format namespace with dots', () =>
        expect(plop.prompt('namespace').filter("My Namespace"))
            .toBe('my.namespace'));

    it('should propose short name from all namespace combinations', () =>
        expect(plop.prompt('shortName').choices({namespace: 'one.two.three'}))
            .toEqual(['three', 'two-three', 'one-two-three']));

    it('should propose a NPM package name built with namespace and short name', () =>
        expect(plop.prompt('npmPackage').default({
            domain: 'two.one',
            namespace: 'three.four.five.six',
            shortName: 'five-six',
            projectName: 'five-six-seven-eight'
        }))
        .toBe('@one-two-three-four/five-six-seven-eight')
    );
});
