// global variables
var get = Ember.get,
    App = {};

var store, database, migration;

module('Integration/DS.IndexedDBMigration', {
  setup: function() {
    var env = {};

    database = window.indexedDB.open("AdapterTestDb", 1);

    var TestMigration = DS.IndexedDBMigration.extend({
      versions: [[
        2, function() {

        }
      ], [
        1, function() {

        }
      ]]
    });

    migration = TestMigration.create({
      databaseName: "migrationTestDb"
    });
  }
});

pending('should create the database in the first place', function() {
  migration.migrate();
});
