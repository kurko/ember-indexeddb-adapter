// global variables
var get = Ember.get,
    App = {};

var store;

module('DS.IndexedDBAdapter', {
  setup: function() {
    //localStorage.setItem('DS.IndexedDBAdapter', JSON.stringify(FIXTURES));
    var env = {};

    App.Person = DS.Model.extend({
      name: DS.attr('string'),
      cool: DS.attr('boolean'),
      phones: DS.hasMany('phone', {async: true})
    });

    App.Phone = DS.Model.extend({
      number: DS.attr('number'),
      person: DS.belongsTo('person', {async: true})
    });

    env = setupStore({
      person: App.Person,
      phone: App.Phone,
      adapter: DS.IndexedDBAdapter
    });
    store = env.store;
  }
});

test('existence', function() {
  ok(DS.IndexedDBAdapter, 'Adapter is defined');
});
