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
  addModel: function(model, opts) {
    var db = this.memoizedOpenDatabaseForUpgrade,
        modelName = model.toString(),
        opts = opts || {},
        _this = this;

    Em.run(function() {
      if (!db.objectStoreNames.contains(modelName)) {
        var keyOpts = { keyPath: "id" },
            objectStore;

        if (opts.autoIncrement) {
          keyOpts["autoIncrement"] = opts.autoIncrement;
        }

        if (opts.keyPath) {
          keyOpts["keyPath"] = opts.keyPath;
        }
        objectStore = db.createObjectStore(modelName, keyOpts);
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

DS.IndexedDBSerializer = DS.JSONSerializer.extend({
  serializeHasMany: function(record, json, relationship) {
    var key = relationship.key,
        relationshipType = DS.RelationshipChange.determineRelationshipType(record.constructor, relationship);

    if (relationshipType === 'manyToNone' ||
        relationshipType === 'manyToMany' ||
        relationshipType === 'manyToOne') {
      json[key] = record.get(key).mapBy('id');
    // TODO support for polymorphic manyToNone and manyToMany relationships
    }
  },
  /**
   * Extracts whatever was returned from the adapter.
   *
   * If the adapter returns relationships in an embedded way, such as follows:
   *
   * ```js
   * {
   *   "id": 1,
   *   "title": "Rails Rambo",
   *
   *   "_embedded": {
   *     "comment": [{
   *       "id": 1,
   *       "comment_title": "FIRST"
   *     }, {
   *       "id": 2,
   *       "comment_title": "Rails is unagi"
   *     }]
   *   }
   * }
   *
   * this method will create separated JSON for each resource and then push
   * them individually to the Store.
   *
   * In the end, only the main resource will remain, containing the ids of its
   * relationships. Given the relations are already in the Store, we will
   * return a JSON with the main resource alone. The Store will sort out the
   * associations by itself.
   *
   * @method extractSingle
   * @private
   * @param {DS.Store} store the returned store
   * @param {DS.Model} type the type/model
   * @param {Object} payload returned JSON
   */
  extractSingle: function(store, type, payload) {
    if (payload && payload._embedded) {
      for (var relation in payload._embedded) {
        var typeName = Ember.String.singularize(relation),
            embeddedPayload = payload._embedded[relation];

        if (embeddedPayload) {
          if (Object.prototype.toString.call(embeddedPayload) === '[object Array]') {
            store.pushMany(typeName, embeddedPayload);
          } else {
            store.push(typeName, embeddedPayload);
          }
        }
      }

      delete payload._embedded;
    }

    return this.normalize(type, payload);
  },

  /**
   * This is exactly the same as extractSingle, but used in an array.
   *
   * @method extractSingle
   * @private
   * @param {DS.Store} store the returned store
   * @param {DS.Model} type the type/model
   * @param {Array} payload returned JSONs
   */
  extractArray: function(store, type, payload) {
    var serializer = this;

    return payload.map(function(record) {
      var extracted = serializer.extractSingle(store, type, record);
      return serializer.normalize(type, record);
    });
  }
});

/*global Ember*/
/*global DS*/
'use strict';

/**
 * SmartSearch allows the adapter to make queries that are broader and that
 * will, in most business cases, yield more relevant results.
 *
 * It has a drawback, though: less performant queries. It shouldn't be a problem
 * for smaller data stores.
 */
DS.IndexedDBSmartSearch = Ember.Object.extend({

  field:       null,
  queryString: null,
  record:      null,
  type:        null,

  /**
   * The entrypoint. It tries to match the current query field against the
   * record. See below each query explained.
   *
   * == Search ==
   *
   *     store.findQuery('person', {search: "rao"})
   *
   * This will will search for any field that has the string rao, such as
   * "Rambo".
   *
   * == Search ==
   *
   *     store.findQuery('person', {createdAt: "32 days ago"})
   *
   * Given `createdAt` field has a transform type `date`, it will returns only
   * records that match the 32nd day ago.
   *
   * If the fields doesn't have the `date` transform, nothing is queried.
   *
   * Besides `x days ago`, `today` and `yesterday` are also accepted.
   */
  isMatch: function() {
    var record      = this.get('record'),
        type        = this.get('type'),
        field       = this.get('field'),
        queryString = this.get('queryString'),
        fieldType   = this.fieldType(field),
        queryType;

    if (fieldType === "search") {
      queryType = 'searchField';
    } else if (fieldType === "date") {
      queryType = 'dateField';
    } else {
      queryType = 'regularField';
    }

    return this[queryType](type, record, field, queryString);
  },

  /**
   * Searches for string in any field. Consider the following query:
   *
   *     store.findQuery('person', {search: "rmbo"})
   *
   * This would match a field such as `{name: "Rambo"}`.
   *
   * @method searchField
   */
  searchField: function(type, record, field, queryString) {
    var isMatch;

    for (var queriedField in record) {
      var isSearchField = this.get('fieldSearchCriteria')(queriedField, type),
          fieldValue = record[queriedField];

      if (!isSearchField)
        continue;

      if (!queryString || queryString == " ") { return false; }

      if (Object.prototype.toString.call(queryString).match("RegExp")) {
        isMatch = isMatch || new RegExp(queryString).test(fieldValue);
      } else {
        isMatch = isMatch || (fieldValue === queryString);

        var str,
            strArray = [];

        for (var i = 0, len = queryString.length; i < len; i++) {
          strArray.push(queryString[i]);
        }

        str = new RegExp(strArray.join(".*"), "i");
        isMatch = isMatch || new RegExp(str).test(fieldValue);
      }
    }

    return isMatch;
  },

  dateField: function(type, record, field, queryString) {
    var rawValue = record[field],
        date = (new Date(Date.parse(rawValue))),
        targetDate = new Date(),
        match;

    var IsMatchToDate = function(targetDate) {
      var year   = targetDate.getFullYear(),
          month  = targetDate.getMonth(),
          day    = targetDate.getDate(),
          hour   = targetDate.getHours(),
          minute = targetDate.getMinutes();

      if (date.getFullYear() == year &&
          date.getMonth()    == month &&
          date.getDate()     == day) {
        return true;
      }
    }

    if (queryString === "today") {
      if (IsMatchToDate(targetDate)) {
        return true;
      }
    } else if (queryString === "yesterday") {
      targetDate.setDate(targetDate.getDate() - 1);
      if (IsMatchToDate(targetDate)) {
        return true;
      }
    } else if (match = queryString.match(/([0-9]{1,}) days ago/i)) {
      targetDate.setDate(targetDate.getDate() - match[1]);
      if (IsMatchToDate(targetDate)) {
        return true;
      }
    }

    return false;
  },

  regularField: function(type, record, field, queryString) {
    var queriedField = record[field];

    if (Object.prototype.toString.call(queryString).match("RegExp")) {
      return new RegExp(queryString).test(queriedField);
    } else {
      return (queriedField === queryString);
    }
  },

  fieldType: function(fieldName) {
    if (fieldName === "search") {
      return "search";
    } else {
      var type = this.get('type'),
          transform;

      type.eachTransformedAttribute(function(name, type) {
        if (name == fieldName) {
          transform = type;
        }
      });

      return transform;
    }
  }
});

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
   */
  init: function() {
    this.set('migration', this.get('migration').create());
    this.get('migration').set('databaseName', this.databaseName);
    this.get('migration').set('migrations', this.get('migrations'));
    this.get('migration').set('version', this.get('version'));

    if (!this.get('smartSearch')) {
      this.set('smartSearch', false);
    }

    this.get('migration').migrate();
  },

  /**
   * Defines the migration object.
   *
   * @method migration
   * @private
   */
  migration: DS.IndexedDBMigration.extend(),

  defaultEmptyReturn: function() {
    return {id: null};
  },
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
            if (allowRecursive && record) {
              adapter.loadRelationships(type, record).then(function(finalRecord) {
                Em.run(function() {
                  resolve(finalRecord);
                });
              });
            } else {
              if (!record) {
                reject();
              } else {
                resolve(record);
              }
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
          var cursor = event.target.result;

          Em.run(function() {
            if (cursor) {
              if (ids.contains(cursor.value.id)) {
                result.push(cursor.value);
              }
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
          db.close();
          Em.run(function() {
            var cursor = event.target.result,
                isMatch;

            if (cursor) {
              for (var field in query) {
                var queryString = query[field];

                /**
                 * If it was already defined that the current record doesn't match
                 * the query, leave the search.
                 */
                if (typeof isMatch === false) {
                  break;
                }

                if (isMatch || typeof isMatch == "undefined") {
                  isMatch = adapter.findQueryCriteria(field, queryString, cursor.value, type);
                }
              }

              if (isMatch === true) {
                result.push(cursor.value);
              }

              cursor.continue();
            } else {
              if (!result.length) {
                reject();
              } else {
                resolve(result);
              }
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

  findQueryCriteria: function(field, queryString, record, type) {
    var queriedField;
    /**
     * If smartSearch is enabled, we pass the responsibility on to
     * `DS.IndexedDBSmartSearch`. This performs tasks like matching dates and
     * fulltext search.
     */
    if (this.get('smartSearch')) {
      var smartSearch = DS.IndexedDBSmartSearch.createWithMixins({
        field: field,
        queryString: queryString,
        record: record,
        type: type,
        fieldSearchCriteria: this.get('findQuerySearchCriteria')
      });

      return smartSearch.isMatch();
    } else {
      queriedField = record[field];
      if (Object.prototype.toString.call(queryString).match("RegExp")) {
        return new RegExp(queryString).test(queriedField);
      } else {
        return (queriedField === queryString);
      }
    }
  },

  findQuerySearchCriteria: function(fieldName, type) {
    return true;
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
        modelName = type.toString();

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var connection, transaction, objectStore, saveRequest, serializedRecord;

      _this.openDatabase().then(function(db) {
        /**
         * TODO: saving associations should open an appropriate transaction
         */
        transaction = db.transaction(modelName, 'readwrite');

        transaction.onerror = function(event) {
          Em.run(function() {
            if (Ember.testing) {
              console.error('transaction error: ' + event);
            }
          });
        }

        transaction.onabort = function(event) {
          Em.run(function() {
            if (Ember.testing) {
              console.error('transaction aborted: ' + event);
            }
          });
        }

        objectStore = transaction.objectStore(modelName);

        serializedRecord = record.serialize({includeId: !objectStore.autoIncrement});
        saveRequest = objectStore.add(serializedRecord);
        saveRequest.onsuccess = function(event) {
          Em.run(function() {
            db.close();
            _this.loadRelationships(type, serializedRecord).then(function(finalRecord) {
              Em.run(function() {
                resolve(finalRecord);
              });
            });
          });
        };

        saveRequest.onerror = function(event) {
          var result = this.result;
          Em.run(function() {
            if (Ember.testing) {
              console.error('Add request error: ' + result);
            }
            reject(result);
            db.close();
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
            if (Ember.testing) {
              console.error('transaction error: ' + event);
            }
          });
        }

        transaction.onabort = function(event) {
          Em.run(function() {
            if (Ember.testing) {
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
            if (Ember.testing) {
              console.error('transaction error: ' + event);
            }
          });
        }

        transaction.onabort = function(event) {
          Em.run(function() {
            if (Ember.testing) {
              console.error('transaction aborted: ' + event);
            }
          });
        }

        objectStore = transaction.objectStore(modelName);

        transaction.oncomplete = function(t) {
          Em.run(function() {
            resolve(serializedRecord);
            db.close();
          });
        }

        if (objectStore.autoIncrement) {
          id = parseInt(id);
        }
        operation = objectStore.delete(id);
        operation.onsuccess = function(event) {
          Em.run(function() {
            db.close();
            resolve(serializedRecord);
          });
        };

        operation.onerror = function(event) {
          Em.run(function() {
            db.close();
            reject(event.target.result);
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
  generateIdForRecord: function() {
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
            relationEmbeddedId = record[relationName],
            relationProp  = adapter.relationshipProperties(type, relationName),
            relationType  = relationProp.kind,
            /**
             * This is the relationship field.
             */
            promise, embedPromise;

        var opts = {allowRecursive: false};
        /**
         * embeddedIds are ids of relations that are included in the main
         * payload, such as:
         *
         * {
         *    cart: {
         *      id: "s85fb",
         *      customer: "rld9u"
         *    }
         * }
         *
         * In this case, cart belongsTo customer and its id is present in the
         * main payload. We find each of these records and add them to _embedded.
         */
        if (relationEmbeddedId) {
          if (relationType == 'belongsTo' || relationType == 'hasOne') {
            promise = adapter.find(null, relationModel, relationEmbeddedId, opts)
          } else if (relationType == 'hasMany') {
            promise = adapter.findMany(null, relationModel, relationEmbeddedId, opts)
          }

          embedPromise = new Ember.RSVP.Promise(function(resolve, reject) {
            promise.then(function(relationRecord) {
              var finalPayload = adapter.addEmbeddedPayload(record, relationName, relationRecord)
              resolve(finalPayload);
            });
          });

          relationshipPromises.push(embedPromise);
        }
      });

      Ember.RSVP.all(relationshipPromises).then(function() {
        resolve(record);
      });
    });
  },

  /**
   * Given the following payload,
   *
   *   {
   *      cart: {
   *        id: "1",
   *        customer: "2"
   *      }
   *   }
   *
   * With `relationshipName` being `customer` and `relationshipRecord`
   *
   *   {id: "2", name: "Rambo"}
   *
   * This method returns the following payload:
   *
   *   {
   *      cart: {
   *        id: "1",
   *        customer: "2"
   *      },
   *      _embedded: {
   *        customer: {
   *          id: "2",
   *          name: "Rambo"
   *        }
   *      }
   *   }
   *
   * which is then treated by the serializer later.
   *
   * @method addEmbeddedPayload
   * @private
   * @param {Object} payload
   * @param {String} relationshipName
   * @param {Object} relationshipRecord
   */
  addEmbeddedPayload: function(payload, relationshipName, relationshipRecord) {
    var objectHasId = (relationshipRecord && relationshipRecord.id),
        arrayHasIds = (relationshipRecord.length && relationshipRecord.everyBy("id")),
        isValidRelationship = (objectHasId || arrayHasIds);

    if (isValidRelationship) {
      if (!payload['_embedded']) {
        payload['_embedded'] = {}
      }

      payload['_embedded'][relationshipName] = relationshipRecord;
      if (relationshipRecord.length) {
        payload[relationshipName] = relationshipRecord.mapBy('id');
      } else {
        payload[relationshipName] = relationshipRecord.id;
      }
    }

    if (this.isArray(payload[relationshipName])) {
      payload[relationshipName] = payload[relationshipName].filter(function(id) {
        return id;
      });
    }

    return payload;
  },

  isArray: function(value) {
    return Object.prototype.toString.call(value) === '[object Array]';
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
   * @method relationshipProperties
   * @private
   * @param {DS.Model} type
   * @param {String} relationName
   */
  relationshipProperties: function(type, relationName) {
    var relationships = Ember.get(type, 'relationshipsByName');
    if (relationName) {
      return relationships.get(relationName);
    } else {
      return relationships;
    }
  }
});
