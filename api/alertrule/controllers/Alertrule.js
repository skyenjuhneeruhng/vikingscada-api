'use strict';

/**
 * Alertrule.js controller
 *
 * @description: A set of functions called "actions" for managing `Alertrule`.
 */

module.exports = {

  /**
   * Retrieve alertrule records.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    return strapi.services.alertrule.fetchAll(ctx.query);
  },

  /**
   * Retrieve a alertrule record.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    return strapi.services.alertrule.fetch(ctx.params);
  },

  /**
   * Create a/an alertrule record.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    return strapi.services.alertrule.add(ctx.request.body);
  },

  /**
   * Update a/an alertrule record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    return strapi.services.alertrule.edit(ctx.params, ctx.request.body) ;
  },

  /**
   * Destroy a/an alertrule record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    return strapi.services.alertrule.remove(ctx.params);
  }
};
