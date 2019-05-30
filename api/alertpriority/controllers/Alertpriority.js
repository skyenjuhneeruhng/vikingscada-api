'use strict';

/**
 * Alertpriority.js controller
 *
 * @description: A set of functions called "actions" for managing `Alertpriority`.
 */

module.exports = {

  /**
   * Retrieve voice priority
   *
   * @return {Object|Array}
   */

  getVoicePriority: async (ctx) => {
    return strapi.services.alertpriority.getPriority(ctx, 'voice');
  },

  /**
   * Retrieve sms priority
   *
   * @return {Object|Array}
   */

  getSMSPriority: async (ctx) => {
    return strapi.services.alertpriority.getPriority(ctx, 'sms');
  },

  /**
   * Retrieve email priority
   *
   * @return {Object|Array}
   */

  getEmailPriority: async (ctx) => {
    return strapi.services.alertpriority.getPriority(ctx, 'email');
  },

  /**
   * Enable voice priority for user
   *
   * @return {Object|Array}
   */

  enableVoicePriority: async (ctx) => {
    return strapi.services.alertpriority.activatePriority(ctx, 'voice', true);
  },

  /**
   * Disable voice priority for user
   *
   * @return {Object|Array}
   */

  disableVoicePriority: async (ctx) => {
    return strapi.services.alertpriority.activatePriority(ctx, 'voice', false);
  },

  /**
   * Enable sms priority for user
   *
   * @return {Object|Array}
   */

  enableSMSPriority: async (ctx) => {
    return strapi.services.alertpriority.activatePriority(ctx, 'sms', true);
  },

  /**
   * Disable sms priority for user
   *
   * @return {Object|Array}
   */

  disableSMSPriority: async (ctx) => {
    return strapi.services.alertpriority.activatePriority(ctx, 'sms', false);
  },

  /**
   * Enable email priority for user
   *
   * @return {Object|Array}
   */

  enableEmailPriority: async (ctx) => {
    return strapi.services.alertpriority.activatePriority(ctx, 'email', true);
  },

  /**
   * Disable email priority for user
   *
   * @return {Object|Array}
   */

  disableEmailPriority: async (ctx) => {
    return strapi.services.alertpriority.activatePriority(ctx, 'email', false);
  },

  /**
   * Move up voice priority for user
   *
   * @return {Object|Array}
   */

  upVoicePriority: async (ctx) => {
    return strapi.services.alertpriority.upPriority(ctx, 'voice');
  },

  /**
   * Move down voice priority for user
   *
   * @return {Object|Array}
   */

  downVoicePriority: async (ctx) => {
    return strapi.services.alertpriority.downPriority(ctx, 'voice');
  },

  /**
   * Move up sms priority for user
   *
   * @return {Object|Array}
   */

  upSMSPriority: async (ctx) => {
    return strapi.services.alertpriority.upPriority(ctx, 'sms');
  },

  /**
   * Move down sms priority for user
   *
   * @return {Object|Array}
   */

  downSMSPriority: async (ctx) => {
    return strapi.services.alertpriority.downPriority(ctx, 'sms');
  },

  /**
   * Move up email priority for user
   *
   * @return {Object|Array}
   */

  upEmailPriority: async (ctx) => {
    return strapi.services.alertpriority.upPriority(ctx, 'email');
  },

  /**
   * Move down email priority for user
   *
   * @return {Object|Array}
   */

  downEmailPriority: async (ctx) => {
    return strapi.services.alertpriority.downPriority(ctx, 'email');
  },

  /**
   * Retrieve alertpriority records.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    return strapi.services.alertpriority.fetchAll(ctx.query);
  },

  /**
   * Retrieve a alertpriority record.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    return strapi.services.alertpriority.fetch(ctx.params);
  },

  /**
   * Create a/an alertpriority record.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    return strapi.services.alertpriority.add(ctx.request.body);
  },

  /**
   * Update a/an alertpriority record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    return strapi.services.alertpriority.edit(ctx.params, ctx.request.body) ;
  },

  /**
   * Destroy a/an alertpriority record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    return strapi.services.alertpriority.remove(ctx.params);
  }
};
