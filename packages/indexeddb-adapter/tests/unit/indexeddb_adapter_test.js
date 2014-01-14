// global variables
var get = Ember.get,
    App = {};

var adapter, mock, payload, result, expected;

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
