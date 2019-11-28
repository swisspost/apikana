var gulp = require('gulp');
var jeditor = require("gulp-json-editor");
const path = require('path');
const Ajv = require('ajv');
const fse = require('fs-extra');
const winston = require('winston');
const util = require('util');

module.exports = {
    validate: function (root) {

        const logger = winston.createLogger({
            level: 'debug',
            transports: [
                new winston.transports.Console()
            ],
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        });

        function createAjv() {
            const schemaFiles = fse.readdirSync(path.join(root, 'dist', 'model', 'json-schema-v4'));

            // verbose: Include input data information for Schema validation errors
            const ajv = new Ajv({ schemaId: 'id', verbose: true });

            logger.debug("compiling");

            const metaSchema = require('ajv/lib/refs/json-schema-draft-04.json');
            ajv.addMetaSchema(metaSchema);

            // v4 support, see https://github.com/epoberezkin/ajv/releases/tag/5.0.0
            ajv._opts.defaultMeta = metaSchema.id;

            schemaFiles.forEach(file => {
                logger.debug(`Adding schema file: ${file}`);

                const fileContents = require(path.join(root, 'dist', 'model', 'json-schema-v4', file));
                fileContents.id = file; // Otherwise, $ref won't work...
                ajv.addSchema(fileContents);
            });

            return ajv;
        }

        function compileSchema(ajv, topLevelType) {
            const schemaSubmitMailpiece = require(path.join(root, 'dist', 'model', 'json-schema-v4', topLevelType));

            return ajv.compile(schemaSubmitMailpiece);
        }

        function validateData(data, validate, fileName, validationResult) {
            const valid = validate(data);
            validationResult.totalFiles++;

            if (!valid) {
                logger.warn(`${fileName} is NOT valid`);
                validate.errors.forEach(error => logger.warn(error.dataPath + ' ' + util.format(error.message)));
                validationResult.filesWithError.push(fileName);
            } else {
                logger.info(`${fileName} is valid`);
            }
        }

        function validateTestDataFiles() {
            const ajv = createAjv();

            const dataFilePattern = /^([^.]+)(\.(.+))?\.json$/;

            const validationResult = {
                totalFiles: 0,
                filesWithError: []
            };

            fse.readdirSync(path.join(root, 'src', 'samples'))
                .filter(file => dataFilePattern.test(file))
                .map(file => {
                    const match = dataFilePattern.exec(file);
                    const contentJSON = require(path.join(root, 'src', 'samples', file));
                    if(typeof(contentJSON)=='object') {
                        if(contentJSON['$schema'] == undefined) {
                            logger.error(`No $schema property defined in sample: ${file}`);
                            process.exit(1);
                        }
                        const jsonSchema = contentJSON['$schema'].replace(/^.*[\\\/]/, '');

                        return {
                            fileName: match[0],
                            rootType: jsonSchema,
                            subType: match[3]
                        }
                    } else {
                        logger.debug(`Skipping non-object sample: ${file}`);
                        return null;
                    }
                })
                .filter(x => x)
                .forEach(data => {
                    logger.debug(`Validating ${data.fileName} against ${data.rootType}`);
                    const validate = compileSchema(ajv, data.rootType);
                    const testData = require(path.join(root, 'dist', 'samples', data.fileName));
                    validateData(testData, validate, data.fileName, validationResult);
                });

            processValidationResult(validationResult);
        }

        function processValidationResult(validationResult) {
            let exitWithError = false;
            logger.info('===========================================');
            if (validationResult.filesWithError.length > 0) {
                logger.error(`Validation errors: ${validationResult.filesWithError.length} ` +
                    `(total sample files checked: ${validationResult.totalFiles}). Check warn output above for details.` +
                    `\nFiles with error: ${validationResult.filesWithError}`
                );
                exitWithError = true;
            } else {
                logger.info(`All ${validationResult.totalFiles} sample files are valid`);
            }
            logger.info('===========================================');

            if (exitWithError) {
                process.exit(1);
            }
        }

        function task(name, deps, func) {
            if (!func) {
                func = deps;
                deps = [];
            }
            gulp.task(name, deps, function () {
                var start = Date.now();
                var first;
                return func()
                    .on('readable', function () {
                        if (!first) {
                            first = Date.now();
                        }
                    })
                    .on('finish', function () {
                        logger.info(`Done in ${first ? (Date.now() - first) / 1000 : (Date.now() - start) / 1000} s`);
                    })
                    .on('error', function (err) {
                        logger.error(`Error: ${err}`);
                    });
            });
        }

        task('copy-samples', function() {
            logger.info('Cleanup dist/samples');
            // cleanup dist/samples and copy all src/samples again
            fse.removeSync(path.join(root, 'dist', 'samples'));
            logger.info('Copying samples from src/samples to dist/samples.');
            return gulp.src('samples/**', {cwd:  path.join(root, 'src')}).pipe(jeditor(json => {
                if(typeof(json)=='object' && '$schema' in json) {
                    delete json['$schema'];
                }
                return json;
            })).pipe(gulp.dest('samples', {cwd: path.join(root, 'dist')}));
        });

        task('validate', ['copy-samples'], function() {
            // Before validate, copy the samples to ensure they are up-to-date
            validateTestDataFiles();
            return gulp.src([]);
        });

        gulp.start();
    }
};

