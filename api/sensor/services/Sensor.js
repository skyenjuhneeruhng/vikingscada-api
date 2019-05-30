'use strict';

/**
 * Sensor.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

// Public dependencies.
const _ = require('lodash');

module.exports = {

  /**
   * Get bit from number
   *
   * @return {Promise}
   */
  getBit: (number, position = 0) => {
    let bitStr = Number(number).toString(2);
    let bitArray = bitStr.split('');

    //Reverse
    bitArray = bitArray.reverse();

    let result = bitArray[position] || 0;

    return parseInt(result);
  },

  /**
   * Prepare value of stream by bitmask or multiplier
   *
   * @return {Promise}
   */

  parseValue: async (sensor_id, value) => {
    var result = {
      bitmask: false,
      value: value
    };

    const sensor = await strapi.services.sensor.fetch({
      _id: sensor_id
    });
    if(!sensor)
      return result;

    if (sensor.bitmask){
      result.bitmask = true;
      result.value = [];

      let bitmask = sensor.bitmask.split(',');
      for(var i = 0; i < bitmask.length; i++){
        let position = bitmask[i];

        //Prepare bitmask
        let newValue = {};

        newValue[position + ''] = strapi.services.sensor.getBit(value, position);
        result.value.push(newValue);
      }
    } else {
      if (sensor.value_multiplier)
        result.value = parseInt(result.value) * sensor.value_multiplier;

      if (typeof sensor.engineer_value_from === typeof 1 && typeof sensor.engineer_value_to === typeof 1) {
        const engineer_condition = parseInt(sensor.engineer_value_to) - parseInt(sensor.engineer_value_from);
        const point = 4096 / engineer_condition;
        let engineer_value = parseFloat(result.value / point).toFixed(3);

        //Fix min range 
        engineer_value = parseFloat(engineer_value) + parseInt(sensor.engineer_value_from);

        if (engineer_value <= 0)
          result.value = sensor.engineer_value_from;
        else
        if (engineer_value >= parseInt(sensor.engineer_value_to))
          result.value = sensor.engineer_value_to;
        else
          result.value = parseFloat(engineer_value).toFixed(3);

        result.value = parseFloat(result.value);
      }
    }

    return result;
  },

  /**
   * Promise to fetch all sensors.
   *
   * @return {Promise}
   */

  getSensors: () => {
    const convertedParams = strapi.utils.models.convertParams('sensor', {});

    return Sensor
      .find()
      .where(convertedParams.where)
      .sort(convertedParams.sort)
      .populate('');
  },

  /**
   * Promise to fetch all sensors.
   *
   * @return {Promise}
   */

  fetchAll: (params) => {
    const convertedParams = strapi.utils.models.convertParams('sensor', params);

    //prepare list of response
    let response = {total: 0, list: []};

    return Sensor
      .find()
      .where(convertedParams.where)
      .sort(convertedParams.sort)
      .populate(_.keys(_.groupBy(_.reject(strapi.models.sensor.associations, {autoPopulate: false}), 'alias')).join(' ')).count().then(function(count){
        response.total = count;
        return Sensor
          .find()
          .where(convertedParams.where)
          .sort(convertedParams.sort)
          .skip(convertedParams.start)
          .limit(convertedParams.limit)
          .populate(_.keys(_.groupBy(_.reject(strapi.models.sensor.associations, {autoPopulate: false}), 'alias')).join(' ')).exec().then(async function(items){
            for (var i = 0; i < items.length; i++){
              if (items[i].device && items[i].device.gateway)
                items[i].device.gateway = await strapi.services.gateway.findByID(items[i].device.gateway);
            }

            response.list = items;
            return response;
          });
      });
  },

  /**
   * Promise to fetch a/an sensor.
   *
   * @return {Promise}
   */

  fetch: (params) => {
    return Sensor
      .findOne(_.pick(params, _.keys(Sensor.schema.paths)))
      .populate(_.keys(_.groupBy(_.reject(strapi.models.sensor.associations, {autoPopulate: false}), 'alias')).join(' '));
  },

  /**
   * Promise to add a/an sensor.
   *
   * @return {Promise}
   */

  add: async (values) => {
    const query = await Sensor.create(_.omit(values, _.keys(_.groupBy(strapi.models.sensor.associations, 'alias'))));
    const data = query.toJSON ? query.toJSON() : query;

    await strapi.hook.mongoose.manageRelations('sensor', _.merge(data, { values }));

    return query;
  },

  /**
   * Promise to edit a/an sensor.
   *
   * @return {Promise}
   */

  edit: async (params, values) => {
    // Note: The current method will return the full response of Mongo.
    // To get the updated object, you have to execute the `findOne()` method
    // or use the `findOneOrUpdate()` method with `{ new:true }` option.
    await strapi.hook.mongoose.manageRelations('sensor', _.merge(_.clone(params), { values }));
    return Sensor.update(params, values, { multi: true });
  },

  /**
   * Promise to remove a/an sensor.
   *
   * @return {Promise}
   */

  remove: async params => {
    // Note: To get the full response of Mongo, use the `remove()` method
    // or add spent the parameter `{ passRawResult: true }` as second argument.
    const data = await Sensor.findOneAndRemove(params, {})
      .populate(_.keys(_.groupBy(_.reject(strapi.models.sensor.associations, {autoPopulate: false}), 'alias')).join(' '));

    _.forEach(Sensor.associations, async association => {
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
