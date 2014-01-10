/*global Ember*/
/*global DS*/
'use strict';

DS.IndexedDBMigration = Ember.Object.extend({
  /**
   * This mostly a placeholder, given this value is defined by the adapter.
   *
   * @var databaseName
   */
  databaseName: "_default",

  /**
   * Whenever the version is incremented, IndexedDB will run the update code
   * and update the schema. It's is defined in the adapter and changed by it
   * here.
   *
   * @var databaseName
   */
  version: 1,

  /**
   * This is run the first time the adapter is initialized (when page opens).
   * It basically checks if the schema needs to be updated, and then runs the
   * proper migrations.
   *
   * @method migrate
   */
  migrate: function() {
    var _this = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var connection = indexedDB.open(_this.databaseName, _this.version);
      connection.onsuccess = function() {
        var result = this.result;

        Em.run(function() {
          result.close();
          resolve();
        });
      }

      connection.onupgradeneeded = function(event) {
        Em.run(function() {
          _this.set('memoizedOpenDatabaseForUpgrade', event.target.result);
          _this.runMigrations();
          _this.set('memoizedOpenDatabaseForUpgrade', null);
        });
      }

      connection.onerror = function(e) {
        Em.run(function() {
          console.log('Failure connecting to IndexedDB database ' + _this.databaseName);
          reject(e);
        })
      }
    });
  },


  /**
   * This is a method that can be used inside a migration, such as:
   *
   *     App.ApplicationAdapter = DS.IndexedDBAdapter.extend({
   *       databaseName: 'some_database_name'
   *       version: 1,
   *       migrations: function() {
   *         this.addModel(App.Person);
   *         this.addModel(App.Phone);
   *       }
   *     });
   *
   * In this case, the code will create the schema for App.Person and
   * App.Phone automatically.
   *
   * @method addModel
   * @param {DS.Model} type
   */
  addModel: function(model) {
    var db = this.memoizedOpenDatabaseForUpgrade,
        modelName = model.toString(),
        _this = this;

    Em.run(function() {

      if (!db.objectStoreNames.contains(modelName)) {
        var objectStore = db.createObjectStore(modelName, { keyPath: "id" });
      }
    });

    //objectStore.createIndex("name", "name", { unique: false });
    //objectStore.createIndex("email", "email", { unique: true });
  },

  /**
   * Runs the migrations.
   *
   * @method runMigrations
   * @private
   */
  runMigrations: function() {
    this.migrations.call(this);
  },

  /**
   * Deprecated
   */
  currentDbVersion: function() {
    var instance = indexedDB.open(this.databaseName),
        version;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      instance.onsuccess = function(event) {
        var result = this.result;
        Em.run(function() {
          result.close();
          resolve(event.target.result.version);
        });
      }
      instance.onerror = function(event) {
        var result = this.result;
        Em.run(function() {
          result.close();
          reject(event);
        });
      }
    });
  },

  memoizedOpenDatabaseForUpgrade: null,
});
