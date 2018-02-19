var reservedWords = [
    'abstract', 'continue', 'for', 'new', 'switch',
    'assert', 'default', 'goto', 'package', 'synchronized',
    'boolean', 'do', 'if', 'private', 'this',
    'break', 'double', 'implements', 'protected', 'throw',
    'byte', 'else', 'import', 'public', 'throws',
    'case', 'enum', 'instanceof', 'return', 'transient',
    'catch', 'extends', 'int', 'short', 'try',
    'char', 'final', 'interface', 'static', 'void',
    'class', 'finally', 'long', 'strictfp', 'volatile',
    'const', 'float', 'native', 'super', 'while'];
var reserved = {};
for (var i = 0; i < reservedWords.length; i++) {
    reserved[reservedWords[i]] = true;
}

module.exports = {
    constOf: constOf,
    classOf: classOf,
    fieldOf: fieldOf,
    javaType: javaType,
    pad: pad
};

function constOf(name) {
    var res = '';
    for (var i = 0; i < name.length; i++) {
        res += name.charAt(i).toUpperCase();
        if (i < name.length - 1 && !isUpper(name.charAt(i)) && isUpper(name.charAt(i + 1))) {
            res += '_';
        }
    }
    return res;

    function isUpper(c) {
        return c >= 'A' && c <= 'Z';
    }
}

function classOf(name) {
    var java = javaOf(name);
    return java.substring(0, 1).toUpperCase() + java.substring(1);
}


function fieldOf(name) {
    var java = javaOf(name);
    var lower = java.substring(0, 1).toLowerCase() + java.substring(1);
    return reserved[lower] ? lower + '_' : lower;
}

function javaOf(name) {
    var s = '';
    var removed = false;
    for (var i = 0; i < name.length; i++) {
        var c = name.charAt(i);
        if ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')) {
            s += removed ? c.toUpperCase() : c;
            removed = false;
        } else {
            removed = true;
        }
    }
    return s;
}

function javaType(type) {
    switch (type) {
        case 'number':
            return 'double';
        case 'integer':
            return 'int';
        case 'boolean':
            return 'boolean';
        default:
            return 'String';
    }
}

function pad(n) {
    var s = '';
    while (s.length < 4 * n) {
        s += ' ';
    }
    return s;
}
