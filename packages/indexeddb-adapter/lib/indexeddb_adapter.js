/*global Ember*/
/*global DS*/
'use strict';

DS.IndexedDBAdapter = DS.Adapter.extend({
  databaseName: 'IDBAdapter',

  /**
   * IndexedDB requires that the database is initialized and have a defined
   * schema. It's not like localStorage, where you just store things. You have
   * to define beforehand what Object Stores you want (e.g User, Post etc).
   *
   * Whenever we initialize the adapter, we call the DS.IndexedDBMigration
   * object to do its thing, which is to initialize the database.
   *
   * @method init
   * @private
   */
  init: function() {
    this._super();
    this.set('migration', this.get('migration').create());
    this.get('migration').set('databaseName', this.databaseName);
    this.get('migration').set('migrations', this.get('migrations'));
    this.get('migration').migrate();
  },

  /**
   * Defines the migration object.
   *
   * @method migration
   * @private
   */
  migration: DS.IndexedDBMigration.extend(),

  /**
   * This methods is used by the store to retrieve one record by ID.
   *
   * @method serialize
   * @param {DS.Store} store
   * @param {DS.Model} type
   * @param {Object|String|Integer|null} id
   * @param {Object|null} opts
   */
  find: function (store, type, id, opts) {
    var adapter = this,
        allowRecursive = true;

    /**
     * In the case where there are relationships, this method is called again
     * for each relation. Given the relations have references to the main
     * object, we use allowRecursive to avoid going further into infinite
     * recursiveness.
     */
    if (opts && typeof opts.allowRecursive !== 'undefined') {
      allowRecursive = opts.allowRecursive;
    }

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var modelName = type.toString(),
          connection, transaction, objectStore, findRequest;

      adapter.openDatabase().then(function(db) {
        transaction = db.transaction(modelName);
        objectStore = transaction.objectStore(modelName);

        findRequest = objectStore.get(id);
        findRequest.onsuccess = function(event) {
          var record = this.result;

          Em.run(function() {
            if (allowRecursive) {
              adapter.loadRelationships(type, record).then(function(finalRecord) {
                Em.run(function() {
                  resolve(finalRecord);
                });
              });
            } else {
              resolve(record);
            }

            db.close();
          });
        };

        findRequest.onerror = function(event) {
          Em.run(function() {
            reject(event.target.result);
            db.close();
          });
        };
      });
    });
  },

  /**
   * Retrieves many records from the database.
   *
   * @method findMany
   * @private
   * @param {DS.Store} store
   * @param {DS.Model} type the model that we're retrieving
   * @param {Array} ids ids of the records we want to be returned.
   */
  findMany: function (store, type, ids) {
    var adapter = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var modelName = type.toString(),
          result = [],
          connection, transaction, objectStore, findRequest, cursor;

      adapter.openDatabase().then(function(db) {
        transaction = db.transaction(modelName);
        objectStore = transaction.objectStore(modelName);

        cursor = objectStore.openCursor();
        cursor.onsuccess = function(event) {
          Em.run(function() {
            var cursor = event.target.result;

            if (cursor && ids.contains(cursor.value.id)) {
              result.push(cursor.value);
              cursor.continue();
            } else {
              resolve(result);
              db.close();
            }
          });
        }

        cursor.onerror = function() {
          Em.run(function() {
            reject(event.target.result);
            db.close();
          });
        }
      });
    });
  },

  /**
   * Retrieves many records from the database according to the query.
   *
   * For example, we could do:
   *
   *     store.findQuery('customer', {name: /rambo|braddock/})
   *
   * @method findQuery
   * @private
   * @param {DS.Store} store
   * @param {DS.Model} type the model
   * @param {Object} query object with fields we want to look for
   * @param {Array} recordArray
   */
  findQuery: function (store, type, query, recordArray) {
    var adapter = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var modelName = type.toString(),
          result = [],
          connection, transaction, objectStore, findRequest, cursor;

      adapter.openDatabase().then(function(db) {
        transaction = db.transaction(modelName);
        objectStore = transaction.objectStore(modelName);

        cursor = objectStore.openCursor();
        cursor.onsuccess = function(event) {
          Em.run(function() {
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
          });
        }

        cursor.onerror = function(event) {
          Em.run(function() {
            reject(event.target.result);
            db.close();
          });
        }
      });
    }).then(function(records) {
      if (records.get('length')) {
        return adapter.loadRelationshipsForMany(type, records);
      } else {
        return records;
      }
    });
  },

  /**
   * Returns all records of a given type.
   *
   * @method findAll
   * @private
   * @param {DS.Store} store
   * @param {DS.Model} type
   */
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
          Em.run(function() {
            var cursor = event.target.result;

            if (cursor) {
              result.push(cursor.value);

              cursor.continue();
            } else {
              resolve(result);
              db.close();
            }
          });
        }

        cursor.onerror = function(event) {
          Em.run(function() {
            reject(event.target.result);
            db.close();
          });
        }
      });
    });
  },

  /**
   * Creates a record in the database.
   *
   * For example,
   *
   * ```js
   * store.createRecord('user', {name: "Rambo"})
   * ```
   *
   * @method createRecord
   * @param {DS.Store} store
   * @param {DS.Model} type
   * @param {Object} record
   */
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
          Em.run(function() {
            if (Ember.ENV.TESTING) {
              console.error('transaction error: ' + event);
            }
          });
        }

        transaction.onabort = function(event) {
          Em.run(function() {
            if (Ember.ENV.TESTING) {
              console.error('transaction aborted: ' + event);
            }
          });
        }

        objectStore = transaction.objectStore(modelName);

        saveRequest = objectStore.add(serializedRecord);
        saveRequest.onsuccess = function(event) {
          Em.run(function() {
            db.close();
            resolve(serializedRecord);
          });
        };

        saveRequest.onerror = function(event) {
          Em.run(function() {
            db.close();
            if (Ember.ENV.TESTING) {
              console.error('Add request error: ' + event);
            }
            reject(this.result);
          });
        };
      });
    });
  },

  /**
   *
   * @method updateRecord
   * @param {DS.Store} store
   * @param {DS.Model} type
   * @param {Object} record
   */
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
          Em.run(function() {
            if (Ember.ENV.TESTING) {
              console.error('transaction error: ' + event);
            }
          });
        }

        transaction.onabort = function(event) {
          Em.run(function() {
            if (Ember.ENV.TESTING) {
              console.error('transaction aborted: ' + event);
            }
          });
        }

        objectStore = transaction.objectStore(modelName);

        putRequest = objectStore.put(serializedRecord);
        putRequest.onsuccess = function(event) {
          Em.run(function() {
            resolve(serializedRecord);
            db.close();
          });
        };

        putRequest.onerror = function(event) {
          Em.run(function() {
            reject(event.target.result);
            db.close();
          });
        };
      });
    });
  },

  /**
   *
   * @method deleteRecord
   * @param {DS.Store} store
   * @param {DS.Model} type
   * @param {Object} record
   */
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
          Em.run(function() {
            if (Ember.ENV.TESTING) {
              console.error('transaction error: ' + event);
            }
          });
        }

        transaction.onabort = function(event) {
          Em.run(function() {
            if (Ember.ENV.TESTING) {
              console.error('transaction aborted: ' + event);
            }
          });
        }

        objectStore = transaction.objectStore(modelName);

        operation = objectStore.delete(id);
        operation.onsuccess = function(event) {
          Em.run(function() {
            resolve(serializedRecord);
            db.close();
          });
        };

        operation.onerror = function(event) {
          Em.run(function() {
            reject(event.target.result);
            db.close();
          });
        };
      });
    });
  },

  /**
   * Generates a random number. You will usually want to implement UUID in your
   * app and redefine this method.
   *
   * @method generateIdForRecord
   * @private
   */
  generateIdForRecord: function () {
    return Math.random().toString(32).slice(2).substr(0, 5);
  },

  /**
   *
   * @method openDatabase
   * @private
   */
  openDatabase: function() {
    var _this = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var request = window.indexedDB.open(_this.databaseName);

      request.onsuccess = function(event) {
        Em.run(function() {
          resolve(event.target.result);
        });
      }

      request.onerror = function(event) {
        Em.run(function() {
          throw('Error opening database ' + _this.databaseName);
          reject(event);
        });
      }
    });
  },

  /**
   *
   * @method modelRelationships
   * @private
   * @param {DS.Model} type the record to serialize
   */
  modelRelationships: function(type) {
    return Ember.get(type, 'relationshipNames');
  },

  /**
   * This takes a record, then analyzes the model relationships and replaces
   * ids with the actual values.
   *
   * Consider the following JSON is entered:
   *
   * ```js
   * {
   *   "id": 1,
   *   "title": "Rails Rambo",
   *   "comments": [1, 2]
   * }
   *
   * This will return:
   *
   * ```js
   * {
   *   "id": 1,
   *   "title": "Rails Rambo",
   *   "comments": [1, 2]
   *
   *   "_embedded": {
   *     "comment": [{
   *       "_id": 1,
   *       "comment_title": "FIRST"
   *     }, {
   *       "_id": 2,
   *       "comment_title": "Rails is unagi"
   *     }]
   *   }
   * }
   *
   * This way, whenever a resource returned, its relationships will be also
   * returned.
   *
   * @method loadRelationships
   * @private
   * @param {DS.Model} type
   * @param {Object} record
   */
  loadRelationships: function(type, record) {
    var adapter = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var resultJSON = {},
          typeKey = type.typeKey,
          relationships,
          relationshipPromises = [];

      relationships = adapter.modelRelationships(type).belongsTo;
      relationships.push.apply(relationships, adapter.modelRelationships(type).hasMany);

      relationships.forEach(function(relationName) {
        var relationModel = type.typeForRelationship(relationName),
            relationId    = record[relationName],
            relationType  = adapter.typeRelationshipKind(type, relationName),
            promise;

        if (relationId) {
          var opts = {allowRecursive: false};

          if (relationType == 'belongsTo' || relationType == 'hasOne') {
            promise = adapter.find(store, relationModel, relationId, opts)
          } else if (relationType == 'hasMany') {
            promise = adapter.findMany(store, relationModel, relationId, opts)
          }

          promise.then(function(relationRecord) {
            if (relationRecord) {
              if (!record['_embedded']) {
                record['_embedded'] = {}
              }

              record['_embedded'][relationName] = relationRecord;
            }
          });

          relationshipPromises.push(promise);
        }
      });

      Ember.RSVP.all(relationshipPromises).then(function() {
        resolve(record);
      });
    });
  },

  /**
   * Same as `loadRelationships`, but for an array of records.
   *
   * @method loadRelationshipsForMany
   * @private
   * @param {DS.Model} type
   * @param {Object} recordsArray
   */
  loadRelationshipsForMany: function(type, recordsArray) {
    var adapter = this;

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var recordsWithRelationships = [],
          recordsToBeLoaded = [],
          promises = [];

      /**
       * Some times Ember puts some stuff in arrays. We want to clean it so
       * we know exactly what to iterate over.
       */
      for (var i in recordsArray) {
        if (recordsArray.hasOwnProperty(i)) {
          recordsToBeLoaded.push(recordsArray[i]);
        }
      }

      var loadNextRecord = function(record) {
        /**
         * Removes the first item from recordsToBeLoaded
         */
        recordsToBeLoaded = recordsToBeLoaded.slice(1);

        var promise = adapter.loadRelationships(type, record);

        promise.then(function(recordWithRelationships) {
          recordsWithRelationships.push(recordWithRelationships);

          if (recordsToBeLoaded[0]) {
            loadNextRecord(recordsToBeLoaded[0]);
          } else {
            resolve(recordsWithRelationships);
          }
        });
      }

      /**
       * We start by the first record
       */
      loadNextRecord(recordsToBeLoaded[0]);
    });
  },

  /**
   *
   * @method typeRelationshipKind
   * @private
   * @param {DS.Model} type
   * @param {String} relationName
   */
  typeRelationshipKind: function(type, relationName) {
    var relationships = Ember.get(type, 'relationshipsByName');
    return relationships.get(relationName).kind;
  }
});
