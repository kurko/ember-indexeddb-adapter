// global variables
var get = Ember.get,
    App = {};

var store, migration, databaseName = "MigrationTest";

module('Integration/DS.IndexedDBMigration', {
  setup: function() {
    Em.run.begin();

    stop();
    deleteDatabase(databaseName).then(function() {
      start();
    });

    App.Person = DS.Model.extend({
      name: DS.attr('string'),
      cool: DS.attr('boolean'),
      phones: DS.hasMany('phone', {async: true})
    });
    App.Phone = DS.Model.extend({
      number: DS.attr('number'),
      person: DS.belongsTo('person', {async: true})
    });

    App.Person.toString = function() { return "App.Person"; }
    App.Phone.toString  = function() { return "App.Phone"; }

    var MigrationTest = DS.IndexedDBMigration.extend({
      databaseName: databaseName,
      version: 1,
      migrations: function() {
        this.addModel(App.Person);
      }
    });

    migration = MigrationTest.create();
  },

  teardown: function() {
    Em.run.end();
  }
});

test('should create the database and run migrations', function() {
  stop();
  deleteDatabase(databaseName).then(function() {
    return Em.run(function() {
      return migration.migrate();
    });
  }).then(function() {

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var connection = indexedDB.open(databaseName);

      connection.onsuccess = function() {
        var _this = this;

        Em.run(function() {
          var storeNames = _this.result.objectStoreNames;
          _this.result.close();

          equal(storeNames.length, 1, "Only one objectStore was created");
          equal(storeNames[0], "App.Person", "App.Person was created with success");
          start();
          resolve();
        });
      }
    });
  }).then(function() {
    stop();
    migration.set('version', 2);
    migration.set('migrations', function() {
      this.addModel(App.Person);
      this.addModel(App.Phone);
    });

    return migration.migrate();
  }).then(function() {

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var connection = indexedDB.open(databaseName);

      connection.onsuccess = function() {
        var _this = this;

        Em.run(function() {
          var storeNames = _this.result.objectStoreNames;
          _this.result.close();

          equal(storeNames.length, 2, "A second objectStore was created");
          equal(storeNames[0], "App.Person", "App.Person was created with success");
          equal(storeNames[1], "App.Phone",  "App.Phone was created with success");
          start();

          resolve();
        });
      }
    });
  });
});
