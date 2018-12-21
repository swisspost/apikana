;"use strict";

const JavaParser = require("java-parser");
const PathV3Generator = require("../../src/path-v3-generator/path-v3-generator");
const StreamUtils = require("../../src/util/stream-utils");


function noop(){}


describe( "PathV3Generator" , ()=>{


    it( "Failfast when get invoked with an illegal javaPackage" , ( done )=>{
        const illegalPackages = [
            "space.not allowed", "hyphen-not.allowed", "+", "-", true,
            ""/*empty string*/, "42", "com.9number",
        ];
        for( var i=0 ; i<illegalPackages.length ; ++i ){
            const javaPackage = illegalPackages[ i ];
            try{
                PathV3Generator.createPathV3Generator({
                    openApi:{ info: { title:"asdf" } },
                    javaPackage: javaPackage
                });
                fail( "Expected to throw when using javaPackage=\""+javaPackage+"\"" );
            }catch( err ){
                expect( err.message ).toMatch( /javaPackage/i );
            }
        }
        done();
    });


    it( "Generates path classes based on title from openapi model" , function( done ){
        const victim = PathV3Generator.createPathV3Generator({
            openApi: {
                info: {
                    title: "My foo Api",
                },
                paths: {}
            },
            javaPackage: "com.example"
        });

        victim.readable()
            .pipe( StreamUtils.createStringWritable() )
            .then( assertResult )
        ;

        function assertResult( result ){
            const lines = result.split( '\n' );
            for( var i=0 ; i<lines.length ; ++i ){
                const line = lines[i];
                const m = /^public static class (.*) {$/.exec( line );
                if( m ){
                    const className = m[1];
                    expect( className ).toEqual( "MyFooApi" );
                    break;
                }
            }
            done();
        }
    });


    it( "Places generated class into specified package" , function( done ){
        const victim = PathV3Generator.createPathV3Generator({
            openApi: {
                info: {
                    title: "asdf",
                },
                paths: {},
            },
            javaPackage: "com.example.lib.my.api.v1.path",
        });

        victim.readable()
            .pipe( StreamUtils.createStringWritable() )
            .then( assertResult )
        ;

        function assertResult( result ){
            const lines = result.split( '\n' );
            var firstNonEmptyLine = "";
            for( var i=0 ; firstNonEmptyLine.length < 1 && i<lines.length ; ++i ){
                firstNonEmptyLine = lines[i];
            }
            expect( firstNonEmptyLine ).toEqual( "package com.example.lib.my.api.v1.path;" );
            done();
        }
    });


    it( "Provides first segment after specified basePath" , function( done ){
        const victim = PathV3Generator.createPathV3Generator({
            openApi: {
                info: {
                    title: "winnie poo",
                },
                paths: {
                    "/my/api/v1/foo/blubb": null,
                    "/my/api/v1/bar/blubb": null,
                }
            },
            pathPrefix: "/my/api/v1/",
            javaPackage: "com.example",
        });

        victim.readable()
            .pipe( StreamUtils.createStringWritable() )
            .then( assertResult )
        ;

        function assertResult( result ){
            const compilationUnit = JavaParser.parse( result , {} );
            const clazz = compilationUnit.types[0];
            const foo = clazz.bodyDeclarations.filter( e => e.name.identifier==="foo" )[0];
            expect( foo ).toBeTruthy();
            const bar = clazz.bodyDeclarations.filter( e => e.name.identifier==="bar" )[0];
            expect( bar ).toBeTruthy();
            done();
        }
    });


    it( "Provides MyApi.one.two.three when using path '/my/api/v1/one/two/three'" , function( done ){
        const victim = PathV3Generator.createPathV3Generator({
            openApi: {
                info: {
                    title: "qwer qwer API",
                },
                paths: {
                    "/my/api/v1/one/two/three": null,
                }
            },
            javaPackage: "com.example",
            pathPrefix: "/my/api/v1/",
        });

        victim.readable()
            .pipe( StreamUtils.createStringWritable() )
            .then( assertResult )
        ;

        function assertResult( result ){
            const compilationUnit = JavaParser.parse( result , {} );
            const clazz = compilationUnit.types[0];
            const one = clazz.bodyDeclarations.filter( e => e.name.identifier==="one" )[0];
            const two = one.bodyDeclarations.filter( e => e.name && e.name.identifier==="two" )[0];
            const three = two.bodyDeclarations.filter( e => e.name && e.name.identifier==="three" )[0];
            const res = three.bodyDeclarations.filter( e => e.fragments && e.fragments[0].name.identifier==="RESOURCE" )[0];
            expect( res.fragments[0].initializer.escapedValue ).toEqual( '"/one/two/three"' );
            done();
        }
    });


    it( "Provides RESOURCE identifier with leading, but without trailing slash" , function( done ){
        const victim = PathV3Generator.createPathV3Generator({
            openApi: {
                "info": {
                    "title": "My bar API"
                },
                "paths": {
                    "/store-inventory": null,
                    "/2nd/try": null,
                    "/what.about.dots": null,
                    "/are/you/sure?": null,
                    "/are/you/a-genious": null,
                    "/a space": null,
                }
            },
            javaPackage: "com.example",
        });

        victim.readable()
            .pipe( StreamUtils.createStringWritable() )
            .then( assertResult )
        ;

        function assertResult( result ){
            const compileUnit = JavaParser.parse( result , {});
            const values = collectAllValuesOfResourceConstants( compileUnit );
            expect( values.length ).toBe( 24 );
            for( let i=0 ; i<values.length ; ++i ){
                const value = values[i];
                expect( value ).toMatch( /^"\// ); // MUST HAVE leading slash.
                expect( value ).toMatch( /[^\/]"$/ ); // MUST NOT HAVE trailing slash.
            }
            done();
        }
        function collectAllValuesOfResourceConstants( node ){
            const resourceValues = [];
            createJavaParserNodeIterator( node ).forEach(function( node ){
                if( node.node==="FieldDeclaration" ){
                    if( node.fragments.length > 1 ) throw Error( "Unexpected state" );
                    const name = node.fragments[0].name.identifier;
                    if( name === "RESOURCE" ){
                        const value = node.fragments[0].initializer.escapedValue;
                        resourceValues.push( value );
                    }
                }
            });
            return resourceValues;
        }
    });


    it( "Provides COLLECTION identifier with leading and trailing slash" , function( done ){
        // Hint: This test doesn't check if there's a leading slash.

        const victim = PathV3Generator.createPathV3Generator({
            openApi: {
                info: {
                    title: "asdfsadf",
                },
                paths: {
                    "/customer": null,
                    "/customer/{id}": null,
                    "/customer/{id}/name": null,
                    "/customer/{id}/contact": null,
                    "/customer/{id}/contact/postal": null,
                }
            },
            javaPackage: "com.example",
        });

        victim.readable()
            .pipe( StreamUtils.createStringWritable() )
            .then( assertResult )
        ;

        function assertResult( result ){
            const compileUnit = JavaParser.parse( result , {});
            const values = collectAllValuesOfCollectionConstants( compileUnit );
            expect( values.length ).toBe( 18 );
            for( let i=0 ; i<values.length ; ++i ){
                const value = values[i];
                expect( value ).toEqual( 'RESOURCE + "/"' );
            }
            done();
        }
        function collectAllValuesOfCollectionConstants( node ){
            const resourceValues = [];
            createJavaParserNodeIterator( node ).forEach(function( node ){
                if( node.node==="FieldDeclaration" ){
                    if( node.fragments.length > 1 ) throw Error( "Unexpected state" );
                    const name = node.fragments[0].name.identifier;
                    if( name === "COLLECTION" ){
                        const initializer = node.fragments[0].initializer;
                        const value =
                            initializer.leftOperand.identifier +
                            " "+ initializer.operator +
                            " "+ initializer.rightOperand.escapedValue
                        ;
                        resourceValues.push( value );
                    }
                }
            });
            return resourceValues;
        }
    });


    it( "Provides BASED identifier where we can continue with follow-up segments" , function( done ){
        const victim = PathV3Generator.createPathV3Generator({
            openApi: {
                info: {
                    title: "foo bar api",
                },
                paths: {
                    "/foo/bar/v1/pet/{id}/foo/bar": null,
                },
            },
            javaPackage: "com.example",
        });

        victim.readable()
            .pipe( StreamUtils.createStringWritable() )
            .then( assertResult )
        ;

        function assertResult( result ){
            const compileUnit = JavaParser.parse( result , {});
            const clazz = compileUnit.types[0];
            const fooSegment = clazz.bodyDeclarations.filter( e => e.name.identifier==="foo" )[0];
            expect( fooSegment ).toBeTruthy();
            const based = fooSegment.bodyDeclarations.filter( e => e.name && e.name.identifier==="BASED" )[0];
            expect( based ).toBeTruthy();
            // Check if BASED class has expected content.
            const barSegment = based.bodyDeclarations.filter( e => e.name.identifier==="bar" )[0];
            expect( barSegment ).toBeTruthy();
            done();
        }
    });


    it( "The BASED identifier is only available once in a chain" , function( done ){
        const victim = PathV3Generator.createPathV3Generator({
            openApi: {
                info: {
                    title: "abc def ghi",
                },
                paths: {
                    "/one/two/three/four/five/six": null,
                }
            },
            javaPackage: "com.example",
        });

        victim.readable()
            .pipe( StreamUtils.createStringWritable() )
            .then( assertResult )
        ;

        function assertResult( result ){
            const compilationUnit = JavaParser.parse( result , {} );
            const clazz = compilationUnit.types[0];
            const one = clazz.bodyDeclarations.filter( e => e.name.identifier==="one" )[0];
            const two = one.bodyDeclarations.filter( e => e.name && e.name.identifier==="two" )[0];
            const based = two.bodyDeclarations.filter( e => e.name && e.name.identifier==="BASED" )[0];
            const three = based.bodyDeclarations.filter( e => e.name.identifier==="three" )[0];
            const threeBased = three.bodyDeclarations.filter( e => e.name && e.name.identifier==="BASED" )[0];
            expect( threeBased ).toBeFalsy();
            done();
        }
    });


    it( "Puts only segments after BASED identifier into the constant" , function( done ){
        const victim = PathV3Generator.createPathV3Generator({
            openApi: {
                info: {
                    title: "my root class",
                },
                paths: {
                    "/one/two/three": null,
                }
            },
            javaPackage: "com.example",
        });

        victim.readable()
            .pipe( StreamUtils.createStringWritable() )
            .then( assertResult )
        ;

        function assertResult( result ){
            const compileUnit = JavaParser.parse( result , {} );
            // Extract MyRootClass
            const clazz = compileUnit.types[0];
            expect( clazz.name.identifier ).toEqual( "MyRootClass" );
            // Extract MyRootClass.one
            const oneSegment = clazz.bodyDeclarations.filter( e => e.name && e.name.identifier==="one" )[0];
            expect( oneSegment ).toBeTruthy();
            // Extract MyRootClass.one.BASED
            const based = oneSegment.bodyDeclarations.filter( e => e.name && e.name.identifier==="BASED" )[0];
            expect( based ).toBeTruthy();
            // Extract MyRootClass.one.BASED.two
            const basedTwoSegment = based.bodyDeclarations.filter( e => e.name && e.name.identifier==="two" )[0];
            expect( basedTwoSegment ).toBeTruthy();
            // Extract MyRootClass.one.BASED.two.RESOURCE
            const resourceConstant = basedTwoSegment.bodyDeclarations.filter( e => e.fragments && e.fragments[0].name.identifier==="RESOURCE" )[0];
            expect( resourceConstant ).toBeTruthy();
            const value = resourceConstant.fragments[0].initializer.escapedValue;
            // Absolute path would be "/one/two". But because we used ".one.BASED.two" we
            // now expect to only get most right segment.
            expect( value ).toEqual( '"/two"' );
            done();
        }
    });


    it( "Adds a dollar sign to segments which are a variable" , function( done ){
        const victim = PathV3Generator.createPathV3Generator({
            openApi: {
                info: {
                    title: "foo bar api",
                },
                paths: {
                    "/pet/{petId}/info": null,
                }
            },
            javaPackage: "com.example",
        });

        victim.readable()
            .pipe( StreamUtils.createStringWritable() )
            .then( assertResult )
        ;

        function assertResult( result ){
            const compilationUnit = JavaParser.parse( result , {} );
            const clazz = compilationUnit.types[0];
            const pet = clazz.bodyDeclarations.filter( e => e.name.identifier==="pet" )[0];
            const petId = pet.bodyDeclarations.filter( e => e.name && ~e.name.identifier.indexOf("petId") )[0];
            // Check trailing dollar exists.
            expect( petId.name.identifier ).toEqual( "petId$" );
            const info = petId.bodyDeclarations.filter( e => e.name && ~e.name.identifier.indexOf("info") )[0];
            // Also check next segment does NOT have that trailing dollar.
            expect( info.name.identifier ).toEqual( "info" );
            done();
        }
    });


    it( "Replaces chars not allowed in java identifiers by an underscore char" , function( done ){
        const victim = PathV3Generator.createPathV3Generator({
            openApi: {
                info: {
                    title: "asdf asdf foo",
                },
                paths: {
                    "/store-inventory": null,
                    "/what.about.dots": null,
                    "/are/you/sure?": null,
                    "/are/you/a-genious": null,
                    "/a space": null,
                }
            },
            javaPackage: "com.example",
        });

        victim.readable()
            .pipe( StreamUtils.createStringWritable() )
            .then( assertResult )
        ;

        function assertResult( result ){
            const compilationUnit = JavaParser.parse( result , {} );
            const resources = [];
            createJavaParserNodeIterator( compilationUnit ).forEach(function( node ){
                if( node.node==="TypeDeclaration" && node.name.identifier !== "AsdfAsdfFoo" && node.name.identifier !== "BASED" ){
                    resources.push( node );
                }
            });
            resources.forEach(function( elem ){
                const whitelist = [
                    "a_genious", "a_space", "are", "store_inventory", "sure_", "what_about_dots",
                    "you",
                ];
                expect( whitelist ).toContain( elem.name.identifier );
            });
            done();
        }
    });


    it( "Will fail when substitution of illegal chars would produce a name conflict" , function( done ){
        const victim = PathV3Generator.createPathV3Generator({
            openApi: {
                info: {
                    title: "my grand pa",
                },
                paths: {
                    // Both of them will result in same path because numbers both get replaced by
                    // underscore.
                    "/my/foo/v1/2pack/two": null,
                    "/my/foo/v1/6pack/six": null,
                }
            },
            javaPackage: "com.example",
        });

        victim.readable()
            .on( "data" , noop )
            .on( "finish" , function(){
                expect( "This method" ).toBe( "never called" );
                done();
            })
            .on( "error" , function onError( err ) {
                const msg = err.message;
                expect( msg ).toContain( "2pack" );
                expect( msg ).toContain( "6pack" );
                expect( msg ).toContain( "my/foo/v1/_pack" );
                done();
            })
        ;
    });


    it( "Prepends an additional underscore char to generated identifier when they're a reserved word in java" , function( done ){
        const victim = PathV3Generator.createPathV3Generator({
            openApi: {
                info: {
                    title: "EoarheAoiuno"
                },
                paths: {
                    // Some reserved words found at "https://www.thoughtco.com/reserved-words-in-java-2034200".
                    "/abstract/assert/boolean/break/byte/case": null,
                    "/catch/char/class/const/continue/default": null,
                    "/double/do/else/enum/extends/false": null,
                    "/final/finally/float/for/goto/if": null,
                    "/implements/import/instanceof/int/interface/long": null,
                    "/native/new/null/package/private/protected": null,
                    "/public/return/short/static/strictfp/super": null,
                    "/switch/synchronized/this/throw/throws/transient": null,
                    "/true/try/void/volatile/while": null,
                }
            },
            javaPackage: "com.example",
        });

        victim.readable()
            .pipe( StreamUtils.createStringWritable() )
            .then( assertResult )
        ;

        function assertResult( result ){
            const compilationUnit = JavaParser.parse( result , {});
            const resources = [];
            createJavaParserNodeIterator( compilationUnit ).forEach(function( node ){
                if( node.node==="TypeDeclaration" && node.name.identifier !== "EoarheAoiuno" && node.name.identifier !== "BASED" ){
                    resources.push( node );
                }
            });
            const whitelist = [
                "_abstract", "_assert", "_boolean", "_break", "_byte", "_case",
                "_catch", "_char", "_class", "_const", "_continue", "_default",
                "_double", "_do", "_else", "_enum", "_extends", "_false",
                "_final", "_finally", "_float", "_for", "_goto", "_if",
                "_implements", "_import", "_instanceof", "_int", "_interface", "_long",
                "_native", "_new", "_null", "_package", "_private", "_protected",
                "_public", "_return", "_short", "_static", "_strictfp", "_super",
                "_switch", "_synchronized", "_this", "_throw", "_throws", "_transient",
                "_true", "_try", "_void", "_volatile", "_while",
            ];
            expect( resources.length ).toEqual( 236 );
            resources.forEach(function( elem ){
                expect( whitelist ).toContain( elem.name.identifier );
            });
            done();
        }
    });


    // See: "https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md#pathsObject".
    it( "Failfast when missing slash at begin of path" , function( done ){
        const victim = PathV3Generator.createPathV3Generator({
            openApi: {
                info: {
                    title: "tick trick track",
                },
                paths: {
                    "this/path/is/missing/a/leading/slash": null,
                },
            },
            javaPackage: "com.example",
        });

        victim.readable()
            .on( "data" , noop )
            .on( "error" , function( err ){
                const msg = err.message;
                expect( msg ).toMatch( /slash/i );
                expect( msg ).toContain( "this/path/is/missing/a/leading/slash" );
                setTimeout( done );
            })
            .on( "end" , function(){
                expect( "this function" ).toBe( "never called" );
                setTimeout( done );
            })
        ;

    });


    it( "Failfast when paths contain empty segments" , function( done ){
        const victim = PathV3Generator.createPathV3Generator({
            openApi: {
                info: {
                    title: "tick trick track",
                },
                paths: {
                    "/this/path/contains//two/separators/inside": null,
                }
            },
            javaPackage: "com.example",
        });

        victim.readable()
            .on( "data" , noop )
            .on( "end" , function(){
                expect( "this function" ).toBe( "never called" );
                setTimeout( done );
            })
            .on( "error" , function( err ){
                const msg = err.message;
                expect( msg ).toMatch( /slash/i );
                expect( msg ).toMatch( /double/i );
                expect( msg ).toContain( "/this/path/contains//two/separators/inside" );
                setTimeout( done );
            })
        ;

    });


    it( "Failfast when api has slashes at end of path" , function( done ){
        const victim = PathV3Generator.createPathV3Generator({
            openApi: {
                info: {
                    title: "tick trick track",
                },
                paths: {
                    "/this/path/en-ds/with/an/em-pty/seg-ment/": null,
                },
            },
            javaPackage: "com.example",
        });

        victim.readable()
            .on( "data" , noop )
            .on( "end" , function(){
                expect( "this funciton" ).toBe( "never called" );
                setTimeout( done );
            })
            .on( "error" , function( err ){
                const msg = err.message;
                expect( msg ).toMatch( /segment/i );
                expect( msg ).toMatch( /empty/i );
                expect( msg ).toMatch( /end/i );
                expect( msg ).toContain( "/this/path/en-ds/with/an/em-pty/seg-ment/" );
                setTimeout( done );
            })
        ;
    });


    it( "Will append an undersocre everytime same segment occurs again in same path" , function( done ){
        const victim = PathV3Generator.createPathV3Generator({
            openApi: {
                info: {
                    title: "foo bar"
                },
                paths: {
                    "/foo/foo/bar/foo/bar/bar/foo/foo": null,
                }
            },
            javaPackage: "com.example",
        });

        victim.readable()
            .pipe( StreamUtils.createStringWritable() )
            .then( assertResult )
        ;

        function assertResult( result ){
            const compilationUnit = JavaParser.parse( result , {});
            const expectedIdentifierNames = [
                "foo", "foo_", "bar", "foo__", "bar_", "bar__", "foo___", "foo____",
            ];
            var i = 0;
            var isDone = false;
            const identifierNames = [];
            createJavaParserNodeIterator( compilationUnit ).forEach(function( node ){
                if( isDone ){
                    // Ignore
                }else if( node.node==="TypeDeclaration" ){
                    if( node.name.identifier==="BASED" ){
                        expect( identifierNames.length ).toEqual( expectedIdentifierNames.length );
                        isDone = true;
                    }else if( node.name.identifier !== "FooBar" && node.name.identifier !== "BASED" ){
                        const name = node.name.identifier;
                        expect( name ).toEqual( expectedIdentifierNames[i] );
                        identifierNames.push( name );
                        i += 1;
                    }
                }
            });
            done();
        }
    });


});


function createJavaParserNodeIterator( node ){
    return {
        forEach: function forEach( cback ){
            if( node.node === "CompilationUnit" || node.node === "TypeDeclaration" ){
                cback( node );
                (node.types||[]).forEach(function( elem ){
                    createJavaParserNodeIterator( elem ).forEach( cback );
                });
                (node.bodyDeclarations||[]).forEach(function( bodyDecl ) {
                    createJavaParserNodeIterator( bodyDecl ).forEach( cback );
                });
            }else if( node.node === "MethodDeclaration" || node.node==="FieldDeclaration" ){
                cback( node );
            }else{
                throw Error( "Not impl yet" );
            }
        }
    };
}
