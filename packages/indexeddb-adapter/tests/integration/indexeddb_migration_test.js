// global variables
var get = Ember.get,
    App = {};

var store, migration;

module('Integration/DS.IndexedDBMigration', {
  setup: function() {
    var env = {};

    var MigrationTest = DS.IndexedDBMigration.extend({
      databaseName: "MigrationTest",
      migrations: [
        function() {
          cl(1);
        },
        function() {
          cl(2);
        }
      ]
    });

    migration = MigrationTest.create();
  }
});

test('should create the database and run migrations', function() {
  var dbName = "MigrationTest",
      mock = 0,
      MigrationTest;

  MigrationTest = DS.IndexedDBMigration.extend({
    databaseName: dbName,
    migrations: [
      function() {
        mock += 1;
      },
      function() {
        mock += 2;
      }
    ]
  });

  migration = MigrationTest.create();

  stop();
  deleteDatabase(dbName).then(function() {
    migration.migrate().then(function() {
      equal(mock, 3, "Two migrations were run");
      return migration.currentDbVersion();
    }).then(function(version) {
      equal(version, 2, "Version is correct");
      return migration.migrate();
    }).then(function() {
      equal(mock, 3, "No more migrations were run");
      return migration.currentDbVersion();
    }).then(function(version) {
      equal(version, 2, "Version continues correct");
      start();
    });
  });
});
