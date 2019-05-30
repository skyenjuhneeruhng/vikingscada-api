'use strict';

/**
 * Device.js controller
 *
 * @description: A set of functions called "actions" for managing `Device`.
 */

module.exports = {

  /**
   * Get devices records.
   *
   * @return {Object|Array}
   */
  getDevices: async (ctx) => {
    if (!ctx.params.site_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Check if site belong to user
    let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, ctx.state.user);
    if (!mySite) {
      return ctx.notFound();
    }

    //Add site id filter 
    ctx.query.site = ctx.params.site_id;

    return strapi.services.device.fetchAll(ctx.query);
  },

  /**
   * Get a device record.
   *
   * @return {Object}
   */

  getDevice: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    if (!ctx.params.site_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Check if site belong to user
    let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, ctx.state.user);
    if (!mySite) {
      return ctx.notFound();
    }

    const device = await strapi.services.device.fetch(ctx.params);

    //Check if device belong to site
    if (device.site && device.site._id && device.site._id.toString() === ctx.params.site_id)
      return ctx.send(device);

    return ctx.notFound();
  },

  /**
   * Create a/an device record.
   *
   * @return {Object}
   */

  createDevice: async (ctx) => {
    if (!ctx.params.site_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Check if site belong to user
    let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, ctx.state.user);
    if (!mySite) {
      return ctx.notFound();
    }

    //Add site id to body
    ctx.request.body.site = ctx.params.site_id;

    const addedDevice = await strapi.services.device.add(ctx.request.body);
    const device = await strapi.services.device.fetch({_id: addedDevice._id.toString()});

    //Send gateway restart message
    if (device.gateway && device.gateway._id)
      strapi.eventEmitter.emit('gateway:restart', device.gateway._id.toString());

    return ctx.send(device);
  },

  /**
   * Update a/an device record.
   *
   * @return {Object}
   */

  updateDevice: async (ctx, next) => {
    if (!ctx.params.site_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Check if site belong to user
    let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, ctx.state.user);
    if (!mySite) {
      return ctx.notFound();
    }

    //Add site id to body
    ctx.request.body.site = ctx.params.site_id;

    await strapi.services.device.edit(ctx.params, ctx.request.body);

    //Send gateway restart message
    const device = await strapi.services.device.fetch({_id: ctx.params._id});
    if (device.gateway && device.gateway._id)
      strapi.eventEmitter.emit('gateway:restart', device.gateway._id.toString());

    return strapi.services.device.fetch(ctx.params);
  },

  /**
   * Destroy a/an device record.
   *
   * @return {Object}
   */

  destroyDevice: async (ctx, next) => {
    if (!ctx.params.site_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Check if site belong to user
    let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, ctx.state.user);
    if (!mySite) {
      return ctx.notFound();
    }

    const device = await strapi.services.device.fetch(ctx.params);

    //Check if device belong to site
    if (device.site && device.site._id && device.site._id.toString() === ctx.params.site_id){
      //Send gateway restart message
      if (device.gateway && device.gateway._id)
        strapi.eventEmitter.emit('gateway:restart', device.gateway._id.toString());
        
      return strapi.services.device.remove({
        _id: device._id.toString()
      });
    }

    return ctx.notFound();
  },

  /**
   * Retrieve device records.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    return strapi.services.device.fetchAll(ctx.query);
  },

  /**
   * Retrieve a device record.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    return strapi.services.device.fetch(ctx.params);
  },

  /**
   * Create a/an device record.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    return strapi.services.device.add(ctx.request.body);
  },

  /**
   * Update a/an device record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    return strapi.services.device.edit(ctx.params, ctx.request.body) ;
  },

  /**
   * Destroy a/an device record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    return strapi.services.device.remove(ctx.params);
  }
};
