var get = Ember.get,
    App = {};

var store, database, databaseName, debugFlag = false, Adapter;

module('Integration/DS.IndexedDBAdapter', {
  setup: function() {
    Em.run.begin();
    var env = {};

    databaseName = "AdapterTest";

    stop();
    deleteDatabase(databaseName).then(function() {
      App.Person = DS.Model.extend({
        name: DS.attr('string'),
        cool: DS.attr('boolean'),
        phones: DS.hasMany('phone'),
        createdAt: DS.attr('date')
      });

      App.Phone = DS.Model.extend({
        number: DS.attr('number'),
        person: DS.belongsTo('person')
      });


      App.ApplicationSerializer = DS.IndexedDBSerializer.extend();

      var migrationsPromise = new Ember.RSVP.Promise(function(resolve, reject) {
        Adapter = DS.IndexedDBAdapter.extend({
          databaseName: databaseName,
          version: 1,
          migrations: function() {
            var _this = this;
            Em.run(function() {
              _this.addModel('person');
              _this.addModel('phone');
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

test('existence', function() {
  ok(DS.IndexedDBAdapter, 'Adapter is defined');
});

test('#find should find records and then its relations', function() {
  expect(9);

  stop();
  store.find('person', 'p1').then(function(person) {
    equal(get(person, 'id'),   'p1',    'id is loaded correctly');
    equal(get(person, 'name'), 'Rambo', 'name is loaded correctly');
    equal(get(person, 'cool'),  true,   'bool is loaded correctly');
    deepEqual(get(person, 'createdAt'),  new Date("2013-01-02T16:44:57.000Z"), 'date is loaded correctly');
    return person.get('phones');
  }).then(function(phones) {
    var phone1 = phones.get('firstObject'),
        phone2 = phones.get('lastObject');

    equal(get(phones, 'length'), 2,     'person has 2 phones');

    if (phones.get("length") == 2) {
      equal(get(phone1, 'id'),     'ph1', 'first phone id is loaded correctly');
      equal(get(phone1, 'number'), '11',  'first phone number is loaded correctly');
      equal(get(phone2, 'id'),     'ph2', 'second phone id is loaded correctly');
      equal(get(phone2, 'number'), '22',  'second phone number is loaded correctly');
    }

    start();
  });
});

test('#find - promise is rejected when nothing is found', function() {
  expect(1);
  stop();
  store.find('person', 'blabla').then(function() {
    ok(false, "Item is not found");
  }, function() {
    ok(true, "Item is not found");
    start();
  });
});

test("#find - disregards associated records that don't exist anymore", function() {
  var transaction, objectStore, operation;
  stop();

  openDatabase(databaseName).then(function(db) {
    transaction = db.transaction("phone", "readwrite");
    objectStore = transaction.objectStore("phone");
    operation = objectStore.delete("ph1");
    operation = objectStore.delete("ph2");

    return new Ember.RSVP.Promise(function(resolve, reject) {
      operation.onsuccess = function(event) {
        Em.run(function() {
          db.close();
          resolve();
        });
      };
    });
  }).then(function() {
    return openDatabase(databaseName);
  }).then(function(db) {
    transaction = db.transaction("person");
    objectStore = transaction.objectStore("person");

    operation = objectStore.get("p1");
    return new Ember.RSVP.Promise(function(resolve, reject) {
      operation.onsuccess = function(event) {
        var record = this.result;
        Em.run(function() {
          db.close();
          resolve(record);
        });
      }
    });
  }).then(function(personFromDB) {
    equal(personFromDB.phones[0], "ph1", "person's phone1 association is still there");
    equal(personFromDB.phones[1], "ph2", "person's phone2 association is still there");
    return Ember.RSVP.resolve();
  }).then(function() {
    return store.find('person', 'p1');
  }).then(function(person) {
    equal(person.get('phones.length'), 0, "person has only no phone now");
    start();
  });
});

test('#findQuery should find records using queries', function() {
  /**
   * more extensive tests under integration/indexeddb_adapter_search_test.js
   */
  expect(1);

  stop();
  store.findQuery('person', {name: /rambo|braddock/i}).then(function(records) {
    equal(get(records, 'length'), 2, 'found results for /rambo|braddock/i');
    start();
  });
});

test('#findQuery should not return anything if nothing is found', function() {
  expect(1);
  stop();
  store.findQuery('person', {whatever: "dude"}).then(function() {
    ok(false, "No item is found");
  }, function() {
    ok(true, "No item is found");
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

  Em.run(function() {
    person.save();
  });
});

test('#createRecord should save hasMany relationships', function() {
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

      person = phone.get('person');
      equal(get(person, 'id'), personId, 'person is associated correctly');
      start();
    });

    Em.run(function() {
      phone.save();
    });
  });

  Em.run(function() {
    person.save();
  });
});

/**
 * Saving embedded relations will create a lot of complexity. It's not
 * something even the official adapters are doing right now.
 */
 /*
pending('#createRecord should save embedded relations', function() {
  var person, phone;
  expect(5);

  Em.run(function() {
    stop();
    phone = store.createRecord('phone', { number: 1234 })
    person = store.createRecord('person', { name: 'Billie Jean', cool: true });

    equal(person.get('phones.length'), 0, "person has no phone");
    person.get('phones').pushObject(phone);
    equal(person.get('phones.length'), 1, "person has one phone");

    person.save().then(function() {
      return store.findQuery('person', {name: "Billie Jean"});
    }).then(function(person) {
      equal(get(person, 'phones.length'), 1, 'there is 1 phone after save');

      var phone = person.get('phones.firstObject');

      equal(get(phone, 'id'),     phone.id, 'phone id is created correctly');
      equal(get(phone, 'number'), 1234,     'phone number is saved correctly');

      start();
    });
  });
});
 */
test("#save doesn't lose or duplicate relationships from the store", function() {
  var phone, person;

  stop();
  Em.run(function() {
    person = store.createRecord('person', { name: "Clint", cool: true });
    phone = store.createRecord('phone', { number: 1234 });
    equal(person.get('phones.length'), 0, "person has 0 phones initially");

    person.get('phones').pushObject(phone);
    equal(person.get('phones.length'), 1, "person has 1 phone after pushing relation");

    person.save().then(function(person) {
      equal(person.get('phones.length'), 1, "person has 1 phone after saving");

      return phone.save();
    }).then(function(phone) {
      equal(person.get('phones.length'), 1, "person has phones before it's saved");

      person.save().then(function(savedPerson) {
        return savedPerson.reload();
      }).then(function(savedPerson) {
        equal(savedPerson.get('phones.length'), 1, "person has phones after being saved");
        start();
      });
    });
  });
});

test("#createRecord - save shouldn't lose relationships", function() {
  var person, phone;
  expect(8);

  stop();
  store.find('person', 'p1').then(function(person) {
    equal(get(person, 'id'),   'p1',    'id is loaded correctly');
    equal(get(person, 'name'), 'Rambo', 'name is loaded correctly');

    var phones = person.get('phones'),
        phone1 = phones.get('firstObject'),
        phone2 = phones.get('lastObject');

    equal(get(phone1, 'number'), '11',  'first phone number is loaded correctly');
    equal(get(phone2, 'id'),     'ph2', 'second phone id is loaded correctly');

    person.save().then(function(person) {
      equal(get(person, 'id'),   'p1',    'id is loaded correctly');
      equal(get(person, 'name'), 'Rambo', 'name is loaded correctly');

      var phones = person.get('phones'),
          phone1 = phones.get('firstObject'),
          phone2 = phones.get('lastObject');

      equal(get(phone1, 'number'), '11',  'first phone number is loaded correctly');
      equal(get(phone2, 'id'),     'ph2', 'second phone id is loaded correctly');

      start();
    });
  });
});

test("#save doesn't exclude relationships from the store", function() {
  stop();
  Em.run(function() {
    person = store.createRecord('person', { name: "Clint", cool: true });
    phone  = store.createRecord('phone', { number: 1234 });

    person.save().then(function(person) {
      equal(person.get('phones.length'), 0, "person has no phones initialy");

      person.get('phones').pushObject(phone);

      return Ember.RSVP.resolve(person);
    }).then(function(person) {
      equal(person.get('phones.length'), 1, "person has phones before it's saved");
      person.save().then(function(savedPerson) {
        return savedPerson.reload();
      }).then(function(savedPerson) {
        equal(savedPerson.get('phones.length'), 1, "person has phones after being saved");
        start();
      });
    });
  });
});

test('#findAll returns all records', function() {
  expect(5);

  stop();
  store.findAll('person').then(function(records) {
    var firstRecord  = records.objectAt(0),
        secondRecord = records.objectAt(1),
        thirdRecord  = records.objectAt(2);

    equal(get(records, 'length'), 5, "5 items were found");

    equal(get(firstRecord,  'name'), "Rambo", "First item's name is one");
    equal(get(secondRecord, 'name'), "Braddock", "Second item's name is two");
    equal(get(thirdRecord,  'name'), "Billie Jack", "Third item's name is three");

    deepEqual(get(firstRecord, 'createdAt'), new Date("2013-01-02T16:44:57.000Z"), "First item's date is loaded");

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

  Em.run(function() {
    person.save().then(UpdatePerson)
                 .then(AssertPersonIsUpdated);
  });
});

test('#deleteRecord - deletes a parent record', function() {
  expect(2);
  stop();
  var AssertPersonIsDeleted = function() {
    return store.findQuery('person', { name: 'Rambo' }).then(function(records) {
      ok(false, "Item was deleted");
      start();
    }, function() {
      ok(true, "Item was deleted");
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

test('#deleteRecord - deletes an associated record and updates the parent', function() {
  stop();

  store.find('person', 'p1').then(function(person) {
    equal(person.get('phones.length'), 2, "person has 2 phones initially");

    return store.find('phone', 'ph1');
  }).then(function(phone) {
    phone.deleteRecord();

    return store.find('person', 'p1');
  }).then(function(person) {
    equal(person.get('phones.length'), 1, "person has only 1 phone now");
    start();
  });
});

test('changes in bulk', function() {
  Em.run(function() {
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
      Em.run(function() {
        var updatedPerson = store.find('person', 'p1'),
            createdPerson = store.findQuery('person', {name: 'Rambo'});
            promises      = [];

        promises.push(new Ember.RSVP.Promise(function(resolve, reject) {
          createdPerson.then(function(people) {
            equal(get(people, 'length'), 1, "Record was created successfully");
            resolve();
          });
        }));

        promises.push(new Ember.RSVP.Promise(function(resolve, reject) {
          store.find('person', 'p2').then(function(person) {
            equal(get(person, 'length'), undefined, "Record was deleted successfully");
            resolve();
          });
        }));

        promises.push(new Ember.RSVP.Promise(function(resolve, reject) {
          updatedPerson.then(function(person) {
            equal(get(person, 'name'), 'updated', "Record was updated successfully");
            resolve();
          });
        }));

        Ember.RSVP.all(promises).then(function() {
          start();
        });
      });
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
  expect(3);
  stop();
  store.find('phone', 'ph1').then(function(phone) {
    var person = phone.get('person');

    equal(get(person, 'id'),   "p1",    "person id is correct");
    equal(get(person, 'name'), "Rambo", "person name is correct");
    deepEqual(get(person, 'createdAt'),  new Date("2013-01-02T16:44:57.000Z"), 'date is correct');
    start();
  });
});
