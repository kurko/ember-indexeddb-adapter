// global variables
var get = Ember.get,
    App = {};

var adapter, mock, payload, result, expected,
    databaseName = "AdapterTest";

module('Unit/DS.IndexedDBAdapter', {
  setup: function() {
    stop();
    Ember.run(function() {
      var TestAdapter = DS.IndexedDBAdapter.extend();
      mock = null;

      adapter = TestAdapter.create();
      start();
    });
  }
});

test('#addEmbeddedPayload builds _embedded object', function() {
  var relationshipRecord;

  payload = { id: "1", customer: "2" };
  relationshipRecord = { id: "2", name: "Rambo" };
  expected = {
    id: "1",
    customer: "2",
    _embedded: {
      customer: { id: "2", name: "Rambo" }
    }
  };

  result = adapter.addEmbeddedPayload(payload, 'customer', relationshipRecord);

  deepEqual(result, expected, "Embedded payload has the correct format");
});

test("#addEmbeddedPayload builds _embedded array and repopulates hasMany relation's ids", function() {
  var relationshipRecord;

  payload = { id: "1", customers: ["2"] };
  relationshipRecord = [{ id: "2", name: "Rambo" }, { id: "3", name: "Braddock" }];
  expected = {
    id: "1",
    customers: ["2", "3"],
    _embedded: {
      customers: [{ id: "2", name: "Rambo" }, { id: "3", name: "Braddock" }]
    }
  };

  result = adapter.addEmbeddedPayload(payload, 'customers', relationshipRecord);

  deepEqual(result, expected, "Embedded payload has the correct format");
});

test("#addEmbeddedPayload doesn't delete belongsTo relation on empty array", function() {
  var relationshipRecord;

  payload = { id: "1", customer: "2" };
  relationshipRecord = [];
  expected = { id: "1", customer: "2" };

  result = adapter.addEmbeddedPayload(payload, 'customer', relationshipRecord);

  deepEqual(result, expected, "Embedded payload has the correct format");
});

test("#addEmbeddedPayload doesn't delete hasMany relation on empty array", function() {
  var relationshipRecord, a;

  payload = { id: "1", customers: ["2", a] };
  relationshipRecord = [];
  expected = { id: "1", customers: ["2"] };

  result = adapter.addEmbeddedPayload(payload, 'customers', relationshipRecord);

  deepEqual(result, expected, "Embedded payload has the correct format");
});

test("#addEmbeddedPayload doesn't delete relation on empty relation", function() {
  var relationshipRecord;

  payload = { id: "1", customer: "2" };
  relationshipRecord = {};
  expected = { id: "1", customer: "2" };

  result = adapter.addEmbeddedPayload(payload, 'customer', relationshipRecord);

  deepEqual(result, expected, "Embedded payload has the correct format");
});

test("#addEmbeddedPayload doesn't delete relation when relation has no IDs", function() {
  var relationshipRecord;

  payload = { id: "1", customer: "2" };
  relationshipRecord = { name: "Rambo" };
  expected = { id: "1", customer: "2" };

  result = adapter.addEmbeddedPayload(payload, 'customer', relationshipRecord);

  deepEqual(result, expected, "Embedded payload has the correct format");
});

test("#createRecord should not serialize ID if it's autoIncrement", function() {
  var env, store;
  expect(4);

  stop();
  deleteDatabase(databaseName).then(function() {
    App.Person = DS.Model.extend({ name: DS.attr('string') });
    App.Person.toString = function() { return "App.Person"; }

    return new Ember.RSVP.Promise(function(resolve, reject) {
      var Adapter = DS.IndexedDBAdapter.extend({
        databaseName: databaseName,
        version: 1,
        migrations: function() {
          this.addModel(App.Person, {autoIncrement: true});
          resolve(store);
        }
      });

      env = setupStore({
        person: App.Person,
        adapter: Adapter
      });

      store = env.store;
    });
  }).then(function() {;
    var newPerson = store.createRecord('person', { name: 'Billie Jean' }),
        adapter = store.adapter.create();

    adapter.createRecord(null, App.Person, newPerson).then(function(person) {
      newPerson.deleteRecord();

      return store.findAll('person');
    }).then(function(people) {
      var person1 = people.objectAt(0);

      equal(get(person1, 'id'),   1,             'id is loaded correctly');
      equal(get(person1, 'name'), 'Billie Jean', 'name is loaded correctly');

      newPerson = store.createRecord('person', { name: 'Billie Jeans' })
      return adapter.createRecord(null, App.Person, newPerson)
    }, function() {
      ok(false, "Person is saved");
      start();
    }).then(function(person) {
      newPerson.deleteRecord();

      store.findAll('person').then(function(people) {
        var person1 = people.objectAt(1);

        equal(get(person1, 'id'),   2,             'id is loaded correctly');
        equal(get(person1, 'name'), 'Billie Jeans', 'name is loaded correctly');
        start();
      }, function() {
        ok(false, "Person is saved");
        start();
      });
    });
  });
});
