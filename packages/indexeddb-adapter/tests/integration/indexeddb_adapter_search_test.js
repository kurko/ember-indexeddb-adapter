var get = Ember.get,
    App = {};

var store, database, databaseName, debugFlag = false, Adapter;

module("Integration/DS.IndexedDBAdapter's Search", {
  setup: function() {
    Em.run.begin();
    var env = {};

    databaseName = "AdapterTest";

    stop();
    deleteDatabase(databaseName).then(function() {
      App.Person = DS.Model.extend({
        name: DS.attr('string'),
        cool: DS.attr('boolean'),
        phones: DS.hasMany('phone')
      });

      App.Phone = DS.Model.extend({
        number: DS.attr('number'),
        person: DS.belongsTo('person')
      });

      App.Person.toString = function() { return "App.Person"; }
      App.Phone.toString  = function() { return "App.Phone"; }

      var migrationsPromise = new Ember.RSVP.Promise(function(resolve, reject) {
        Adapter = DS.IndexedDBAdapter.extend({
          databaseName: databaseName,
          version: 1,
          smartSearch: true,
          migrations: function() {
            var _this = this;
            Em.run(function() {
              _this.addModel(App.Person);
              _this.addModel(App.Phone);
              resolve();
            });
          }
        });

        env = setupStore({
          person: App.Person,
          phone: App.Phone,
          adapter: Adapter
        });

        store = env.store;
      });

      return migrationsPromise;
    }).then(function() {
      return addDataToIDB(databaseName, FIXTURES);
    }).then(function() {
      start();
    });
  },

  teardown: function() {
    Em.run.end();
  }
});

test('#findQuery should find records using queries', function() {
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

test('#findQuery accepts `search` key', function() {
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

test('#findQuery - overriding Adapter#smartSearch', function() {
  stop();
  store.findQuery('person', {search: "rmbo"}).then(function(records) {
    equal(get(records, 'length'), 1, 'searches string and cool: false');
    start();
  }, function() {
    ok(false, "Person is found");
    start();
  });

  stop();
  store.findQuery('person', {search: "ao"}).then(function(records) {
    equal(get(records, 'length'), 2, 'searches "ao"');
    start();
  }, function() {
    ok(false, "Person is found");
    start();
  });

  stop();
  store.findQuery('person', {search: "ao", cool: true}).then(function(records) {
    equal(get(records, 'length'), 1, 'searches "ao" and cool: true');
    start();
  }, function() {
    ok(false, "Person is found");
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
    equal(get(records, 'length'), 2, 'disregards search for all fields');

    ok(mock, "#findQuerySearchCriteria is called");
    equal(mock.toString(), "App.Person", "#findQuerySearchCriteria receives correct type");

    start();
  });
});
