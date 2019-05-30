'use strict';

/**
 * Site.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

// Public dependencies.
const _ = require('lodash');

module.exports = {

  /**
   * Promise to fetch all sites.
   *
   * @return {Promise}
   */

  fetchAll: (params) => {
    const convertedParams = strapi.utils.models.convertParams('site', params);

    //prepare list of response
    let response = {total: 0, list: []};

    return Site
      .find()
      .where(convertedParams.where)
      .sort(convertedParams.sort)
      .populate(_.keys(_.groupBy(_.reject(strapi.models.site.associations, {autoPopulate: false}), 'alias')).join(' ')).count().then(function(count){
          response.total = count;
          return Site
            .find()
            .where(convertedParams.where)
            .sort(convertedParams.sort)
            .skip(convertedParams.start)
            .limit(convertedParams.limit)
            .populate(_.keys(_.groupBy(_.reject(strapi.models.site.associations, {autoPopulate: false}), 'alias')).join(' ')).exec().then(function(items){
              response.list = items;
              return response;
            });
        });
  },

  /**
   * Promise to fetch a/an site.
   *
   * @return {Promise}
   */

  fetch: (params) => {
    return Site
      .findOne(_.pick(params, _.keys(Site.schema.paths)))
      .populate(_.keys(_.groupBy(_.reject(strapi.models.site.associations, {autoPopulate: false}), 'alias')).join(' '));
  },

  /**
   * Promise to find a/an site by ID.
   *
   * @return {Promise}
   */

  findById: (id, withoutAssociations = false) => {
    let associations = (withoutAssociations)? {} : strapi.models.site.associations;

    return Site
      .findOne(_.pick({_id: id}, _.keys(Site.schema.paths)))
      .populate(_.keys(_.groupBy(_.reject(associations, {autoPopulate: false}), 'alias')).join(' '));
  },

  /**
   * Promise to add a/an site.
   *
   * @return {Promise}
   */

  add: async (values) => {
    const query = await Site.create(_.omit(values, _.keys(_.groupBy(strapi.models.site.associations, 'alias'))));
    const data = query.toJSON ? query.toJSON() : query;

    await strapi.hook.mongoose.manageRelations('site', _.merge(data, { values }));

    return query;
  },

  /**
   * Promise to edit a/an site.
   *
   * @return {Promise}
   */

  edit: async (params, values) => {
    // Note: The current method will return the full response of Mongo.
    // To get the updated object, you have to execute the `findOne()` method
    // or use the `findOneOrUpdate()` method with `{ new:true }` option.
    await strapi.hook.mongoose.manageRelations('site', _.merge(_.clone(params), { values }));
    return Site.update(params, values, { multi: true });
  },

  /**
   * Promise to remove a/an site.
   *
   * @return {Promise}
   */

  remove: async params => {
    const site = await strapi.services.site.fetch(params);

    //Try remove dashboard
    const dashboards = site.dashboards || [];
    if (dashboards.length) {
      for (var did = 0; did < dashboards.length; did++) {
        //console.log('Remove dashboard', dashboards[did]._id.toString());
        await strapi.services.dashboard.remove({
          _id: dashboards[did]._id.toString()
        });
      }
    }

    //Try remove gateways
    const gateways = site.gateway || [];
    if (gateways.length) {
      for (var gid = 0; gid < gateways.length; gid++) {
        //console.log('Remove gateway', gateways[gid]._id.toString());
        await strapi.services.gateway.remove({
          _id: gateways[gid]._id.toString()
        });
      }
    }

    //Try remove devices
    const devices = site.devices || [];
    if (devices.length) {
      for (var ddid = 0; ddid < devices.length; ddid++) {
        //console.log('Remove device', devices[ddid]._id.toString());
        await strapi.services.device.remove({
          _id: devices[ddid]._id.toString()
        });
      }
    }

    //Try remove sensors
    const sensors = site.sensors || [];
    if (sensors.length) {
      for (var ssid = 0; ssid < sensors.length; ssid++) {
        //console.log('Remove sensor', sensors[ssid]._id.toString());
        await strapi.services.sensor.remove({
          _id: sensors[ssid]._id.toString()
        });
      }
    }

    // Note: To get the full response of Mongo, use the `remove()` method
    // or add spent the parameter `{ passRawResult: true }` as second argument.
    const data = await Site.findOneAndRemove(params, {})
      .populate(_.keys(_.groupBy(_.reject(strapi.models.site.associations, {autoPopulate: false}), 'alias')).join(' '));

    try {
      _.forEach(Site.associations, async association => {
        const search = (_.endsWith(association.nature, 'One')) ? {
          [association.via]: data._id
        } : {
          [association.via]: {
            $in: [data._id]
          }
        };
        const update = (_.endsWith(association.nature, 'One')) ? {
          [association.via]: null
        } : {
          $pull: {
            [association.via]: data._id
          }
        };

        await strapi.models[association.model || association.collection].update(
          search,
          update, {
            multi: true
          });
      });
    } catch(e) {
      //
    }

    return data;
  }
};
