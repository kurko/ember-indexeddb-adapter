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
          reject(this.result);
          db.close();
        };
      });
    });
  },

  findMany: function (store, type, ids) {
    var _this = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var modelName = type.toString(),
          result = [],
          connection, transaction, objectStore, findRequest, cursor;

      _this.openDatabase().then(function(db) {
        transaction = db.transaction(modelName);
        objectStore = transaction.objectStore(modelName);

        cursor = objectStore.openCursor();
        cursor.onsuccess = function(event) {
          var cursor = event.target.result;

          if (cursor) {
            if (ids.contains(cursor.value.id)) {
              result.push(cursor.value);
            }
            cursor.continue();
          } else {
            resolve(result);
            db.close();
          }
        }
      });
    });
  },

  findQuery: function (store, type, query, recordArray) {
    var _this = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var modelName = type.toString(),
          result = [],
          connection, transaction, objectStore, findRequest, cursor;

      _this.openDatabase().then(function(db) {
        transaction = db.transaction(modelName);
        objectStore = transaction.objectStore(modelName);

        cursor = objectStore.openCursor();
        cursor.onsuccess = function(event) {
          var cursor = event.target.result,
              isMatch;

          if (cursor) {
            for (var field in query) {
              var queryString = query[field],
                  queriedField = cursor.value[field];

              /**
               * If it was already defined that the current record doesn't match
               * the query, leave the search.
               */
              if (typeof isMatch === false) {
                break;
              }

              /**
               * If the query param is a Regex
               */
              if (Object.prototype.toString.call(queryString).match("RegExp")) {
                if (new RegExp(queryString).test(queriedField)) {
                  isMatch = true;
                } else {
                  isMatch = false;
                }
              } else {
                if (queriedField === queryString) {
                  isMatch = true;
                } else {
                  isMatch = false;
                }
              }
            }

            if (isMatch === true) {
              result.push(cursor.value);
            }

            cursor.continue();
          } else {
            resolve(result);
            db.close();
          }
        }
      });
    });
  },

  findAll: function (store, type) {
    var _this = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var modelName = type.toString(),
          result = [],
          connection, transaction, objectStore, findRequest, cursor;

      _this.openDatabase().then(function(db) {
        transaction = db.transaction(modelName);
        objectStore = transaction.objectStore(modelName);

        cursor = objectStore.openCursor();
        cursor.onsuccess = function(event) {
          var cursor = event.target.result;

          if (cursor) {
            result.push(cursor.value);

            cursor.continue();
          } else {
            resolve(result);
            db.close();
          }
        }
      });
    });
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
    var _this = this,
        serializedRecord = record.serialize({includeId: true});

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var modelName = type.toString(),
          id = record.id,
          connection, transaction, objectStore, putRequest;

      _this.openDatabase().then(function(db) {
        transaction = db.transaction(modelName, "readwrite");

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

        putRequest = objectStore.put(serializedRecord);
        putRequest.onsuccess = function(event) {
          resolve(serializedRecord);
          db.close();
        };

        putRequest.onerror = function(event) {
          reject(this.result);
          db.close();
        };
      });
    });
  },

  deleteRecord: function (store, type, record) {
    var _this = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var modelName = type.toString(),
          serializedRecord = record.serialize({includeId: true}),
          id = serializedRecord.id,
          connection, transaction, objectStore, operation;

      _this.openDatabase().then(function(db) {
        transaction = db.transaction(modelName, "readwrite");

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

        operation = objectStore.delete(id);
        operation.onsuccess = function(event) {
          resolve(serializedRecord);
          db.close();
        };

        operation.onerror = function(event) {
          reject(this.result);
          db.close();
        };
      });
    });
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
