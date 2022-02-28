var migrator = require("json-schema-migrate");

module.exports = {
    migrateSchemaToLatestVersion: function (schema) {

        var schemaCopy = Object.assign({}, schema);

        // change the target latest schema version to migrate to here
        migrator.draft7(schemaCopy);
        // should prepend a # before the id value to make it a valid URI
        if (schemaCopy['$id'] && !schemaCopy['$id'].startsWith('#')) {
            schemaCopy['$id'] = '#' + schemaCopy['$id']
        }

        return schemaCopy;
    }
}
