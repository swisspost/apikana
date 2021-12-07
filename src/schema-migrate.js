var migrator = require("json-schema-migrate");

module.exports = {
    migrateSchemaToLatestVersion: function (schema) {

        var schemaCopy = Object.assign({}, schema);

        // change the target latest schema version to migrate to here
        migrator.draft7(schemaCopy);

        return schemaCopy;
    }
}
