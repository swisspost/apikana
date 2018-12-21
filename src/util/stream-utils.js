;"use strict";


exports.createStringWritable = createStringWritable;
exports.streamConcat = streamConcat;
exports.streamFromError = streamFromError;
exports.streamFromString = streamFromString;
exports.emptyStream = emptyStream;
exports.createLinePrefixStream = createLinePrefixStream;


// Private ////////////////////////////////////////////////////////////////////

const Stream = require("stream");


/**
 * @return {Writable|Promise}
 *      A writable stream with a mixed in promise. The promise will resolve
 *      with the written content as string as soon the writable has finished.
 */
function createStringWritable() {
    var fulfill, reject;
    var promise = new Promise(function( f , r ){ fulfill=f; reject=r; });
    var writable = new Stream.Writable();
    var chunks = [];
    Object.defineProperties( writable , {
        _write: { value: function( chunk , encoding , done ) {
            chunks.push( chunk.toString() );
            setImmediate( done );
        }},
        then: { value: promise.then.bind(promise) },
        "catch": { value: promise["catch"].bind(promise) },
    });
    writable.on( "finish" , function() {
        setImmediate( fulfill , chunks.join("") );
        chunks = null;
    });
    // HINT: This doesn't work. Errors from source will never pass here. Instead,
    // client has to register a handler for 'error' event before pipe to us.
    writable.on( "error" , function( err ) {
        setImmediate( reject , err );
        chunks = null;
    });
    return writable;
}


/**
 * @param streams {Array<Readable>}
 * @param [options={}]
 * @param [options.finalize=true] {boolean}
 *      Define if the stream gets closed when all specified streams got
 *      forwarded.
 * @param [options.objectMode=false] {boolean}
 *      Specifies behavior for this stream as specified by nodejs streams.
 * @return {Readable}
 *      A readable containing all passed in readables.
 */
function streamConcat( streams , options ){
    if( !options ) options = {};
    const objectMode = (options.objectMode === undefined ? false : options.objectMode );
    const finalize = (options.finalize === undefined) ? true : options.finalize;
    options = null;
    streams = streams.slice( 0 ); // Make a copy to resist changes from outside.
    const that = new Stream.Readable({ objectMode:objectMode , read:read });
    var isRunning = false;
    return that;
    function read( n ){
        if( isRunning ){ return; }else{ isRunning=true; }
        (function handleNextSrcStream(){
            const stream = streams.shift();
            if( stream ){
                stream.on( "data" , that.push.bind(that) );
                stream.on( "end" , handleNextSrcStream );
                stream.on( "error" , that.emit.bind(that,"error") );
            }else{ // All inputs streamed.
                if( finalize ){
                    that.push( null );
                }
            }
        }());
    }
}


/**
 * @return {Readable}
 *      An empty Readable.
 */
function emptyStream() {
    return new Stream.Readable({ read:function(){ this.push(null); }});
}


/**
 * @param err
 *      The error to use as only error element for returned readable.
 * @return {Readable}
 *      A readable which will result in specified error.
 */
function streamFromError( err ){
    var isRunning = false;
    return new Stream.Readable({ read:function(){
        if( isRunning ){ return; }else{ isRunning=true; }
        setImmediate( this.emit.bind(this,"error",err) );
    }});
}


/**
 * @param str {string}
 * @return {Readable<Buffer>}
 *      A Readable which streams the passed string.
 */
function streamFromString( str ) {
    const that = new Stream.Readable({ read:read });
    return that;
    function read( n ){
        that.push( str );
        that.push( null );
    }
}


/**
 * @param options.prefix {string}
 *      The string to insert before each line.
 * @return {stream.Duplex}
 *      The stream inserting the configured prefix.
 */
function createLinePrefixStream( options ){
    if( !options ) options = {};
    const prefix = options.prefix;
    if( typeof(prefix) !== "string" ){ throw TypeError("Arg 'prefix' expected to be string."); }
    options = null; // Prevent later usage.
    const that = new Stream.Duplex({ read:read , write:onInput });
    var previousCharWasNewline = true;
    that.on( "finish" , that.push.bind(that,null) );
    return that;
    function onInput( chunk , enc , ready ){
        var begin = 0;
        for( var i=0 ; i<chunk.length ; ++i ){
            if( previousCharWasNewline ){
                that.push( prefix );
                previousCharWasNewline = false;
            }
            if( chunk[i] === 10 ){
                var sub = chunk.slice( begin , i+1 );
                that.push( sub );
                begin = i+1;
                previousCharWasNewline = true;
            }
        }
        if( begin < i ){
            if( previousCharWasNewline ){
                that.push( prefix );
            }
            that.push(chunk.slice(begin));
            if( chunk[chunk.length-1] == 10 ){
                previousCharWasNewline = true;
            }else{
                previousCharWasNewline = false;
            }
        }
        ready();
    }
    function read( n ) {
        // Empty, because we don't support back-pressure yet.
    }
}
