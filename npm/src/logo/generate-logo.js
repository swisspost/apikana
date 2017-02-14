//take apikana.png to http://www.text-image.com/convert/
//copy the result to input.txt
//run generate-logo.js

fs = require('fs');

var input = fs.readFileSync('input.txt').toString();
var out = 'var chalk=require("chalk"), black=chalk.black, gray=chalk.gray, white=chalk.white; yellow=chalk.yellow; red=chalk.red; \nconsole.log(';
var r, last = null;
while (input.length > 0) {
    if (r = /^<font color="(.*?)">(.*?)<\/font>/.exec(input)) {
        var color;
        if (r[1].charAt(0) === '#') {
            color = parseInt(r[1].substring(1, 3), 16);
        } else if (r[1] === 'white') {
            color = '255';
        } else if (r[1] === 'gray') {
            color = '128';
        } else {
            console.log('color name ' + r[1]);
        }
        if (color < 120) {
            color = 'white';
        } else if (color < 200) {
            color = 'gray';
        } else {
            color = 'black';
        }
        if (color !== last) {
            if (last !== null) {
                out += '")+';
            }
            out += color + '("' + r[2];
        } else {
            out += r[2];
        }
        last = color;
    }
    else if (r = /^<br>/.exec(input)) {
        last = null;
        out += '"));\nconsole.log(';
    } else {
        console.log('unknown start ' + input);
        return;
    }
    input = input.substring(r[0].length);
}

out = out.replace(/black\("(.*?)"\)/g, function (m, d) {
    var s = '';
    while (s.length < d.length)s += ' ';
    return '"' + s + '"';
});
fs.writeFileSync('generated-logo.js', out + ');');
    