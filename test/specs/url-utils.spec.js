"use strict";


const UrlUtils = require("src/url-utils");


describe( "url-utils.dropLeadingSlashes" , function(){


    it( "drops leading slashes" , function( done ){
        // Shorthand for simpler testing.
        const dls = UrlUtils.dropLeadingSlashes.bind( UrlUtils );

        expect( dls("/foo/bar/")    ).toBe( "foo/bar/"    );
        expect( dls("foo/bar/")     ).toBe( "foo/bar/"    );
        expect( dls("////////")     ).toBe( ""            );
        expect( dls("foo////bar")   ).toBe( "foo////bar"  );
        expect( dls("")             ).toBe( ""            );
        expect( dls("noSlashHere")  ).toBe( "noSlashHere" );
        expect( dls("//foo//bar//") ).toBe( "foo//bar//"  );
        expect( dls("/////a////")   ).toBe( "a////"       );

        done();
    });


});
