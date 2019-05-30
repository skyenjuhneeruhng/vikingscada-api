'use strict';

/**
 * Data.js controller
 *
 * @description: A set of functions called "actions" for managing `Data`.
 */

const _ = require('lodash');

module.exports = {

  /**
   * Retrieve data records.
   *
   * @return {Object|Array}
   */

  getSensorStatistic: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }
    
    //Get sensor
    let sensor = await strapi.services.sensor.fetch({
      _id: ctx.params._id
    });
    if(!sensor)
      return ctx.notFound();
  
    //Prepare from and to filters
    let to = (new Date(ctx.query.to) instanceof Date && !isNaN(new Date(ctx.query.to))) ? new Date(ctx.query.to) : new Date();
    let from = (new Date(ctx.query.from) instanceof Date && !isNaN(new Date(ctx.query.from))) ? new Date(ctx.query.from) : new Date(to.getTime() - 60 * 60000);

    //Prepare query
    let query = {
      createdAt_gte: from,
      createdAt_lte: to,
      sensor_id: sensor._id.toString()
    };

    if (ctx.query._start)
      query._start = ctx.query._start;

    if (ctx.query._limit)
      query._limit = ctx.query._limit;

    return strapi.services.data.fetchAll(query);
  },

  /**
   * Retrieve data records.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    return strapi.services.data.fetchAll(ctx.query);
  },

  /**
   * Retrieve a data record.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    return strapi.services.data.fetch(ctx.params);
  },

  /**
   * Create a/an data record.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    return strapi.services.data.add(ctx.request.body);
  },

  /**
   * Update a/an data record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    return strapi.services.data.edit(ctx.params, ctx.request.body) ;
  },

  /**
   * Destroy a/an data record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    return strapi.services.data.remove(ctx.params);
  }
};
