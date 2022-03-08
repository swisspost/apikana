var migrator = require("json-schema-migrate");

module.exports = {
    migrateSchemaToLatestVersion: function (schema) {

        var schemaCopy = Object.assign({}, schema);

        // change the target latest schema version to migrate to here
        migrator.draft7(schemaCopy);
        // should prepend a # before the id value to make it a valid URI at schema root
        schemaCopy['$id'] = this.prefixWith('#', schemaCopy['$id']);

        // should prepend a # before the id value to make it a valid URI at every schema definition object
        if (schemaCopy.definitions) {
            for (const [_, defValue] of Object.entries(schemaCopy.definitions)) {
                defValue['$id'] = this.prefixWith('#', defValue['$id']);
            }
        }

        return schemaCopy;
    },

    // Prepend a prefix to data only in case it is not yet the case
    prefixWith: function (prefix, data) {
        if (data && !data.startsWith(prefix)) {
           return prefix + data;
        }
        return data;
    }
}
