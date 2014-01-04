/*global Ember*/
/*global DS*/
'use strict';

DS.IndexedDBAdapter = DS.Adapter.extend({
  /**
    @method find
    @param {DS.Model} type
    @param {Object|String|Integer|null} id
    */
  find: function (store, type, id) {
    var record = Ember.A();

    return Ember.RSVP.resolve(record);
  },

  findMany: function (store, type, ids) {
    var records = Ember.A();

    return Ember.RSVP.resolve(record);
  },

  findQuery: function (store, type, query, recordArray) {
    var records = Ember.A();

    return Ember.RSVP.resolve(records);
  },

  findAll: function (store, type) {
    var records = Ember.A();

    return Ember.RSVP.resolve(records);
  },

  createRecord: function (store, type, record) {
    return Ember.RSVP.resolve(record);
  },

  updateRecord: function (store, type, record) {
    return Ember.RSVP.resolve();
  },

  deleteRecord: function (store, type, record) {
    return Ember.RSVP.resolve();
  },

  generateIdForRecord: function () {
    return Math.random().toString(32).slice(2).substr(0, 5);
  }
});
