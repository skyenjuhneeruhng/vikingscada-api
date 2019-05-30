'use strict';

/**
 * Data.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

// Public dependencies.
const _ = require('lodash');

module.exports = {

  /**
   * Promise to fetch all data.
   *
   * @return {Promise}
   */

  fetchAll: (params) => {
    const convertedParams = strapi.utils.models.convertParams('data', params);

    return Data
      .find()
      .where(convertedParams.where)
      .sort(convertedParams.sort)
      .skip(convertedParams.start)
      .limit(convertedParams.limit)
      .populate(_.keys(_.groupBy(_.reject(strapi.models.data.associations, {autoPopulate: false}), 'alias')).join(' '));
  },

  /**
   * Promise to fetch a/an data.
   *
   * @return {Promise}
   */

  fetch: (params) => {
    return Data
      .findOne(_.pick(params, _.keys(Data.schema.paths)))
      .populate(_.keys(_.groupBy(_.reject(strapi.models.data.associations, {autoPopulate: false}), 'alias')).join(' '));
  },

  /**
   * Add value for sensor
   * 
   * @return {Promise}
   */
  createValue: async (sensor_id, value, bitmask = false) => {
    let data = (bitmask) ? {
      sensor_id: sensor_id,
      bitmask: value
    } : {
      sensor_id: sensor_id,
      value: value
    };

    //Check sensor
    let sensor = await strapi.services.sensor.fetch({
      _id: sensor_id
    });
    if(!sensor)
      return false;

    await strapi.services.data.add(data);

    return true;
  },

  /**
   * Promise to add a/an data.
   *
   * @return {Promise}
   */

  add: async (values) => {
    const query = await Data.create(_.omit(values, _.keys(_.groupBy(strapi.models.data.associations, 'alias'))));
    const data = query.toJSON ? query.toJSON() : query;

    await strapi.hook.mongoose.manageRelations('data', _.merge(data, { values }));

    return query;
  },

  /**
   * Promise to edit a/an data.
   *
   * @return {Promise}
   */

  edit: async (params, values) => {
    // Note: The current method will return the full response of Mongo.
    // To get the updated object, you have to execute the `findOne()` method
    // or use the `findOneOrUpdate()` method with `{ new:true }` option.
    await strapi.hook.mongoose.manageRelations('data', _.merge(_.clone(params), { values }));
    return Data.update(params, values, { multi: true });
  },

  /**
   * Promise to remove a/an data.
   *
   * @return {Promise}
   */

  remove: async params => {
    // Note: To get the full response of Mongo, use the `remove()` method
    // or add spent the parameter `{ passRawResult: true }` as second argument.
    const data = await Data.findOneAndRemove(params, {})
      .populate(_.keys(_.groupBy(_.reject(strapi.models.data.associations, {autoPopulate: false}), 'alias')).join(' '));

    _.forEach(Data.associations, async association => {
      const search = (_.endsWith(association.nature, 'One')) ? { [association.via]: data._id } : { [association.via]: { $in: [data._id] } };
      const update = (_.endsWith(association.nature, 'One')) ? { [association.via]: null } : { $pull: { [association.via]: data._id } };

      await strapi.models[association.model || association.collection].update(
        search,
        update,
        { multi: true });
    });

    return data;
  }
};
