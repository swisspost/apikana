"use strict";


const Jasmine = require( "jasmine" );

const DEBUG = typeof(process.env.DEBUG) != "undefined";
const NODE_PATH = process.env.NODE_PATH;


if( require.main == module ) setTimeout( main );


function main(){

    exitWhenEnvNotOk();

    if(DEBUG) console.log( "\x1b[36m[DEBUG] Create jasmine instance.\x1b[39m" );
    const jasmine = new Jasmine();

    const configFilePath = __dirname.replace(/\\/g,'/') + "/jasmine.config.json";
    if(DEBUG) console.log( "\x1b[36m[DEBUG] Load jasmine config '"+ configFilePath +"'.\x1b[39m" );
    jasmine.loadConfigFile( configFilePath );

    if(DEBUG) console.log( "\x1b[36m[DEBUG] Execute jasmine tests now.\x1b[39m" );
    jasmine.execute();
}


function exitWhenEnvNotOk(){
    const envPath = NODE_PATH ? NODE_PATH.replace(/\\/g,'/') : null;
    const cwd = process.cwd().replace( /\\/g , '/' );

    // Check if our cwd (assuming its our project root dir) exists in NODE_PATH.
    // This enables us to use paths relative to our projects root to write our
    // include statements in our tests.
    if( !envPath || envPath.indexOf(cwd) == -1 ){ printAndExit(); }

    function printAndExit(){
        console.log( "\x1b[31m[ERROR]\x1b[39m Make sure projects root dir is included in NODE_PATH:" );
        console.log( "\x1b[31m[ERROR]\x1b[39m " );
        console.log( "\x1b[31m[ERROR]\x1b[39m     export NODE_PATH=`pwd`:$NODE_PATH" );
        console.log( "\x1b[31m[ERROR]\x1b[39m " );
        console.log( "\x1b[31m[ERROR]\x1b[39m Or if you're on windows:" );
        console.log( "\x1b[31m[ERROR]\x1b[39m " );
        console.log( '\x1b[31m[ERROR]\x1b[39m     set "NODE_PATH=C:\\apikana\\root\\dir\\"' );
        console.log( "\x1b[31m[ERROR]\x1b[39m " );
        process.exit( 1 );
    }
}

