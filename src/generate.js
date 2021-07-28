var gulp = require('gulp');
var rename = require('gulp-rename');
var inject = require('gulp-inject');
var jeditor = require("gulp-json-editor");
var File = require('vinyl');
var colors = require('ansi-colors');
var log = require('./log');
var replace = require('gulp-replace');
var path = require('path');
var fs = require('fs');
var traverse = require('traverse');
var stream = require('stream');
var merge = require('merge-stream');
var through = require('through2');
var yaml = require('yamljs');
var params = require('./params');
var generateEnv = require('./generate-env');
var fse = require('fs-extra');
const Stream = require('stream');
const StreamUtils = require('./util/stream-utils');
const PathV3Generator = require('./path-v3-generator/path-v3-generator');
const JavaGen = require('./java-gen');
const {JSONPath} = require('jsonpath-plus');
const jsonSchemaAvro = require('./generate-avro');

module.exports = {
    generate: function (source, dest, done) {
        var uiPath = path.resolve(dest, 'ui');
        var apikanaPath = path.resolve(__dirname, '..');
        var privateModules = path.resolve(apikanaPath, 'node_modules');
        var modulesPath = fs.existsSync(privateModules) ? privateModules : path.resolve('node_modules');
        var dependencyPath = path.resolve(params.dependencyPath());

        var apiFile = path.resolve(source, params.api());
        if (!fs.existsSync(apiFile)) {
            log.info('API file ', colors.magenta(source + '/' + params.api()), 'not found, generating one.');
            var apiDir = path.dirname(apiFile);
            var api = {
                swagger: '2.0',
                info: {title: path.basename(path.resolve('')), version: '1.0'},
                paths: [],
                definitions: {$ref: readdir(path.resolve(source, params.models()), apiDir)}
            };
            fse.mkdirsSync(apiDir);
            fs.writeFileSync(apiFile, yaml.stringify(api, 6, 2));
        }

        function readdir(basedir, relativeTo) {
            var res = [];
            readdir(basedir, res);
            return res;

            function readdir(dir, res) {
                var files = fs.readdirSync(dir);
                for (var i = 0; i < files.length; i++) {
                    var name = path.resolve(dir, files[i]);
                    if (fs.statSync(name).isDirectory()) {
                        readdir(name, res);
                    } else if (endsWith(files[i], '.ts')) {
                        res.push(path.relative(relativeTo, name).replace(/\\/g, '/'));
                    }
                }
            }

            function endsWith(s, sub) {
                return s.substring(s.length - sub.length) === sub;
            }
        }

        function nonEmptyDir(path) {
            return fs.existsSync(path) && fs.readdirSync(path).length > 0;
        }

        function module(pattern) {
            return gulp.src(resolve(pattern));
        }

        function resolve(pattern) {
            return Array.isArray(pattern) ? pattern.map(doResolve) : doResolve(pattern);

            function doResolve(p) {
                return path.resolve(modulesPath, p);
            }
        }

        function task(name, deps, func) {
            if (!func) {
                func = deps;
                deps = [];
            }
            gulp.task(name, deps, function () {
                var first;
                var result = func();
                if(result.on) {
                    result
                        .on('readable', function () {
                            if (!first) {
                                first = Date.now();
                            }
                        })
                        .on('finish', function () {
                            log.info('Done', colors.green(name), 'in', first ? (Date.now() - first) / 1000 : '?', 's');
                        })
                        .on('error', function (err) {
                            log.error('Error in', colors.green(name), colors.red(err));
                        });
                }
                if(result.then) {
                    first = Date.now();
                    return result.then(
                        function () {
                            log.info('Done', colors.green(name), 'in', first ? (Date.now() - first) / 1000 : '?', 's');
                        },
                        function (err) {
                            log.error('Error in', colors.green(name), colors.red(err));
                        });
                }
                return result;
            });
        }

        task('cleanup-dist', function() {
            fse.removeSync('dist');
            return emptyStream();
        });

        task('copy-samples', ['cleanup-dist'], function() {
            if(fs.existsSync(path.join(source, 'samples'))) {
                gulp.src('samples/**', {cwd: source}).pipe(jeditor(json => {
                    if(typeof(json)=='object' && '$schema' in json) {
                        delete json['$schema'];
                    }
                    return json;
                })).pipe(gulp.dest('samples', {cwd: dest}));
            }
            return emptyStream();
        });

        task('copy-swagger', ['cleanup-dist'], function () {
            return module('swagger-ui/dist/**').pipe(gulp.dest(uiPath));
        });

        task('copy-custom', ['copy-swagger'], function () {
            return merge(
                copy(path.resolve(dependencyPath, 'style')),
                copy(path.resolve(source, params.style())));

            function copy(dir) {
                return merge(
                    gulp.src('**/*', {cwd: dir}).pipe(gulp.dest('style', {cwd: uiPath})),
                    gulp.src('favicon*', {cwd: dir}).pipe(gulp.dest('images', {cwd: uiPath})));
            }
        });

        task('copy-package', ['cleanup-dist'], function () {
            var source = fs.existsSync('package.json')
                ? gulp.src('package.json')
                : streamFromString('{}');

            return generateEnv.generate(source, gulp.dest('patch', {cwd: uiPath}));
        });

        function streamFromString(s) {
            var src = new stream.Readable({objectMode: true});
            src._read = function () {
                this.push(new File({path: '.', contents: new Buffer(s)}));
                this.push(null);
            };
            return src;
        }

        task('copy-deps', ['cleanup-dist'], function () {
            return merge(
                module(['yamljs/dist/yaml.js']).pipe(gulp.dest('patch', {cwd: uiPath})),
                module(['object-path/index.js'])
                    .pipe(rename('object-path.js'))
                    .pipe(gulp.dest('patch', {cwd: uiPath})),
                gulp.src('src/deps/*.js', {cwd: apikanaPath}).pipe(gulp.dest('patch', {cwd: uiPath})),
                gulp.src('src/root/*.js', {cwd: apikanaPath}).pipe(gulp.dest(uiPath)));
        });

        task('copy-lib', ['cleanup-dist'], function () {
            return gulp.src('lib/*.js', {cwd: apikanaPath}).pipe(gulp.dest('patch', {cwd: uiPath}));
        });

        task('inject-css', ['copy-swagger', 'copy-custom', 'copy-deps', 'copy-lib'], function () {
            return gulp.src('index.html', {cwd: uiPath})
                .pipe(inject(gulp.src('style/**/*.css', {cwd: uiPath, read: false}), {
                    relative: true,
                    starttag: "<link href='css/print.css' media='print' rel='stylesheet' type='text/css'/>",
                    endtag: '<'
                }))
                .pipe(inject(gulp.src(['helper.js', 'browserify.js', 'object-path.js', 'variables.js', 'yaml.js'], {
                    cwd: uiPath + '/patch',
                    read: false
                }), {
                    relative: true,
                    starttag: "<script src='lib/swagger-oauth.js' type='text/javascript'></script>",
                    endtag: '<'
                }))
                .pipe(replace('&nbsp;</div>', 'Loading...</div>'))
                .pipe(replace('url: url,', 'url:"", spec:spec, validatorUrl:null,'))
                .pipe(replace('onComplete: function(swaggerApi, swaggerUi){', 'onComplete: function(swaggerApi, swaggerUi){ renderDocson();'))
                .pipe(gulp.dest(uiPath));
        });

        task('copy-deps-unref', ['cleanup-dist'], function () {
            return module(['typescript/lib/lib.d.ts']).pipe(gulp.dest('patch', {cwd: uiPath}));
        });

        var restApi, modelFiles = [];
        var modelNames = [];
        task('read-rest-api', ['copy-package'], function () {
            if (restApi) {
                return emptyStream();
            }
            return gulp.src(params.api(), {cwd: source})
                .pipe(through.obj(function (file, enc, cb) {
                    var raw = file.contents.toString();
                    restApi = file.path.substring(file.path.lastIndexOf('.') + 1) === 'yaml'
                        ? yaml.parse(raw) : JSON.parse(raw);
                    restApi.info.version = generateEnv.variables().version;
                    var ref = restApi.definitions && restApi.definitions.$ref;
                    if (ref) {
                        var refBase = path.dirname(path.resolve(source, params.api()));
                        var refs = Array.isArray(ref) ? ref : [ref];
                        for (var i = 0; i < refs.length; i++) {
                            var parts = refs[i].split(/[,\n]/);
                            for (var j = 0; j < parts.length; j++) {
                                var model = parts[j].trim();
                                if (model) {
                                    var modelFile = path.resolve(refBase, model);
                                    if (!fs.existsSync(modelFile)) {
                                        log.error(colors.red('Referenced model file ' + modelFile + ' does not exist.'));
                                    } else {
                                        modelFiles.push(modelFile);
                                    }
                                }
                            }
                        }
                    }
                    JSONPath({path:'$.paths..schema.$ref', json: restApi, callback: (data) => {
                        modelNames.push(data.replace('#/definitions/', ''));
                    }});
                    if (modelFiles.length > 0) {
                        params.models(path.dirname(modelFiles[0]));
                    }
                    cb();
                }));
        });

        task('generate-schema', ['copy-ts-deps', 'generate-tsconfig', 'copy-package', 'read-rest-api'], function () {
            var collector = emptyStream();
            if (modelFiles.length === 0) {
                if (fs.existsSync(path.resolve(source, params.models()))) {
                    collector = gulp.src(params.models() + '/**/*.ts', {cwd: source, base: './ts/'})
                        .pipe(through.obj(function (file, enc, cb) {
                            modelFiles.push(file.path);
                            cb();
                        }));
                } else {
                    log.warn(colors.red('Model directory ' + source + '/' + params.models() + ' does not exist.'));
                    require('./generate-schema').mkdirs(dest);
                    return emptyStream();
                }
            }
            return collector.on('finish', function () {
                var tsconfig = path.resolve(source, params.models(), 'tsconfig.json');
                require('./generate-schema').generate(tsconfig, modelFiles, modelNames, dest, params.dependencyPath());
            });
        });

        task('generate-constants', ['cleanup-dist', 'read-rest-api'], function () {
            if (restApi.paths == null || restApi.paths.length === 0) {
                return emptyStream();
            }
            const generate1stGenPaths = params.generate1stGenPaths();
            const generate2ndGenPaths = params.generate2ndGenPaths();
            log.info( "1st generation paths are "+(generate1stGenPaths?"\x1b[1;35menabled ":"\x1b[35mdisabled")+"\x1b[0m (--generate1stGenPaths="+generate1stGenPaths+")." );
            log.info( "2nd generation paths are "+(generate2ndGenPaths?"\x1b[1;35menabled ":"\x1b[35mdisabled")+"\x1b[0m (--generate2ndGenPaths="+generate2ndGenPaths+")." );
            return require('./generate-constants').generate(
                gulp.src(params.api(), {cwd: source}),
                gulp.dest('model', {cwd: dest}),
                { generate1stGenPaths:generate1stGenPaths , generate2ndGenPaths:generate2ndGenPaths }
            );
        });

        task('generate-3rdGen-constants', ['copy-src','read-rest-api'], function(){
            const generate3rdGenPaths = params.generate3rdGenPaths();
            const gulpOStream = gulp.dest( "model/" , {cwd: dest});
            log.info( "3rd generation paths are "+(generate3rdGenPaths?"\x1b[1;35menabled ":"\x1b[35mdisabled")+"\x1b[0m (--generate3rdGenPaths="+generate3rdGenPaths+")." );
            if( !generate3rdGenPaths ){
                return StreamUtils.emptyStream().pipe( gulpOStream );
            }
            const javaPackage = params.javaPackage() +".path";
            // Below evaluation copied from 2ndGen Generator.
            const apiName = ((restApi.info || {}).title || '');
            const outputFilePath = 'java/' + javaPackage.replace(/\./g, '/') + '/' + JavaGen.classOf(apiName) + '.java';
            // Seems vinyls 'File' isn't designed for streaming. Therefore we'll collect
            // our generated code here and pass it as one huge chunk (aka vinyl File) to
            // make our dependencies happy.
            const collectWholeFileStream = new Stream.Readable({ objectMode:true , read:function(){
                if( this._isRunning ){ return; }else{ this._isRunning=true; } // <-- Make sure to fire only once.
                const contentBuffers = [];
                // Instantiate a generator.
                PathV3Generator.createPathV3Generator({
                        openApi:     restApi,
                        javaPackage: javaPackage,
                        pathPrefix:  params.pathPrefix(),
                    })
                    .readable()
                    // Append received chunks to our collection.
                    .on( "data" , contentBuffers.push.bind(contentBuffers) )
                    // Continue below as soon all chunks are collected.
                    .on( "end" , whenFileCollected )
                ;
                function whenFileCollected(){
                    // Pack all the collected file content into one buffer and wrap that within a
                    // vinyl File.
                    collectWholeFileStream.push(new File({
                        path: outputFilePath,
                        contents: Buffer.concat(contentBuffers)
                    }));
                    // EOF: Signalize that was the last chunk in this stream.
                    collectWholeFileStream.push( null );
                }
            }});
            collectWholeFileStream.pipe( gulpOStream );
            return gulpOStream;
        });

        task('copy-src', ['cleanup-dist'], function () {
            if (!params.deploy()) {
                return emptyStream();
            }
            return gulp.src('**/*', {cwd: source}).pipe(gulp.dest('src', {cwd: uiPath}));
        });

        // copy local defined models to dist directory keeping the local folder structure.
        task('copy-ts-model', ['cleanup-dist', 'read-rest-api'], function () {
            let sourcePaths;
            let sourceOptions;
            let destination;
            const defaultPath = path.join(source, 'ts');
            if (fs.existsSync(defaultPath)) {
                log.debug('Copying ts models from (default) ', colors.magenta(defaultPath));
                sourcePaths = [defaultPath + '/**/*.ts'];
                sourceOptions = {base: source}
                destination = gulp.dest('model', {cwd: dest});
            } else {
                log.debug('Copying ts models from (arg) ', colors.magenta(params.models()));
                sourcePaths = [params.models() + '/**/*.ts'];
                sourceOptions = {cwd: source};
                destination = gulp.dest(path.join('model', 'ts'), {cwd: dest});
            }

            return gulp.src(sourcePaths, sourceOptions)
                .pipe(destination);
        });

        // copy unpacked dependencies to node_modules in dist directory so it is possible to re-use the objects.
        task('copy-ts-deps', ['unpack-models'], function() {
            return merge(
                    gulp.src([params.dependencyPath()+'/**/*.ts'], {base: params.dependencyPath()})
                        .pipe(gulp.dest(path.join('model', 'ts', 'node_modules'), {cwd: dest})),
                    gulp.src([params.dependencyPath()+'/**/*.ts'], {base: path.join(params.dependencyPath(), 'ts')})
                        .pipe(gulp.dest(path.join('model', 'ts', 'node_modules'), {cwd: dest}))
                    );
        });

        // unpack dependencies under -api-dependencies/ts keeping the original folder structure.
        // NOTE: the 'ts' subdirectory is important because the front-end only understands dependencies under /ts/ dir.
        // apikana-defaults.ts is a special case. This file has to be copied also under node_modules/apikana/ directory.
        task('unpack-models', ['cleanup-dist'], function () {
            return merge(
                unpack('dist/model', 'json-schema-v3', '**/*.json'),
                unpack('dist/model', 'json-schema-v4', '**/*.json'),
                unpack('dist/ui', 'style', '**/*', true),
                unpack('dist/model', 'ts', '**/*.ts'),
                gulp.src('src/model/ts/**/*.ts', {cwd: apikanaPath})
                    .pipe(gulp.dest(path.join('ts','apikana'), {cwd: dependencyPath})),
                // apikana-defaults.ts is a special case. This file has to be copied also under node_modules/apikana/ directory.
                gulp.src('src/model/ts/**/*.ts', {cwd: apikanaPath})
                    .pipe(gulp.dest('apikana', {cwd: path.join(dependencyPath, '..')}))
            );
        });

        // copies files keeping the original structure. -api-dependencies is ignored because is the target (paste) directory.
        // target of all dependencies is -api-dependencies/ts directory!
        function unpack(baseDir, subDir, pattern, absolute) {
            return gulp.src(['!./**/-api-dependencies/**/*', './**/node_modules/**/' + baseDir + '/' + subDir + '/' + pattern], {base: 'node_modules'})
                .pipe(replace('node_modules/-api-dependencies/ts', '../..')) // So that transitive dependencies work when generating code
                .pipe(gulp.dest(path.join(params.dependencyPath(), 'ts')));
        }

        // TODO why should a dependency overwrite a local definition?
        // TODO why must schemas with same name be equal? We have a proper dependency handling.
        // task('overwrite-schemas', ['generate-schema'], function () {
        //overwrite local schemas with dependency schemas
        //- javaType could be different
        //- verify that schemas with same names are structurally equal (no redefinition allowed)
        // return merge(
        //     gulp.src('json-schema-v3/**/*.json', {cwd: dependencyPath})
        //         .pipe(through.obj(function (file, enc, cb) {
        //             var filename = path.parse(file.path);
        //             var existing = path.resolve(dest, 'model/json-schema-v3', filename.base);
        //             if (fs.existsSync(existing)) {
        //                 var schema1 = JSON.parse(fs.readFileSync(existing));
        //                 var schema2 = JSON.parse(file.contents.toString());
        //                 if (!schemaEquals(schema1, schema2)) {
        //                     log(colors.red('Type'), colors.magenta(filename.name),
        //                         colors.red('is defined differently in'),
        //                         colors.magenta(schema1.definedIn, '(', path.relative(source, existing), ')'),
        //                         colors.red('and in'),
        //                         colors.magenta(schema2.definedIn, '(', path.relative(source, file.path), ')'));
        //                     throw new gutil.PluginError('apikana', 'multi definition');
        //                 }
        //             }
        //             this.push(file);
        //             cb();
        //         }))
        //         .pipe(rename(function (path) {
        //             path.dirname = '';
        //             return path;
        //         }))
        //         .pipe(gulp.dest('model/json-schema-v3', {cwd: dest})),
        //     gulp.src('json-schema-v4/**/*.json', {cwd: dependencyPath})
        //         .pipe(rename(function (path) {
        //             path.dirname = '';
        //             return path;
        //         }))
        //         .pipe(gulp.dest('model/json-schema-v4', {cwd: dest})));
        // });

        // function schemaEquals(s1, s2) {
        //     if (Object.keys(s1).length !== Object.keys(s2).length) {
        //         return false;
        //     }
        //     for (var p in s1) {
        //         if (/*p === 'definedIn' ||*/ p === 'javaType') {
        //             continue;
        //         }
        //         var val1 = s1[p];
        //         var val2 = s2[p];
        //         if (typeof val1 === 'object' && val1 != null && val2 != null) {
        //             if (!schemaEquals(val1, val2)) {
        //                 return false;
        //             }
        //         } else if (val1 !== val2) {
        //             return false;
        //         }
        //     }
        //     return true;
        // }

        task('generate-tsconfig', ['cleanup-dist','read-rest-api'], function () {
            if (!fs.existsSync(path.resolve(source, params.models()))) {
                return emptyStream();
            }
            var tsconfig = path.resolve(source, params.models(), 'tsconfig.json');
            if (!fs.existsSync(tsconfig)) {
                fs.writeFileSync(tsconfig, '{}');
            }
            return gulp.src(tsconfig)
                .pipe(through.obj(function (file, enc, cb) {
                    var config;
                    try {
                        config = JSON.parse(file.contents);
                    } catch (e) {
                        config = {};
                    }
                    var co = config.compilerOptions;
                    if (!co) {
                        co = config.compilerOptions = {};
                    }
                    var configDir = path.dirname(file.path);
                    co.baseUrl = path.relative(configDir, dependencyPath + '/ts').replace(/\\/g, '/');
                    this.push(new File({
                        path: file.path,
                        contents: new Buffer(JSON.stringify(config, null, 2))
                    }));
                    cb();
                }))
                .pipe(gulp.dest(''));
        });

        var completeApi;
        var fileToType;

        //TODO same problem as in generate-schema: if there are schemas with the same name from different dependencies,
        //we need structural comparision
        task('prepare-complete-api', ['read-rest-api', 'generate-schema'/*, 'overwrite-schemas'*/], function () {
            completeApi = Object.assign({}, restApi);
            completeApi.definitions = {};
            delete completeApi.definitions.$ref;
            fileToType = {};
            return gulp.src([ dest+'/model/json-schema-v4/**/*.json', dependencyPath+'/**/json-schema-v4/**/*.json'])
                .pipe(through.obj(function (file, enc, cb) {
                    var schema = JSON.parse(file.contents.toString());
                    fileToType[path.parse(file.path).base] = schema.id;
                    Object.assign(completeApi.definitions, schema.definitions);
                    delete schema.definitions;
                    delete schema.$schema;
                    delete schema.javaType;
                    delete schema.javaInterfaces;
                    delete schema.dotnetNamespace;
                    completeApi.definitions[schema.id] = schema;
                    cb();
                }))
        });

        task('generate-full-rest', ['prepare-complete-api'], function () {
            traverse.forEach(completeApi, function (value) {
                if (this.key === '$ref' && !value.startsWith("#/definitions")) {
                    var type = fileToType[path.parse(value).base];
                    this.update('#/definitions/' + type);
                }
            });

            var cleanRestApi = obj = JSON.parse(JSON.stringify(restApi));
            var cleanCompleteApi = obj = JSON.parse(JSON.stringify(completeApi));

            var promises = modelNames
                .map(modelName => ({ modelName, schema: Object.assign({}, completeApi.definitions[modelName])}))
                .filter(model => model.schema.type == "object")
                .map(model => {
                    var fullSchema = Object.assign({}, model.schema);
                    fullSchema.$schema = 'http://json-schema.org/draft-04/schema#',
                    fullSchema.definitions = resolveDefinitions(fullSchema.properties, completeApi.definitions)
                    var fileName = model.modelName.replace(/([^^])([A-Z]+)/g, '$1-$2').toLowerCase();
                    var jsonSchemaOutputDir = path.resolve(dest, 'model/json-schema-v4-full')
                    fse.mkdirsSync(jsonSchemaOutputDir);
                    fs.writeFileSync(path.resolve(jsonSchemaOutputDir, fileName + '.json'), JSON.stringify(fullSchema, 6, 2));
                    var avroOutputDir = path.resolve(dest, 'model/avro-full')
                    fse.mkdirsSync(avroOutputDir);
                    var avroConfig = generateEnv.variables().customConfig.avro;
                    return jsonSchemaAvro().convert(fullSchema, undefined, undefined, undefined, avroConfig).then(avroSchema =>
                        fs.writeFileSync(path.resolve(avroOutputDir, fileName + '.avsc'), JSON.stringify(avroSchema, 6, 2)));
                });

            return Promise.all(promises).then( () => {
                traverse.forEach(cleanCompleteApi, function (value) {
                    if(this.key === 'id' && this.parent.key === value) {
                        this.delete(this.key);
                    }
                });

                var out = path.resolve(dest, 'model/openapi');
                fse.mkdirsSync(out);
                fs.writeFileSync(path.resolve(out, 'api.json'), JSON.stringify(cleanRestApi, null, 2));
                fs.writeFileSync(path.resolve(out, 'api.yaml'), yaml.stringify(cleanRestApi, 6, 2));
                fs.writeFileSync(path.resolve(out, 'complete-api.json'), JSON.stringify(cleanCompleteApi, null, 2));
                fs.writeFileSync(path.resolve(out, 'complete-api.yaml'), yaml.stringify(cleanCompleteApi, 6, 2));
            });
        });

        // Traverse the reference tree to keep only the needed definitions for the root schema
        function resolveDefinitions(root, allDefinitions) {
            var result = {};
            traverse.forEach(root, function (value) {
                if (this.key === '$ref') {
                    var type = value.split('/').pop();
                    result[type] = allDefinitions[type];
                    Object.assign(result, resolveDefinitions(allDefinitions[type], allDefinitions));
                }
            });
            return result;
        }

        task('serve', ['inject-css'], function () {
            if (!params.serve()) {
                return emptyStream();
            }
            //argv is node, apikana, start, options...
            var args = process.argv.slice(3);
            args.unshift(process.argv[1] + '-serve');
            var proc = require('child_process').spawn(process.argv[0], args, {detached: true, stdio: 'ignore'});
            proc.unref();
            var port = params.port();
            log.info('***** Serving API at', colors.blue(colors.underline('http://localhost:' + port)), '*****');
            return emptyStream();
        });

        function emptyStream() {
            return gulp.src([]);
        }

        done ? gulp.start(done) : gulp.start();
    }
};
