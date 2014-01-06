/*global Ember*/
/*global DS*/
'use strict';

DS.IndexedDBMigration = Ember.Object.extend({
  databaseName: "_default",

  version: 1,

  migrate: function() {
    var _this = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var connection = indexedDB.open(_this.databaseName, _this.version);
      connection.onsuccess = function() {
        this.result.close();
        resolve();
      }

      connection.onupgradeneeded = function() {
        _this.set('memoizedOpenDatabaseForUpgrade', this.result);
        _this.runMigrations();
        _this.set('memoizedOpenDatabaseForUpgrade', null);
      }

      connection.onerror = function(e) {
        console.log('Failure connecting to database ' + _this.databaseName);
        reject();
      }
    });
  },

  isNewDatabase: function() {
    var currentDatabase,
        isCreating,
        promise,
        version,
        _this = this;

    promise = new Ember.RSVP.Promise(function(resolve, reject) {
      var currentDatabase, isUpgrading;

      currentDatabase = indexedDB.open(_this.databaseName);

      currentDatabase.onsuccess = function() {
        this.result.close();
        resolve(isUpgrading);
      }

      currentDatabase.onupgradeneeded = function(event) {
        isUpgrading = true;
      }
    });

    return promise;
  },

  addModel: function(model) {
    var db = this.memoizedOpenDatabaseForUpgrade,
        modelName = model.toString(),
        _this = this;

    if (!db.objectStoreNames.contains(modelName)) {
      var objectStore = db.createObjectStore(modelName, { keyPath: "id" });
    }

    //objectStore.createIndex("name", "name", { unique: false });
    //objectStore.createIndex("email", "email", { unique: true });
  },

  migrationsLastVersion: function() {
    return this.migrations.length;
  },

  runMigrations: function() {
    this.migrations.call(this);
  },

  currentDbVersion: function() {
    var instance = indexedDB.open(this.databaseName),
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

  memoizedOpenDatabaseForUpgrade: null,
});
