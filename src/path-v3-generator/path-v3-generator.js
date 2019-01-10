;"use strict";


exports.createPathV3Generator = createPathV3Generator;


// Private ////////////////////////////////////////////////////////////////////

const Stream = require( "stream" );

const JavaGen = require('../java-gen');
const Log = require('../log');
const StreamUtils = require('../util/stream-utils');
const UrlUtils = require('../url-utils');

const DEBUG = (process.env.DEBUG !== undefined);

function noop(){}


/**
 * @param [options={}]
 * @param options.openApi {object}
 *      The open api spec for the api where we want to build the paths class
 *      for.
 * @param options.openApi.info.title {string}
 *      Required because this will be used to generate the name of the
 *      resulting class.
 * @param options.javaPackage {string}
 *      The java package where the generated class will reside in.
 * @param options.pathPrefix
 *      The common path prefix which will be implicitly available without need
 *      to specify them explicitly.
 * @return {{readable: createReadable}}
 *      A readable streaming the generated class.
 */
function createPathV3Generator( options ) {
    if( !options ) options = {};
    throwIfPathV3GeneratorOptionsBad( options );
    const openApi = options.openApi;
    const javaPackage = options.javaPackage;
    const pathPrefix = options.pathPrefix;
    options = null;
    return {
        "readable": createReadable,
    };
    function createReadable(){
        try{
            // Evaluation of apiName simply copy-pasted from 2ndGen path generator.
            const rootClassName = JavaGen.classOf((openApi.info || {}).title || '');
            const paths = (openApi.paths || {});
            const rootNode = transformPathsToTree( paths );
            throwIfTreeWouldProduceNameConflict( rootNode );
            const firstNodeAfterBasePath = shiftAwayBasePath( rootNode , pathPrefix );
            const fileBeginReadable = StreamUtils.streamFromString( "package "+ javaPackage +";\n\n" );
            const rootClass = createClass( rootClassName , firstNodeAfterBasePath , pathPrefix );
            return StreamUtils.streamConcat([
                fileBeginReadable,
                rootClass.readable()
            ]);
        }catch( e ){
            return StreamUtils.streamFromError( e );
        }
    }
}


function throwIfPathV3GeneratorOptionsBad( options ){
    if( !options.openApi ) throw Error("Arg 'options.openApi' missing.");

    if( !options.openApi.info ) throw Error("Arg 'options.openApi.info' missing.");
    if( !options.openApi.info.title ) throw Error("Arg 'options.openApi.info.title' missing.");

    if( !options.javaPackage ) throw Error("Arg 'options.javaPackage' missing.");
    if( typeof(options.javaPackage) !== "string" ) throw Error( "Arg 'options.javaPackage' string expected but got '"+typeof(options.javaPackage)+"'" );
    if( !/^(?![0-9])(?!.*\.[0-9])[A-Za-z0-9.]+$/.test(options.javaPackage) ) throw Error( "Illegal chars in javaPackage" );

    if( !options.pathPrefix ){
        Log.debug("'options.pathPrefix' not set. Assume empty.");
        options.pathPrefix = "";
    }
}


/**
 * @param [options={}]
 * @param options.path {string}
 *      The path this resource will contain as its value.
 * @return {{readable: (function())}}
 */
function createResourceField( options ){
    if( !options ) options = {};
    if( DEBUG ){
        if( !options.path ) throw Error( "Arg 'options.path' missing." );
    }
    const path = options.path;
    options = null;
    return {
        readable: createReadable,
    };
    function createReadable(){
        const resourceField = createJavaVariable({
            access: "public",
            isStatic: true,
            isFinal: true,
            type: "String",
            name: "RESOURCE",
            value: '"'+ path +'"',
        });
        return resourceField.readable();
    }
}


function createCollectionField() {
    return {
        readable: createReadable,
    };
    function createReadable(){
        const collectionField = createJavaVariable({
            access: "public",
            isStatic: true,
            isFinal: true,
            type: "String",
            name: "COLLECTION",
            value: 'RESOURCE + "/"',
        });
        return collectionField.readable();
    }
}


