/*global Ember*/
/*global DS*/
'use strict';

DS.IndexedDBMigration = Ember.Object.extend({
  databaseName: "_default",

  // databaseInstance: function(customVersion) {
  //   var _this = this,
  //       instance;

  //   return new Ember.RSVP.Promise(function(resolve, reject) {
  //     if (!_this.memoizedInstance) {

  //       if (customVersion) {
  //         connection = indexedDB.open(_this.databaseName, customVersion);
  //       } else {
  //         connection = indexedDB.open(_this.databaseName);
  //       }

  //       _this.memoizedInstance = Ember.Object.extend().create({
  //         id: Math.random(),
  //         version: customVersion,
  //         connection: connection
  //       });

  //       resolve(_this.memoizedInstance);
  //     } else {
  //     }
  //   });
  // },
  // memoizedInstance: null,

  migrate: function() {
    var _this = this,
        promise;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      _this.isNewDatabase().then(function(isNewDatabase) {
        if (isNewDatabase) {
          _this.runMigrations(1).then(function() {
            resolve(true);
          });
        } else {
          _this.runMigrations().then(function() {
            resolve(true);
          });
        }
      });
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

    // currentDatabase.onupgradeneeded = function(event) {
    //   var isCreating;

    //   cl(event.target.result.version);
    //   // if () {

    //   // }
    //   cl('onupgradeneeded');
    //   _this.runMigrations();
    //   // var db = event.target.result;

    //   // var objectStore = db.createObjectStore("customers", { keyPath: "ssn" });

    //   // objectStore.createIndex("name", "name", { unique: false });
    //   // objectStore.createIndex("email", "email", { unique: true });

    //   // // Store values in the newly created objectStore.
    //   // for (var i in customerData) {
    //   //   objectStore.add(customerData[i]);
    //   // }
    // };
    // currentDatabase.onsuccess = function() {
    //   this.result.close();
    // }
  },

  migrationsLastVersion: function() {
    return this.migrations.length;
  },

  runMigrations: function(firstVersionToRun) {
    var _this = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var versionPromise,
          lastVersionRun;

      versionPromise = new Ember.RSVP.Promise(function(versionResolve, reject) {
        if (!firstVersionToRun) {
          _this.currentDbVersion().then(function(currentVersion) {
            firstVersionToRun = currentVersion + 1;
            versionResolve(firstVersionToRun);
          });
        } else {
          versionResolve(firstVersionToRun);
        }
      });

      versionPromise.then(function(firstVersionToRun) {
        _this.migrations.forEach(function(migration, index) {
          var versionBeingRun = index + 1;

          if (firstVersionToRun <= versionBeingRun) {
            lastVersionRun = versionBeingRun;
            migration.call(_this);
          }
        });

        return Ember.RSVP.resolve();
      }).then(function() {

        if (lastVersionRun) {
          var connection = indexedDB.open(_this.databaseName, lastVersionRun);
          connection.onsuccess = function(event) {
            this.result.close();
            resolve();
          }
        } else {
          resolve();
        }
      });
    });
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
});
