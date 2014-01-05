// global variables
var get = Ember.get,
    App = {};

var store, database;

module('Integration/DS.IndexedDBAdapter', {
  setup: function() {
    var env = {};

    //localStorage.setItem('DS.IndexedDBAdapter', JSON.stringify(FIXTURES));

    //database = window.indexedDB.open("AdapterTestDb", 1);

    var Adapter = DS.IndexedDBAdapter.extend({
      databaseName: "AdapterTestDb",
      migration: DS.IndexedDBMigration.create({
        migrations: [
          function() {
          }
        ]
      })
    });

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
