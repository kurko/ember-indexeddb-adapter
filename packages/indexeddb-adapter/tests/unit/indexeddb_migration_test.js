// global variables
var get = Ember.get,
    App = {};

var database, migration, mock,
    databaseName = "migrationTestDb";

module('Unit/DS.IndexedDBMigration', {
  setup: function() {
    stop();
    deleteDatabase(databaseName).then(function() {
      start();
    });

    var TestMigration = DS.IndexedDBMigration.extend({
      migrations: [
        function() {
          this.addModel(App.Person);
        },
        function() {
          this.addModel(App.Phone);
        }
      ]
    });

    migration = TestMigration.create({
      databaseName: databaseName
    });
  }
});

// test("#addModel creates a store for the passed in model", function() {
//   stop();
//   migration.addModel(App.Person).then(function() {
//     cl('1');
//     return openDatabase(databaseName);
//   }).then(function(db) {
//     cl('2');
//     var stores = db.objectStoreNames;
//     cl(stores);
//     db.close();
//     ok(stores.contains("App.Person"), "Person object store created");
//     start();
//   });
// });

test('#runMigrations', function() {
  mock = "";
  var TestMigration = DS.IndexedDBMigration.extend({
    migrations: function() {
      mock = mock + "1";
      mock = mock + "2";
    }
  });

  migration = TestMigration.create();

  migration.runMigrations();
  equal(mock, "12", "Migrations were run in order");
});

test('#currentDbVersion', function() {
  stop();

  var promise = new Ember.RSVP.Promise(function(resolve, reject) {
    var deletion = window.indexedDB.deleteDatabase("migrationTestDb");

    deletion.onsuccess = function() {
      Em.run(function() {
        resolve();
      });
    }
  });

  promise.then(function() {

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var db1 = indexedDB.open("migrationTestDb", 1);

      db1.onsuccess = function() {
        var _this = this;

        Em.run(function() {
          _this.result.close();
          resolve();
        });
      }
    });

  }).then(function() {

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var db999 = indexedDB.open("migrationTestDb", 999);

      db999.onsuccess = function(event) {
        Em.run(function() {
          event.target.result.close();
          resolve();
        });
      }
    });

  }).then(function() {

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var version;

      migration = DS.IndexedDBMigration.extend().create({
        databaseName: "migrationTestDb"
      });

      version = migration.currentDbVersion();
      version.then(function(v) {
        equal(v, 999, "The current version is correct");
        start();
        resolve();
      });
    });

  }).then(function() {

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var deletion = window.indexedDB.deleteDatabase("migrationTestDb");

      deletion.onsuccess = function() {
        Em.run(function() {
          resolve();
        });
      }
    });

  }).then(function() {
    stop();
    var version,
        db2 = indexedDB.open("migrationTestDb", 2);

    db2.onsuccess = function() {
      var _this = this;

      Em.run(function() {
        migration = DS.IndexedDBMigration.extend().create({
          databaseName: "migrationTestDb"
        });

        version = migration.currentDbVersion();
        version.then(function(v) {
          equal(v, 2, "The current version is correct after DB was reset");
          start();
          _this.result.close();
        });
      });
    }
  });
});
