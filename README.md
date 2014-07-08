Ember Data IndexedDB Adapter
================================

Store your Ember application data offline with IndexedDB.
Compatible with Ember Data 1.0.0-beta7.
Fully tested.

Usage
-----

Download the latest distribution or use bower to install
`ember-indexeddb-adapter`.

```js
App.ApplicationSerializer = DS.IndexedDBSerializer.extend();
App.ApplicationAdapter = DS.IndexedDBAdapter.extend({
  databaseName: 'some_database_name',
  version: 1,
  migrations: function() {
    this.addModel('person');
    this.addModel('phone');
  }
});
```

Define your models relationships with `{async: false}`.
All relationships are retrieved automatically in a query. Just do the regular:

```js
App.Person = DS.Model.extend({
  name: DS.attr('string'),
  phones: DS.hasMany('phone') // no {async: true} calls here.
});
```

**Note:** use a string as parameter for `this.addModel('person')`.

### Version and Migrations

Different from localStorage, IndexedDB requires you to define the Object Stores
you'll use (think of them like database table). By defining the models to be used
inside the adapter's `migrations` function, it'll update the schema whenever
needed.

Remember that whenever you want to update this schema, you need to
increment the version number (integer). Only so will IndexedDB commit the
changes.

### KeyPath and autoIncrement

By default, the `keyPath` (id field) is `id` and `autoIncrement` is set to
false. You can change these doing this:

```js
// inside migrations function
this.addModel('person', {keyPath: 'id', autoIncrement: true});
```

**Important**: if you define `autoIncrement: true`, we won't use Ember's
provided ID, but simply throw away it with `record.serialize({includeId: false})`.
If you don't know what you're doing, just leave it as `false` so Ember Data can
take care of the ID for you.

## SmartSearch feature

SmartSearch (disabled by default) allows you to make more meaningful queries,
ones that you would probably perform against a REST api. With it, you will
be able to do the following queries.

#### Dates

If you have a field with a `date` transform, the adapter will try to match
the records that match a given date.

```js
App.Person = DS.Model.extend({
  name: DS.attr('string'),
  createdAt: DS.attr('date')
});

// Date matches
store.findQuery('person', {createdAt: "today"})
store.findQuery('person', {createdAt: "yesterday"})
store.findQuery('person', {createdAt: "32 days ago"})
```

#### Full-text search

Whenever you use a `search` key in your query, the adapter will try to match it
against all fields. Consider the database has the following:

```js
[ { id: 1, name: "Rambo",    cool: false },
  { id: 2, name: "Braddock", cool: true  } ]
```

The following will match different results:

```js
// returns only the first record
store.findQuery('person', {search: /rambo|braddock/i, cool: false})
// returns only the first record
store.findQuery('person', {search: "rmb", cool: false})
// returns both records
store.findQuery('person', {search: "ao"})
// returns only the last record
store.findQuery('person', {search: "ao", cool: true})
```

The adapter will try matching the `search` value against every record using
`AND` logic. In some cases above, although name was matched, `cool`
didn't match.

You can change the fields that are searched reopening the method that defines if
a field is to be searched:

```js
DS.IndexedDBAdapter.reopen({
  findQuerySearchCriteria: function(fieldName, type) {
    if (type.toString() == "App.User" && fieldName == "name") {
      return false;
    } else {
      return true;
    }
  }
});
```

With the redefinition above, the search will try to match every field, except
`App.User`'s `name`.

### Enabling SmartSearch

If you want to enable `smartSearch`, write this:

```js
DS.IndexedDBAdapter.reopen({
  smartSearch: true
});
```

Building from source
-----

In the root folder, type in your terminal `rake build`. Make sure you have
Ruby installed. The file is generated in `dist/`.

Areas for improvement
-----

The following are areas that needs some improvements. We'd love if you could
send a PR for one of them.

* smarter transactions: we open a transaction, get some stuff, then close it
  and move on. However, if we're going to load a relationship next, it happens
  in a new transaction. It should all happen in one transaction.
* indexes: as of now, there is no migrations API for creating indexes.
* search: there's no way to do a fuzzy search with IndexedDB (besides the basic
  string match). Right now, we go through all records matching them, but later
  we'll want to create an objectStore to cache all strings with the original
  record ID. That way we'd be able to cut down the amount of data we put in
  memory.

Tests
-----

First, install depdendencies with bower: `bower install`.

Run `rackup` in your terminal (make sure you have Ruby and the rack gem installed).
Then visit `http://localhost:9292` in your browser.

Please, disregard Travis CI for now because PhantomJS (1.9.3) doesn't support
IndexedDB. IndexedDBShim.js doesn't work
on it either, so I'm running tests only in the browser for now. Once version 2
is here, just use `phantomjs tests/runner.js tests/index.html` in your terminal.

License & Copyright
-------------------

Copyright (c) 2014 Alexandre de Oliveira
MIT Style license. http://opensource.org/licenses/MIT
