/*global Ember*/
/*global DS*/
'use strict';

DS.IndexedDBSerializer = DS.JSONSerializer.extend({
  /**
   *
   *
   * The payload from the adapter is like this:
   *
   * ```js
   * {
   *   "id": 1,
   *   "title": "Rails Rambo",
   *
   *   "_embedded": {
   *     "comment": [{
   *       "_id": 1,
   *       "comment_title": "FIRST"
   *     }, {
   *       "_id": 2,
   *       "comment_title": "Rails is unagi"
   *     }]
   *   }
   * }
   *
   */
  extractSingle: function(store, type, payload) {
    if (payload._embedded) {
      for (var relation in payload._embedded) {
        var typeName = Ember.String.singularize(relation),
            embeddedPayload = payload._embedded[relation];

        if (embeddedPayload) {
          if (Object.prototype.toString.call(embeddedPayload) === '[object Array]') {
            store.pushMany(typeName, embeddedPayload);
          } else {
            store.push(typeName, embeddedPayload);
          }
        }
      }

      delete payload._embedded;
    }

    return this.normalize(type, payload);
  },

  extractArray: function(store, type, payload) {
    var serializer = this;

    return payload.map(function(record) {
      var extracted = serializer.extractSingle(store, type, record);
      return serializer.normalize(type, record);
    });
  },
});
