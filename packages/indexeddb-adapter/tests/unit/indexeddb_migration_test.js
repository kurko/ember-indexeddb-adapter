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

    App.Person = DS.Model.extend({
      name: DS.attr('string'),
      cool: DS.attr('boolean'),
      phones: DS.hasMany('phone')
    });
    App.Person.toString = function() { return "App.Person"; }

    var TestMigration = DS.IndexedDBMigration.extend({
      migrations: function() {
        this.addModel(App.Person);
      }
    });

    migration = TestMigration.create({
      databaseName: databaseName,
      version: 1,
    });
  }
});

test("#addModel creates a store for the passed in model", function() {
  stop();
  migration.migrate().then(function() {
    return openDatabase(databaseName);
  }).then(function(db) {
    var stores = db.objectStoreNames;
    db.close();
    ok(stores.contains("App.Person"), "Person object store created");
    start();
  });
});

test("#addModel supports autoIncrement", function() {
  var TestMigration = DS.IndexedDBMigration.extend({
    migrations: function() {
      this.addModel(App.Person, {autoIncrement: true});
    }
  });

  migration = TestMigration.create({
    databaseName: databaseName,
    version: 1,
  });

  stop();
  migration.migrate().then(function() {
    return openDatabase(databaseName);
  }).then(function(db) {
    var stores = db.objectStoreNames,
        transaction = db.transaction("App.Person", 'readwrite'),
        objectStore = transaction.objectStore("App.Person"),
        saveRequest,
        getRequest;

    ok(stores.contains("App.Person"), "Person object store created");
    saveRequest = objectStore.add({name: "Test"});
    saveRequest.onsuccess = function(event) {
      var source = event.target.source;

      equal(source.keyPath, "id", "Object store's id field is 'id'");
      ok(source.autoIncrement, "Object store is auto increment");
      equal(source.name, "App.Person", "Object store has correct name");


      objectStore.get(1).onsuccess = function(event) {
        equal(this.result.id, 1, "First id was 1");
        equal(this.result.name, "Test", "First name is correct");

        saveRequest = objectStore.add({name: "Test2"});
        saveRequest.onsuccess = function(event) {
          var source = event.target.source;
          equal(this.result, 2, "Second id was 2");

          db.close();
          start();
        }
      }
    }

    saveRequest.onerror = function(event) {
      cl(7);
      console.log(this.result);
      db.close();
      start();
    }
  });
});

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
