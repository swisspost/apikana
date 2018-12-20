;"use strict";


const Stream = require( "stream" );
const StreamUtils = require( "../../src/util/stream-utils" );

function noop(){}


describe( "stream-utils.streamConcat" , function(){


    it( "concatenates streams in sequence" , function( done ){
        const streamOne = new Stream.Readable({ read:noop });
        streamOne.push( "contents\tOf\rStream\nOne" );
        streamOne.push( null );
        const streamTwo = new Stream.Readable({ read:noop });
        streamTwo.push( "contents\0Of\nStreamTwo" );
        streamTwo.push( null );
        const streamThree = new Stream.Readable({ read:noop });
        streamThree.push( "contentsOf" );
        streamThree.push( "StreamThree" );
        streamThree.push( null );

        const allStreams = StreamUtils.streamConcat([
            streamOne,
            streamTwo,
            streamThree,
        ]);

        var completeContent = "";
        allStreams
            .on( "data" , function( chunk ){
                completeContent += chunk.toString();
            })
            .on( "error" , function(){
                expect( "This function" ).toBe( "never called" );
            })
            .on( "end" , function(){
                expect( completeContent )
                    .toEqual( "contents\tOf\rStream\nOne"+"contents\0Of\nStreamTwo"+"contentsOfStreamThree" )
                ;
                done();
            })
        ;
    });


});


describe( "stream-utils.createLinePrefixStream" , function(){


    it( "Prefixes all lines with specified string" , function( done ){
        const myPrefix = "MYPREFIX ";
        var result = "";

        new Stream.Readable({ read:function(){
                this.push( "This is my text\n" );
                this.push( "spread over multiple " );
                this.push( "lines.\nEven linebreaks\nin same chunk\n" );
                this.push( "shouldn't be a problem\n" );
                this.push( null );
            }})
            .pipe( StreamUtils.createLinePrefixStream({ prefix:myPrefix }))
            .on( "error" , function( err ){
                fail( err || Error("Unexpectedly falsy error occurred") );
            })
            .on( "data" , function( chunk ){
                result += chunk.toString();
            })
            .on( "end" , function(){
                expect( result ).toEqual(
                    "MYPREFIX This is my text\n" +
                    "MYPREFIX spread over multiple lines.\n" +
                    "MYPREFIX Even linebreaks\n" +
                    "MYPREFIX in same chunk\n" +
                    "MYPREFIX shouldn't be a problem\n"
                );
                done();
            })
        ;
    });


});


describe( "stream-utils.streamFromError" , function(){


    it( "Creates a Readable which fails with specified error" , function( done ){
        const myError = Error( "This is the error to fail with" );

        StreamUtils.streamFromError( myError )
            .on( "data" , function(){
                fail( "That callback shouldn't be fired." );
            })
            .on( "end" , function() {
                fail( "That callback shouldn't be fired." );
            })
            .on( "error" , function( err ){
                expect( err ).toBe( myError );
                done();
            })
        ;
    });


});


describe( "stream-utils.emptyStream" , function(){


    it( "Creates an empty stream" , function( done ){
        StreamUtils.emptyStream()
            .on( "data" , function(){
                fail( "No data expected" );
            })
            .on( "error" , function( err ){
                console.error( err );
                fail( "No error expected" );
            })
            .on( "end" , function(){
                done();
            })
        ;
    });


});


describe( "stream-utils.createStringWritable" , function(){


    it( "Simply streams specified string." , function( done ){
        const myInput = "This is my input string I want to stream";
        let result = "";

        StreamUtils.streamFromString( myInput )
            .on( "error" , function( err ){
                console.error( err );
                fail( "No error expected" );
            })
            .on( "data" , function( chunk ){
                result += chunk;
            })
            .on( "end" , function(){
                expect( result ).toEqual( myInput );
                done();
            })
        ;
    });


});