/**
 * @param name {string}
 *      Name of the class to generate.
 * @param node {Map.<string,node>}
 *      The tree node to generate the class for.
 * @param pathPrefix {string}
 *      Common base of all paths. Those segments will not be available in
 *      generated classes. Instead, first available segment will be segment
 *      after that specified base.
 * @return {{readable:function(){}}
 *      An object where method 'readable' will return a new readable which
 *      will stream the generated class.
 */
function createClass( name , node , pathPrefix ){
    if( DEBUG ){
        if( !name ) throw Error("Arg 'name' expected not to be falsy");
    }

    // Extract hidden args (recursion state).
    const segmentStack = Array.isArray(arguments[3]) ? arguments[3] : [];
    /** 'null' when not based or integer offset instead. */
    const baseOffset = (!isNaN(arguments[4]) ? arguments[4] : null);

    const thisClassName = mangleNameToDifferFromEarlierEqualSegments( segmentToConstantName(name) , segmentStack.slice(0,segmentStack.length-1) );

    // Setup constructor
    const ctorReadable = StreamUtils.streamFromString( "private "+ thisClassName +"(){}\n" );

    // Setup constants.
    // 'slice' only when offset is required (baseOffset not null).
    const resourceFieldPath = (isNaN(baseOffset)?segmentStack:segmentStack.slice(baseOffset)).join('/');
    var resourceField;
    var collectionField;
    if( resourceFieldPath === '' ){
        // Don't generate them if they would be empty.
        resourceField = collectionField = {
            readable: StreamUtils.emptyStream.bind(0),
        };
    }else{
        resourceField = createResourceField({
            path: "/"+ resourceFieldPath,
        });
        collectionField = createCollectionField();
    }

    // Setup BASED class in case we're not already based.
    var basedClass;
    if( baseOffset === null ){
        // Not based yet. Enter BASED now.
        const bodyForBased = [];
        Object.keys( node ).forEach(function( segment ){
            const childClass = createClass( segment , node[segment] , pathPrefix , segmentStack.concat([segment]) , segmentStack.length ); // Go recursive here.
            bodyForBased.push( childClass );
        });
        basedClass = createJavaCustomType({
            name: "BASED",
            isStatic: true,
            isFinal: true,
            bodyReadable: StreamUtils.streamConcat( bodyForBased.map(e=>e.readable()) ),
        });
    }else{
        // Already based. Don't generate nested 'BASED' classes.
        basedClass = {
            readable: StreamUtils.emptyStream.bind(0),
        };
    }

    // Setup child classes.
    const childClassReadables = [];
    Object.keys( node ).forEach(function( segment ){
        const childClass = createClass( segment , node[segment] , pathPrefix , segmentStack.concat([segment]) , baseOffset ); // Go recursive here.
        childClassReadables.push( childClass.readable() );
    });

    // Compose this class from above parts.
    const thisClass = createJavaCustomType({
        name: thisClassName,
        isStatic: segmentStack.length > 0,
        isFinal: true,
        bodyReadable: StreamUtils.streamConcat([
            ctorReadable,
            resourceField.readable(),
            collectionField.readable(),
            StreamUtils.streamConcat( childClassReadables ),
            basedClass.readable(),
        ]),
    });
    return thisClass;
}


/**
 * <p>Creates a custom java type (class, interface, ...)</p>
 *
 * @param options.name {string}
 *      Name of the type.
 * @param [options.access=public] {string}
 *      Access modifier for type to geenrate. One of '', 'public', 'protected',
 *      'private'.
 * @param [options.isStatic=false] {boolean}
 * @param [options.isFinal=false] {boolean}
 * @param [options.type=class] {string}
 *      Either 'class', 'interface' or 'enum'.
 * @param [options.isAbstract=false] {boolean}
 * @param [options.bodyReadable=null] {Readable}
 *      If falsy, body of type will be empty.
 * @return {object}
 *      obj.readable(void) - Returns new readable which will stream that
 *          instance in serialized form.
 */
