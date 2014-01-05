/*global Ember*/
/*global DS*/
'use strict';

DS.IndexedDBMigration = Ember.Object.extend({
  databaseName: "_default",

  migrate: function() {
    var database = window.indexedDB.open(this.databaseName, this.lastVersion()),
        _this = this;

    request.onupgradeneeded = function(event) {
      _this.runMigrations();
      // var db = event.target.result;

      // var objectStore = db.createObjectStore("customers", { keyPath: "ssn" });

      // objectStore.createIndex("name", "name", { unique: false });
      // objectStore.createIndex("email", "email", { unique: true });

      // // Store values in the newly created objectStore.
      // for (var i in customerData) {
      //   objectStore.add(customerData[i]);
      // }
    };
  },

  databaseInstance: function(databaseName, version) {
    return window.indexedDB.open(databaseName, version);
  },

  lastVersion: function() {
    return this.migrations.length;
  },

  runMigrations: function() {
    var _this = this;

    this.migrations.forEach(function(migration) {
      migration.call(_this);
    });
  },

  currentDbVersion: function() {
    var instance = window.indexedDB.open(this.databaseName),
        version;

    version = new Ember.RSVP.Promise(function(resolve, reject) {
      instance.onsuccess = function(event) {
        this.result.close();
        resolve(event.target.result.version);
      }
      instance.onerror = function(event) {
        this.result.close();
        reject(event);
      }
    });
    return version;
  },

  _databaseInstance: {}
});
