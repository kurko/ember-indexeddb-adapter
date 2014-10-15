// global variables
var get = Ember.get,
    App = {};

var subject, modelDouble, mock, payload, result, expected, storeDouble;

module('Unit/DS.IndexedDBSerializer', {
  setup: function() {
    stop();
    Ember.run(function() {
      storeDouble = { push: function() {}, pushMany: function() {}, modelFor: function () {} };
      modelDouble = { relationshipsByName: ["comments", "readers"] };

      subject = DS.IndexedDBSerializer.create({
        normalize: function(type, payload) {
          return payload;
        }
      });
      mock = null;
      start();
    });
  }
});

test('#extractSingle - builds relationships and pushes them to the store', function() {
  payload = {
    id: "1",
    comments: ["2"],
    _embedded: {
      comments: { id: "2", name: "Rambo" }
    }
  };

  expected = {
    id: "1",
    comments: ["2"]
  };

  equal(mock, null, "mock initialized");
  storeDouble.push = function() { mock = "Pushed to store!"; }
  result = subject.extractSingle(storeDouble, modelDouble, payload);

  equal(mock, "Pushed to store!", "the associations are pushed to the store");
  deepEqual(result, expected, "Result payload has the correct format");
});