function createJavaCustomType( options ){
    if( !options ) options = {};
    if( DEBUG ){ // Validate args.
        if( !options.name ){ throw Error( "Arg 'options.name' missing." ); }
        if( typeof(options.bodyReadable)==="undefined" ) throw Error( "Arg 'options.bodyReadable' missing." );
        if( options.type && ["class","interface","enum"].indexOf(options.type) === -1 ) throw Error("Illegal type '"+ options.type +"'.");
        if( options.access && ["","public","protected","private"].indexOf(options.access) === -1 ) throw Error("Arg 'options.access': Illegal value '"+ options.access +"'.");
    }
    const access = (options.access ? options.access : "public");
    const isStatic = !!options.isStatic;
    const isFinal = !!options.isFinal;
    const type = options.type || "class";
    const isAbstract = !!options.isAbstract;
    const typeName = options.name;
    const bodyReadable = options.bodyReadable;
    options = null;

    const indent = "    ";
    return {
        readable: createReadable,
    };
    function createReadable(){
        const that = new Stream.Readable({ read:noop });
        // Start of type.
        that.push( access ); // TODO: Prevent space in case 'access' is empty (package private).
        if( isStatic ){ that.push(" static"); }
        if( isFinal ){ that.push(" final"); }
        if( isAbstract ){ that.push(" abstract"); }
        that.push( " "+ type +" "+ typeName +" {\n" );
        // Inject body from passed in stream.
        if( bodyReadable ){
            bodyReadable
                // Use filter to indent body.
                .pipe( StreamUtils.createLinePrefixStream({ prefix:indent }) )
                .on( "data" , that.push.bind(that) )
                .on( "error" , that.emit.bind(that,"error") )
                .on( "end" , onBodyWritten )
            ;
        }else{
            onBodyWritten();
        }
        function onBodyWritten(){
            // End of type and end of our stream.
            that.push( "}\n" );
            that.push( null );
        }
        return that;
    }
}


/**
 * @param options.type {string}
 *      Type of the variable.
 * @param options.name {string}
 *      Name for the variable.
 * @param [options.access=""] {""|"public"|"protected"|"private"}
 * @param [options.isStatic=false] {boolean}
 * @param [options.isFinal=false] {boolean}
 * @param [options.value=null] {string}
 *      Value to assign to the variable. If falsy, no assignment is generated.
 */
function createJavaVariable( options ) {
    if( DEBUG ){ // Check args.
        if( options.access && ["","public","protected","private"].indexOf(options.access)===-1 ){ debugger; throw Error( "Illegal access modifier '"+options.access+"'." ); }
        if( !/^[A-Za-z0-9_$][A-Za-z0-9_$]*$/.test(options.type) ) throw Error("Illegal type '"+options.type+"'");
    }
    const access = options.access ? options.access : "";
    const isStatic = !!options.isStatic;
    const isFinal = !!options.isFinal;
    const type = options.type;
    const name = options.name;
    const value = options.value;
    options = null;

    return {
        readable: createReadable
    };
    function createReadable(){
        const that = new Stream.Readable({ read:noop });
        var begun = false;

        if( access.length>0 ){
            that.push( access );
            begun = true;
        }
        if( isStatic ){
            if( begun ){ that.push(" "); }
            that.push( "static" );
            begun = true;
        }
        if( isFinal ){
            if( begun ){ that.push(" "); }
            that.push( "final" );
            begun = true;
        }
        if( begun ){ that.push(" "); }
        that.push( type +" "+ name );
        if( value ){
            that.push( " = "+ value );
        }
        that.push( ";\n" );
        that.push( null );
        return that;
    }
}


/**
 * @param paths {Map<String,any>}
 *		The paths to transform. Actually this methods uses the keys of the
 *		passed map as paths.
 * @return {Map<string,Map<any>>}
 *		A tree representing the passed in paths.
 * @throws Error
 *      In case there's something wrong with slashes. Eg: leading slash
 *      missing.
 */
