/*global Ember*/
/*global DS*/
'use strict';

/**
 * SmartSearch allows the adapter to make queries that are broader and that
 * will, in most business cases, yield more relevant results.
 *
 * It has a drawback, though: less performant queries. It shouldn't be a problem
 * for smaller data stores.
 */
DS.IndexedDBSmartSearch = Ember.Object.extend({

  field:       null,
  queryString: null,
  record:      null,
  type:        null,

  /**
   * The entrypoint. It tries to match the current query field against the
   * record. See below each query explained.
   *
   * == Search ==
   *
   *     store.findQuery('person', {search: "rao"})
   *
   * This will will search for any field that has the string rao, such as
   * "Rambo".
   *
   * == Search ==
   *
   *     store.findQuery('person', {createdAt: "32 days ago"})
   *
   * Given `createdAt` field has a transform type `date`, it will returns only
   * records that match the 32nd day ago.
   *
   * If the fields doesn't have the `date` transform, nothing is queried.
   *
   * Besides `x days ago`, `today` and `yesterday` are also accepted.
   */
  isMatch: function() {
    var record      = this.get('record'),
        type        = this.get('type'),
        field       = this.get('field'),
        queryString = this.get('queryString'),
        fieldType   = this.fieldType(field),
        queryType;

    if (fieldType === "search") {
      queryType = 'searchField';
    } else if (fieldType === "date") {
      queryType = 'dateField';
    } else {
      queryType = 'regularField';
    }

    return this[queryType](type, record, field, queryString);
  },

  /**
   * Searches for string in any field. Consider the following query:
   *
   *     store.findQuery('person', {search: "rmbo"})
   *
   * This would match a field such as `{name: "Rambo"}`.
   *
   * @method searchField
   */
  searchField: function(type, record, field, queryString) {
    var isMatch;

    for (var queriedField in record) {
      var isSearchField = this.get('fieldSearchCriteria').call(this, queriedField, type),
          fieldValue = record[queriedField];

      if (!isSearchField)
        continue;

      if (!queryString || queryString == " ") { return false; }

      if (Object.prototype.toString.call(queryString).match("RegExp")) {
        isMatch = isMatch || new RegExp(queryString).test(fieldValue);
      } else {
        isMatch = isMatch || (fieldValue === queryString);

        var str,
            strArray = [];

        for (var i = 0, len = queryString.length; i < len; i++) {
          strArray.push(queryString[i]);
        }

        str = new RegExp(strArray.join(".*"), "i");
        isMatch = isMatch || new RegExp(str).test(fieldValue);
      }
    }

    return isMatch;
  },

  dateField: function(type, record, field, queryString) {
    var rawValue = record[field],
        date = (new Date(Date.parse(rawValue))),
        targetDate = new Date(),
        match;

    var IsMatchToDate = function(targetDate) {
      var year   = targetDate.getFullYear(),
          month  = targetDate.getMonth(),
          day    = targetDate.getDate(),
          hour   = targetDate.getHours(),
          minute = targetDate.getMinutes();

      if (date.getFullYear() == year &&
          date.getMonth()    == month &&
          date.getDate()     == day) {
        return true;
      }
    }

    if (queryString === "today") {
      if (IsMatchToDate(targetDate)) {
        return true;
      }
    } else if (queryString === "yesterday") {
      targetDate.setDate(targetDate.getDate() - 1);
      if (IsMatchToDate(targetDate)) {
        return true;
      }
    } else if (match = queryString.match(/([0-9]{1,}) days ago/i)) {
      targetDate.setDate(targetDate.getDate() - match[1]);
      if (IsMatchToDate(targetDate)) {
        return true;
      }
    }

    return false;
  },

  regularField: function(type, record, field, queryString) {
    var queriedField = record[field];

    if (Object.prototype.toString.call(queryString).match("RegExp")) {
      return new RegExp(queryString).test(queriedField);
    } else {
      return (queriedField === queryString);
    }
  },

  fieldType: function(fieldName) {
    if (fieldName === "search") {
      return "search";
    } else {
      var type = this.get('type'),
          transform;

      type.eachTransformedAttribute(function(name, type) {
        if (name == fieldName) {
          transform = type;
        }
      });

      return transform;
    }
  }
});
