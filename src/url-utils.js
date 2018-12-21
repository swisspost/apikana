

exports.dropLeadingSlashes = dropLeadingSlashes;

exports.dropTrailingSlashes = dropTrailingSlashes;

exports.dropSurroundingSlashes = dropSurroundingSlashes;


// Private ////////////////////////////////////////////////////////////////////

/**
 * <p>Filter, removing all leading slashes from given string.</p>
 * @param str {String}
 *      String where to remove all leading slashes.
 * @return {String}
 *      Specified string but without any leading slashes.
 */
function dropLeadingSlashes( str ){
	if( typeof(str) !== "string" ) throw TypeError( "Arg 'str' of unexpected type. Expected 'string' but got '"+typeof(str)+"'." );
	var start;
	for( start=0 ; str[start]==='/' ; ++start );
	str = str.substr( start );
	return str;
}

/**
 * <p>Filter, removing all trailing slashes from given string.</p>
 * <p>WARN: Not tested yet</p>
 * @param str {String}
 *      String where to remove all trailing slashes.
 * @return {String}
 *      Specified string but without any trailing slashes.
 */
function dropTrailingSlashes( str ){
	if( typeof(str) !== "string" ) throw TypeError( "Arg 'str' of unexpected type. Expected 'string' but got '"+typeof(str)+"'." );
	var start;
	for( start=str.length-1 ; str[start]==='/' ; --start );
	str = str.substr( 0 , start+1 );
	return str;
}

/**
 * <p>Combines {@link dropLeadingSlashes} and {@link dropTrailingSlashes}.</p>
 * <p>WARN: Not tested yet</p>
 */
function dropSurroundingSlashes( str ) {
	return dropLeadingSlashes(dropTrailingSlashes( str ));
}
