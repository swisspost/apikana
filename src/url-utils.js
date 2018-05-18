"use strict";


module.exports = Object.create( Object.prototype , {

    /**
     * <p>Filter, removing all leading slashes from given string.</p>
     * @param str {String}
     *      String where to remove all leading slashes.
     * @return {String}
     *      Specified string but without any leading slashes.
     */
    dropLeadingSlashes: { value: function dropLeadingSlashes( str ){
        if( typeof(str) !== "string" ) throw TypeError( "Arg 'str' of unexpected type. Expected 'string' but got '"+typeof(str)+"'." );
        var start;
        for( start=0 ; str[start]==='/' ; ++start );
        str = str.substr( start );
        return str;
    }}

});