function transformPathsToTree( paths ){
    const segments2d = splitAllPathsToArrays( paths );
    // Drop leading segment and ensure it was empty.
    for( var i=0 ; i<segments2d.length ; ++i ){
        const firstSegment = segments2d[i].splice(0,1)[0];
        if( firstSegment !== "" ){
            throw Error( "Leading slash missing on path '"+firstSegment+'/'+segments2d[i].join('/')+"'" );
        }
    }
    const rootNode = arrange2dSegmentsAsTree( segments2d );
    return rootNode;
}


/**
 * @param node
 *      The node to shift from.
 * @param pathPrefix {string}
 *      Path to remove from specified rootNode.
 * @return
 *      Node representing latest segment present in specified pathPrefix.
 * @throws Error
 *      In case there is a path which doesn't fit into path-prefix.
 */
function shiftAwayBasePath( node , pathPrefix ){
    pathPrefix = UrlUtils.dropSurroundingSlashes( pathPrefix );
    const segmentStack = [];
    if( !pathPrefix || pathPrefix.length === 0 ){
        return node;
    }
    pathPrefix = pathPrefix.split('/');
    for( let i=0 ; i<pathPrefix.length ; ++i ){
        const key = pathPrefix[i];
        const actualKeys = Object.keys( node );
        if( actualKeys.length > 1 ){
            // Collect data for error msg.
            var badKey = null;
            for( let i=0 ; i<actualKeys.length ; ++i ){
                if( actualKeys[i] !== key ){
                    badKey = actualKeys[i];
                    break;
                }
            }
            var fullPath = '/'+ segmentStack.join('/');
            if( !fullPath.endsWith('/') ){ fullPath+='/'; }
            fullPath += badKey;
            for( let x=node[badKey],subKey ; subKey=Object.keys(x)[0] ; x=x[subKey] ){
                fullPath += '/'+ subKey;
            }
            throw Error( "Path '"+fullPath+"' doesn't fit into path-prefix '/"+pathPrefix.join('/')+"/'" );
        }else if( actualKeys[0] !== key ){
            // TODO: Provide full path (not only segment) in this error msg.
            throw Error( "Segment '"+actualKeys[0]+"' doesn't fit into pathPrefix" );
        }
        segmentStack.push( key );
        node = node[key]; // Shift down one step.
    }
    return node;
}


/**
 * <p>Takes an array of paths and splits them all to segments.</p>
 *
 * @param paths {Map<String,String>}
 * @return {Array<Array<string>>}
 */
function splitAllPathsToArrays( paths ){
    const keys = Object.keys( paths );
    if( keys.length === 0 ){
        Log.debug( "No paths specified." );
    }
    const result = [];
    for( var i=0 ; i<keys.length ; ++i ){
        result[i] = keys[i].split( "/" );
    }
    return result;
}


/**
 * @param paths {Array<Array<string>>}
 *      Array of array of path-segments to transform into a tree.
 * @return {Map<Map<...>>}
 *      Nested objects where the property names represent a path segment. Aka
 *      tree structure.
 */
function arrange2dSegmentsAsTree( paths ){
    const rootNode = {};
    for( let i=0 ; i<paths.length ; ++i ){
        mergeArrayIntoTree( rootNode , paths[i] );
    }
    return rootNode;
    function mergeArrayIntoTree( node , arr ) {
        for( let i=0 ; i<arr.length ; ++i ){
            const segment = arr[i];
            if( segment==="" ){
                if( i===arr.length-1 ){
                    throw Error( "Path '/"+arr.join('/')+"' MUST NOT end with an empty segment (aka slash at end)." );
                }else{
                    throw Error( "Path '/"+arr.join('/')+"' MUST NOT contain empty path segments (aka double slashes)." );
                }
            }
            if( !node[segment] ){
                node[segment] = {};
            }
            // Shift iterator down one step.
            node = node[segment];
        }
    }
}


