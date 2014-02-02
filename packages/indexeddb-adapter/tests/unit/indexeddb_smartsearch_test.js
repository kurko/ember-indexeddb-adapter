// global variables
var get = Ember.get,
    App = {};

var subject, mock, payload, result, expected;

module('Unit/DS.IndexedDBSmartSearch', {
  setup: function() {
    stop();
    Ember.run(function() {
      var SS = DS.IndexedDBSmartSearch.extend();
      mock = null;

      subject = SS.create();
      start();
    });
  }
});

var findQueryMatch = function(query, string) {
  result = subject.searchField(query, string);
  ok(result, "'"+query+"' in '"+string+"'");
}
var findQueryNoMatch = function(query, string) {
  result = subject.searchField(query, string);
  ok(!result, "'"+query+"' not found in '"+string+"'");
}

pending("#searchField's matches", function() {
  findQueryMatch("rambo", "John Rambo");
  findQueryMatch("ram", "John Rambo");
  findQueryMatch("m", "John Rambo");
  findQueryMatch("ohm", "John Rambo");

  findQueryNoMatch("boj", "John Rambo");
  findQueryNoMatch(" ", "John Rambo");
  findQueryNoMatch("  ", "John Rambo");
  findQueryNoMatch(" l ", "John Rambo");
  findQueryNoMatch("", "John Rambo");
});
