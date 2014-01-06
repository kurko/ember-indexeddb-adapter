/*global Ember*/
/*global DS*/
'use strict';

DS.IndexedDBAdapter = DS.Adapter.extend({
  databaseName: 'IDBAdapter',

  init: function() {
    this._super();
    this.set('migration', this.get('migration').create());
    this.get('migration').set('databaseName', this.databaseName);
    this.get('migration').set('migrations', this.get('migrations'));
    this.get('migration').migrate();
  },

  migration: DS.IndexedDBMigration.extend(),

  /**
    @method find
    @param {DS.Model} type
    @param {Object|String|Integer|null} id
    */
  find: function (store, type, id) {
    var _this = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var modelName = type.toString(),
          connection, transaction, objectStore, findRequest;

      _this.openDatabase().then(function(db) {
        transaction = db.transaction(modelName);
        objectStore = transaction.objectStore(modelName);

        findRequest = objectStore.get(id);
        findRequest.onsuccess = function(event) {
          resolve(this.result);
          db.close();
        };

        findRequest.onerror = function(event) {
          resolve(this.result);
          db.close();
        };
      });
    });
  },

  findMany: function (store, type, ids) {
    var records = Ember.A();
    console.error("findMany not implemented");

    return Ember.RSVP.resolve(record);
  },

  findQuery: function (store, type, query, recordArray) {
    var records = Ember.A();
    console.error("findQuery not implemented");

    return Ember.RSVP.resolve(records);
  },

  findAll: function (store, type) {
    var records = Ember.A();
    console.error("findAll not implemented");

    return Ember.RSVP.resolve(records);
  },

  createRecord: function (store, type, record) {
    var _this = this,
        modelName = type.toString(),
        serializedRecord = record.serialize({includeId: true});

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var connection, transaction, objectStore, saveRequest;

      _this.openDatabase().then(function(db) {
        /**
         * TODO: saving associations should open an appropriate transaction
         */
        transaction = db.transaction(modelName, 'readwrite');

        transaction.onerror = function(event) {
          if (Ember.ENV.TESTING) {
            console.error('transaction error: ' + event);
          }
        }

        transaction.onabort = function(event) {
          if (Ember.ENV.TESTING) {
            console.error('transaction aborted: ' + event);
          }
        }

        objectStore = transaction.objectStore(modelName);

        saveRequest = objectStore.add(serializedRecord);
        saveRequest.onsuccess = function(event) {
          db.close();
          resolve(serializedRecord);
        };

        saveRequest.onerror = function(event) {
          db.close();
          if (Ember.ENV.TESTING) {
            console.error('Add request error: ' + event);
          }
          reject(this.result);
        };
      });
    });
  },

  updateRecord: function (store, type, record) {
    console.error("updateRecord not implemented");
    return Ember.RSVP.resolve();
  },

  deleteRecord: function (store, type, record) {
    console.error("deleteRecord not implemented");
    return Ember.RSVP.resolve();
  },

  generateIdForRecord: function () {
    return Math.random().toString(32).slice(2).substr(0, 5);
  },

  openDatabase: function() {
    var _this = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var request = window.indexedDB.open(_this.databaseName);

      request.onsuccess = function(event) {
        resolve(this.result);
      }

      request.onerror = function() {
        throw('Error opening database ' + _this.databaseName);
        reject(this);
      }
    });
  }
});
