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

test('#find should find records and then its relations', function() {
  expect(7);

  stop();
  store.find('person', 'p1').then(function(person) {
    equal(get(person, 'id'),   'p1',    'id is loaded correctly');
    equal(get(person, 'name'), 'Rambo', 'name is loaded correctly');
    equal(get(person, 'cool'),  true,   'bool is loaded correctly');
    return person.get('phones');
  }).then(function(phones) {
    var phone1 = phones.get('firstObject'),
        phone2 = phones.get('lastObject');

    equal(get(phone1, 'id'),     'ph1', 'first phone id is loaded correctly');
    equal(get(phone1, 'number'), '11',  'first phone number is loaded correctly');
    equal(get(phone2, 'id'),     'ph2', 'second phone id is loaded correctly');
    equal(get(phone2, 'number'), '22',  'second phone number is loaded correctly');

    start();
  });
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

test('#findQuery should not return anything if nothing is found', function() {
  expect(1);
  stop();
  store.findQuery('person', {whatever: "dude"}).then(function(records) {
    equal(get(records, 'length'), 0, 'didn\'t find results for nonsense');
    start();
  });
});

test('#findQuery should include relationships', function() {
  expect(3);

  stop();

  store.findQuery('person', {name: 'Rambo'}).then(function(records) {
    var rambo = records.objectAt(0),
        phone = rambo.get('phones'),
        phone1 = phone.objectAt(0),
        phone2 = phone.objectAt(1);

    equal(get(records, 'length'), 1, 'found results for name "Rambo"');

    equal(get(phone1, 'number'), 11, 'related phone1 is loaded');
    equal(get(phone2, 'number'), 22, 'related phone2 is loaded');

    start();
  });
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

    phone = store.createRecord('phone', {
      number: 1234,
      person: person
    });

    phone.on('didCreate', function(phone) {
      equal(get(phone, 'id'),     phone.id, 'phone id is loaded correctly');
      equal(get(phone, 'number'), '1234',   'phone number is loaded correctly');

      // TODO this is broken because of Ember Data current bugs
      person = phone.get('person');
      equal(get(person, 'id'), personId, 'person is associated correctly');
      start();
    });

    phone.save();
  });

  person.save();
});

test('#findAll returns all records', function() {
  expect(4);

  stop();
  store.findAll('person').then(function(records) {
    var firstRecord  = records.objectAt(0),
        secondRecord = records.objectAt(1),
        thirdRecord  = records.objectAt(2);

    equal(get(records, 'length'), 3, "3 items were found");

    equal(get(firstRecord,  'name'), "Rambo", "First item's name is one");
    equal(get(secondRecord, 'name'), "Braddock", "Second item's name is two");
    equal(get(thirdRecord,  'name'), "Billie Jack", "Third item's name is three");

    start();
  });
});

test('#updateRecord should update records', function() {
  expect(4);
  stop();
  person = store.createRecord('person', { name: 'Miyagi' });

  var UpdatePerson = function(person) {
    return store.findQuery('person', { name: 'Miyagi' }).then(function(records) {
      var record = records.objectAt(0);
      record.set('name', 'Macgyver');
      return record.save();
    });
  }

  var AssertPersonIsUpdated = function() {
    return store.findQuery('person', { name: 'Macgyver' }).then(function(records) {
      var record = records.objectAt(0);

      equal(get(records, 'length'), 1,         "Only one record was found");
      equal(get(record,  'name'),  "Macgyver", "Updated name shows up");

      ok(get(record,  'id'),    "An actual truthy id was saved");
      equal(get(record,  'id'), person.get('id'), "Original id was used");

      start();
    });
  }

  person.save().then(UpdatePerson)
               .then(AssertPersonIsUpdated);
});

test('#deleteRecord delete a record', function() {
  expect(2);
  stop();
  var AssertPersonIsDeleted = function() {
    return store.findQuery('person', { name: 'Rambo' }).then(function(records) {
      equal(get(records, 'length'), 0, "No record was found");
      start();
    });
  }

  store.findQuery('person', { name: 'Rambo' }).then(function(people) {
    var person = people.objectAt(0);

    equal(get(person, "id"), "p1", "Item exists before deleting it");

    person.deleteRecord();
    person.on("didDelete", AssertPersonIsDeleted);
    person.save();
  });
});

test('changes in bulk', function() {
  stop();
  var promises,
      personToUpdate = store.find('person', 'p1'),
      personToDelete = store.find('person', 'p2'),
      personToCreate = store.createRecord('person', { name: 'Rambo' });

  var UpdatePerson = function(person) {
    person.set('name', 'updated');
    return person;
  }

  var DeletePerson = function(person) {
    person.deleteRecord();
    return person;
  }

  promises = [
    personToCreate,
    personToUpdate.then(UpdatePerson),
    personToDelete.then(DeletePerson),
  ];

  Ember.RSVP.all(promises).then(function(people) {
    promises = Ember.A();

    people.forEach(function(person) {
      promises.push(person.save());
    });

    return promises;
  }).then(function() {
    var updatedPerson = store.find('person', 'p1'),
        createdPerson = store.findQuery('person', {name: 'Rambo'}),
        promises      = Ember.A();

    createdPerson.then(function(people) {
      equal(get(people, 'length'), 1, "Record was created successfully");
      promises.push(Ember.RSVP.Promise());
    });

    store.find('person', 'p2').then(function(person) {
      equal(get(person, 'length'), undefined, "Record was deleted successfully");
      promises.push(Ember.RSVP.Promise());
    });

    updatedPerson.then(function(person) {
      equal(get(person, 'name'), 'updated', "Record was updated successfully");
      promises.push(Ember.RSVP.Promise());
    });

    Ember.RSVP.all(promises).then(function() {
      start();
    });
  });
});

test('#find returns hasMany association', function() {
  stop();
  store.find('person', 'p1').then(function(person) {
    var phones = person.get('phones');
    equal(get(phones, 'length'), 2, "associated phones are loaded successfully");
    start();
  });
});

test('load belongsTo association when {async: false}', function() {
  expect(2);
  stop();
  store.find('phone', 'ph1').then(function(phone) {
    var person = phone.get('person');

    equal(get(person, 'id'),   "p1",    "person id is correct");
    equal(get(person, 'name'), "Rambo", "person name is correct");
    start();
  });
});
