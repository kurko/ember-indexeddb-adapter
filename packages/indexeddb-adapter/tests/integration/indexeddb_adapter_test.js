// global variables
var get = Ember.get,
    App = {};

var store, database, databaseName;

module('Integration/DS.IndexedDBAdapter', {
  setup: function() {
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
        var Adapter = DS.IndexedDBAdapter.extend({
          databaseName: databaseName,
          version: 1,
          migrations: function() {
            this.addModel(App.Person);
            this.addModel(App.Phone);
            resolve();
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
  }
});

test('existence', function() {
  ok(DS.IndexedDBAdapter, 'Adapter is defined');
});

test('#find should find records and then its relations asynchronously', function() {
  expect(3);

  stop();
  store.find('person', 'p1').then(function(person) {
    equal(get(person, 'id'),   'p1',    'id is loaded correctly');
    equal(get(person, 'name'), 'Rambo', 'name is loaded correctly');
    equal(get(person, 'cool'),  true,   'bool is loaded correctly');
    start();
    //return person.get('phones');
  });
  /*
  .then(function(items) {
    var item1 = items.get('firstObject'),
        item2 = items.get('lastObject');

    equal(get(item1, 'id'),   'i1',  'first item id is loaded correctly');
    equal(get(item1, 'name'), 'one', 'first item name is loaded correctly');
    equal(get(item2, 'id'),   'i2',  'first item id is loaded correctly');
    equal(get(item2, 'name'), 'two', 'first item name is loaded correctly');

    start();
  });
 */
});

test('#createRecord should create records', function() {
  expect(3);

  stop();
  var person = store.createRecord('person', {
    name: 'Billie Jean',
    cool: true
  });

  person.on('didCreate', function(savedPerson) {
    var id = savedPerson.get('id');

    store.find('person', id).then(function(person) {
      equal(get(person, 'id'),   id,            'id is loaded correctly');
      equal(get(person, 'name'), 'Billie Jean', 'name is loaded correctly');
      equal(get(person, 'cool'),  true,         'bool is loaded correctly');
      start();
    });
  });

  person.save();
});

test('#createRecord should include relationships', function() {
  var person, phone;
  expect(3);

  stop();
  person = store.createRecord('person', {
    name: 'Billie Jean',
    cool: true
  });

  person.on('didCreate', function(person) {
    var personId = person.get('id');

    cl(person);
    phone = store.createRecord('phone', {
      number: 1234,
      person: person
    });

    phone.on('didCreate', function(phone) {
      equal(get(phone, 'id'),     phone.id, 'phone id is loaded correctly');
      equal(get(phone, 'number'), '1234',   'phone number is loaded correctly');

      cl(phone.get('person'));
      person = phone.get('person');
      equal(get(person, 'id'), personId, 'person is associated correctly');
      start();
    });

    phone.save();
  });

  person.save();
});
