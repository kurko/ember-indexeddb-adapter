var get = Ember.get,
    App = {};

var store, database, databaseName, debugFlag = false, Adapter;

var setup = function(options) {
  Em.run.begin();
  var env = {};

  databaseName = "AdapterTest";

  stop();
  deleteDatabase(databaseName).then(function() {
    App.Person = DS.Model.extend({
      name: DS.attr('string'),
      cool: DS.attr('boolean'),
      phones: DS.hasMany('phone'),
      createdAt: DS.attr('date'),
    });

    App.Phone = DS.Model.extend({
      number: DS.attr('number'),
      person: DS.belongsTo('person')
    });

    App.Person.toString = function() { return "App.Person"; }
    App.Phone.toString  = function() { return "App.Phone"; }

    var migrationsPromise = setStore(options)

    return migrationsPromise;
  }).then(function() {
    return addDataToIDB(databaseName, FIXTURES);
  }).then(function() {
    start();
  });
}

module("Integration/DS.IndexedDBAdapter's Search/SmartSearch", {
  setup: function() {
    setup({smartSearch: false});
  },

  teardown: function() {
    Em.run.end();
  }
});

var setStore = function(options) {
  var migrationsPromise = new Ember.RSVP.Promise(function(resolve, reject) {
    Adapter = DS.IndexedDBAdapter.extend({
      databaseName: databaseName,
      version: 1,
      migrations: function() {
        var _this = this;
        Em.run(function() {
          _this.addModel(App.Person);
          _this.addModel(App.Phone);
          resolve();
        });
      }
    });

    Adapter.reopen({
      smartSearch: options.smartSearch
    });

    env = setupStore({
      person: App.Person,
      phone: App.Phone,
      adapter: Adapter
    });

    store = env.store;
  });
}

test('#findQuery should find records using queries without smartSearch', function() {
  expect(4);

  stop();
  store.findQuery('person', {name: /rambo|braddock/i}).then(function(records) {
    equal(get(records, 'length'), 2, 'found results for /rambo|braddock/i');
    start();
  });

  stop();
  store.findQuery('person', {name: /.+/, id: /p1/}).then(function(records) {
    equal(get(records, 'length'), 1, 'found results for {name: /.+/, id: /p1/}');
    start();
  });

  stop();
  store.findQuery('person', {name: 'Rambo'}).then(function(records) {
    equal(get(records, 'length'), 1, 'found results for name "Rambo"');
    start();
  });

  stop();
  store.findQuery('person', {cool: true}).then(function(records) {
    equal(get(records, 'length'), 1, 'found results for {cool: true}');
    start();
  });
});

test("#findQuery doesn't accept `search` key without smartSearch", function() {
  expect(1);
  stop();
  store.findQuery('person', {search: /rambo|braddock/i}).then(function(records) {
    start();
  }, function() {
    ok(true, "Person isn't found");
    start();
  });
});

test("#findQuery - smartSearch is disabled by default", function() {
  stop();
  store.findQuery('person', {search: "rmbo"}).then(function(records) {
    ok(false, "Person is found");
    start();
  }, function() {
    ok(true, "Person is found");
    start();
  });

  stop();
  store.findQuery('person', {search: "rao"}).then(function(records) {
    ok(false, "Person is found");
    start();
  }, function() {
    ok(true, "Person is found");
    start();
  });

  stop();
  store.findQuery('person', {search: "rao", cool: true}).then(function(records) {
    ok(false, "Person is found");
    start();
  }, function() {
    ok(true, "Person is found");
    start();
  });
});

module("Integration/DS.IndexedDBAdapter's Search/SmartSearch", {
  setup: function() {
    setup({smartSearch: true});
  },

  teardown: function() {
    Em.run.end();
  }
});