/**
 * @param segment {string}
 *      Path segment.
 * @return {string}
 *      Java identifier for specified path segment.
 */
function segmentToConstantName( segment ) {
    var ans;
    if( pathSegmentIsVariable(segment) ){
        // Drop surrounding curly braces.
        ans = segment.substr( 1 , segment.length-2 );
        // Add a dollar sign
        ans += '$';
    }else{
        // Use segment as is.
        ans = segment;
    }
    ans = escapeForJavaIdentifier( ans );
    return ans;
}


/**
 * <p>This will append an underscore to specified className everytime className
 * already is used earlier to prevent name conflicts.</p>
 *
 * @param className {string}
 *      The identifier we want to use as our class name.
 * @param segmentStack {Array<string>}
 *      Segments, which are in path before our current segment.
 * @return {string}
 *      The mangled className.
 */
function mangleNameToDifferFromEarlierEqualSegments( className , segmentStack ){
    let suffix = "";
    for( let i=0,iLen=segmentStack.length ; i<iLen ; ++i ){
        if( segmentToConstantName(segmentStack[i]) === className ){
            // Append one more
            suffix += '_';
        }
    }
    if( suffix.length > 0 ){
        className += suffix;
    }
    return className;
}


function pathSegmentIsVariable( segment ) {
    return /^{.*}$/.test( segment );
}


/**
 * @param str {string}
 *      The value to escape.
 * @return {string}
 *      Passed in value where all special chars are replaced by an underscore
 *      char. Also reserved words will get a leading underscore to prevent name
 *      problems.
 */
function escapeForJavaIdentifier( str ){
    if( DEBUG ){
        if( typeof(str)!=="string" ){ debugger; throw Error("Arg 'str' expected to be string."); }
    }
    // Copied from "https://www.thoughtco.com/reserved-words-in-java-2034200".
    const reservedWords = [
        "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char",
        "class", "const", "continue", "default", "double", "do", "else", "enum",
        "extends", "false", "final", "finally", "float", "for", "goto", "if",
        "implements", "import", "instanceof", "int", "interface", "long", "native",
        "new", "null", "package", "private", "protected", "public", "return",
        "short", "static", "strictfp", "super", "switch", "synchronized", "this",
        "throw", "throws", "transient", "true", "try", "void", "volatile", "while"
    ];
    // Replace every char thats not inside A-Z, a-z, 0-9 underscore or dollar
    // sign. (Yes: There are several more valid chars we shouldn't replace. But
    // its much simpler to quick-n-dirty replace these too)
    str = str.replace( /(^[0-9]|[^A-Za-z0-9_$])/g , '_' );
    if( reservedWords.indexOf(str) !== -1 ){
        str = '_'+ str;
    }
    return str;
}

/**
 * @param node
 *      The tree node to validate. This is a tree simply consisting of nested Maps.
 * @throws {Error}
 *      In case tree would produce name collisions when generated.
 */
function throwIfTreeWouldProduceNameConflict( node ){
    const segmentStack = arguments[1] ? arguments[1] : [];
    const keys = Object.keys( node );
    const rawNamesOnThisLayer = [];
    const namesOnThisLayer = [];
    for( let i=0 ; i<keys.length ; ++i ){
        const key = keys[i];
        const child = node[key];
        const childName = segmentToConstantName( key );
        throwIfTreeWouldProduceNameConflict( child , segmentStack.concat([childName]) ); // Traverse recursively.
        const idx = namesOnThisLayer.indexOf(childName);
        if( idx !== -1 ){
            // Name already seen earlier.
            throw Error( "Path segment '"+key+"' collides with '"+rawNamesOnThisLayer[idx]+"'. Both of them would result in '/"+segmentStack.concat([childName]).join('/')+"'." );
        }else{
            // Name not used yet
            rawNamesOnThisLayer.push( key );
            namesOnThisLayer.push( childName );
        }
    }
}
