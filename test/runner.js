"use strict";


const Jasmine = require( "jasmine" );

const DEBUG = typeof(process.env.DEBUG) !== "undefined";


if( require.main === module ) setTimeout( main );


function main(){

    if(DEBUG) console.log( "\x1b[36m[DEBUG] Create jasmine instance.\x1b[39m" );
    const jasmine = new Jasmine();

    const configFilePath = __dirname.replace(/\\/g,'/') + "/jasmine.config.json";
    if(DEBUG) console.log( "\x1b[36m[DEBUG] Load jasmine config '"+ configFilePath +"'.\x1b[39m" );
    jasmine.loadConfigFile( configFilePath );

    if(DEBUG) console.log( "\x1b[36m[DEBUG] Execute jasmine tests now.\x1b[39m" );
    jasmine.execute();
}