test('#findQuery accepts `search` key with smartSearch', function() {
  expect(3);
  stop();
  store.findQuery('person', {search: /rambo|braddock/i}).then(function(records) {
    equal(get(records, 'length'), 2, 'found results for /rambo|braddock/i');
    start();
  });

  stop();
  store.findQuery('person', {search: /rambo|braddock/i, cool: true}).then(function(records) {
    equal(get(records, 'length'), 1, 'takes into accounts other restrictions');
    start();
  });

  stop();
  store.findQuery('person', {search: /rambo|braddock/i, cool: false}).then(function(records) {
    equal(get(records, 'length'), 1, 'searches string and cool: false');
    start();
  });

});

test('#findQuery - queries with smartSearch enabled', function() {

  stop();
  store.findQuery('person', {search: "rmbo"}).then(function(records) {
    equal(get(records, 'length'), 1, 'searches string and cool: false');
    start();
  }, function() {
    ok(false, "Person is found");
    start();
  });

  stop();
  store.findQuery('person', {search: "rao"}).then(function(records) {
    equal(get(records, 'length'), 2, 'searches "rao"');
    start();
  }, function() {
    ok(false, "Person is found");
    start();
  });

  stop();
  store.findQuery('person', {search: "rao", cool: true}).then(function(records) {
    equal(get(records, 'length'), 1, 'searches "rao" and cool: true');
    start();
  }, function() {
    ok(false, "Person is found");
    start();
  });
});

test('#findQuery with smartSearch - regular searches', function() {
  stop();
  store.findQuery('person', {search: "rmbo"}).then(function(records) {
    equal(get(records, 'length'), 1, 'searches string and cool: false');
    start();
  }, function() {
    ok(false, "Person is found");
    start();
  });

  stop();
  store.findQuery('person', {search: "rao"}).then(function(records) {
    equal(get(records, 'length'), 2, 'searches "rao"');
    start();
  }, function() {
    ok(false, "Person is found");
    start();
  });

  stop();
  store.findQuery('person', {search: "rao", cool: true}).then(function(records) {
    equal(get(records, 'length'), 1, 'searches "rao" and cool: true');
    start();
  }, function() {
    ok(false, "Person is found");
    start();
  });
});

test("#findQuery's dates with smartSearch - querying today", function() {
  stop();
  store.findQuery('person', {createdAt: "today"}).then(function(records) {
    var record = records.objectAt(0);

    equal(records.get('length'), 1, 'Returns only one result');
    equal(record.get('name'), "Billie Jack", 'Today person name');
    start();
  }, function() {
    ok(false, "Today person is found");
    start();
  });
});

test("#findQuery's dates with smartSearch - querying yesterday", function() {
  stop();
  store.findQuery('person', {createdAt: "yesterday"}).then(function(records) {
    var record = records.objectAt(0);

    equal(records.get('length'), 1, '"Yesterday" returns only one result');
    equal(record.get('name'), "Yesterday", 'Yesterday person name');
    start();
  }, function() {
    ok(false, "Yesterday person is found");
    start();
  });
});

test("#findQuery's dates with smartSearch - 45 days ago", function() {
  stop();
  store.findQuery('person', {createdAt: "45 days ago"}).then(function(records) {
    var record = records.objectAt(0);

    equal(records.get('length'), 1, '"45 days ago" returns only one result');
    equal(record.get('name'), "45 days ago", '"45 days ago" person name');
    start();
  }, function() {
    ok(false, "'45 days ago' person is found");
    start();
  });
});

test('#findQuery - overriding Adapter#findQuerySearchCriteria', function() {
  var mock = false;
  expect(3);
  stop();

  Adapter.reopen({
    findQuerySearchCriteria: function(fieldName, type) {
      mock = type;
      return false;
    }
  });
  env = setupStore({ person: App.Person, phone: App.Phone, adapter: Adapter });

  env.store.findQuery('person', {search: /rambo|braddock/i, cool: false}).then(function(records) {
    equal(get(records, 'length'), 4, 'disregards search for all fields');

    ok(mock, "#findQuerySearchCriteria is called");
    equal(mock.toString(), "App.Person", "#findQuerySearchCriteria receives correct type");

    start();
  });
});

