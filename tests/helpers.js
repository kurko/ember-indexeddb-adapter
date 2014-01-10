Ember.ENV.TESTING = true;
Ember.testing = true;

const FIXTURES = {
  "App.Person": [
    { id: "p1", name: "Rambo", cool: true, phones: ['ph1', 'ph2'] },
    { id: "p2", name: "Braddock", cool: false },
    { id: "p3", name: "Billie Jack", cool: false }
  ],
  "App.Phone": [
    { id: "ph1", number: "11", person: "p1" },
    { id: "ph2", number: "22" }
  ]
};

var cl = function(msg) { console.log(msg); }
var ct = function(msg) { console.table(msg); }

var setupStore = function(options) {
  var env = {};
  options = options || {};

  var container = env.container = new Ember.Container();

  var adapter = env.adapter = (options.adapter || DS.Adapter);
  delete options.adapter;

  for (var prop in options) {
    container.register('model:' + prop, options[prop]);
  }

  container.register('store:main', DS.Store.extend({
    adapter: adapter
  }));

  container.register('serializer:_default', DS.IndexedDBSerializer);

  container.injection('serializer', 'store', 'store:main');

  env.serializer = container.lookup('serializer:_default');
  env.store = container.lookup('store:main');
  env.adapter = env.store.get('defaultAdapter');

  return env;
};

var transforms = {
  'boolean': DS.BooleanTransform.create(),
  'date': DS.DateTransform.create(),
  'number': DS.NumberTransform.create(),
  'string': DS.StringTransform.create()
};

// Prevent all tests involving serialization to require a container
DS.JSONSerializer.reopen({
  transformFor: function(attributeType) {
    return this._super(attributeType, true) || transforms[attributeType];
  }
});

var setDatabaseSchema = function() {
  request.onupgradeneeded = function(event) {
    Em.run(function() {
      var db = event.target.result;

      // Create an objectStore to hold information about our customers. We're
      // going to use "ssn" as our key path because it's guaranteed to be
      // unique.
      var objectStore = db.createObjectStore("customers", { keyPath: "ssn" });

      // Create an index to search customers by name. We may have duplicates
      // so we can't use a unique index.
      objectStore.createIndex("name", "name", { unique: false });

      // Create an index to search customers by email. We want to ensure that
      // no two customers have the same email, so use a unique index.
      objectStore.createIndex("email", "email", { unique: true });

      // Store values in the newly created objectStore.
      for (var i in customerData) {
        objectStore.add(customerData[i]);
      }
    });
  };
}

QUnit.pending = function() {
  QUnit.test(arguments[0] + ' (SKIPPED)', function() {
    var li = document.getElementById(QUnit.config.current.id);
    QUnit.done(function() {
      li.style.background = '#FFFF99';
    });
    ok(true);
  });
};
pending = QUnit.pending;

/**
 * INDEXED SPECIFIC
 */

var deleteDatabase = function(dbName) {
  return new Ember.RSVP.Promise(function(resolve, reject) {
    var deletion = indexedDB.deleteDatabase(dbName);
    deletion.onsuccess = function() {
      Em.run(function() {
        resolve();
      });
    }
    deletion.onerror = function() {
      Em.run(function() {
        cl('Error deleting database ' + dbName);
        reject();
      });
    }
  });
}

var openDatabase = function(dbName) {
  return new Ember.RSVP.Promise(function(resolve, reject) {
    var request = indexedDB.open(dbName);
    request.onsuccess = function(event) {
      Em.run(function() {
        var db = request.result;

        db.onerror = function(event) {
          Em.run(function() {
            // Generic error handler for all errors targeted at this database's requests
            console.error(event.target);
            console.log("Database error: " + event.target.wePutrrorMessage || event.target.error.name || event.target.error || event.target.errorCode);
          });
        }

        resolve(event.target.result);
      });
    }

    request.onerror = function(event) {
      Em.run(function() {
        throw('openDatabase helper: Error opening database ' + dbName, event.target);
        reject(event.target);
      });
    }
  });
}

var logSchema = function(dbName) {
  return openDatabase(dbName).then(function(db) {
    console.log(db.objectStoreNames);
    return Ember.RSVP.resolve();
  });
}

var addDataToIDB = function(dbName, fixtures) {
  return new Ember.RSVP.Promise(function(resolve, reject) {
    openDatabase(dbName).then(function(db) {
      var transaction,
          usedObjectStores = [];

      for(var model in fixtures) {
        if (fixtures.hasOwnProperty(model))
          usedObjectStores.pushObject(model);
      }

      // FIXME: this is freezing some times
      transaction = db.transaction(usedObjectStores, "readwrite");

      for (var model in fixtures) {
        var records = fixtures[model],
            objectStore = transaction.objectStore(model);

        records.forEach(function(i) {
          Em.run(function() {
            objectStore.add(i);
          });
        });
      }

      Em.run(function() {
        db.close();
        resolve();
      });
    });
  });
}
