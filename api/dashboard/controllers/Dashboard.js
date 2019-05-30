'use strict';

const _ = require('lodash');

/**
 * Dashboard.js controller
 *
 * @description: A set of functions called "actions" for managing `Dashboard`.
 */

module.exports = {

  /**
   * Retrieve dashboard records.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    return strapi.services.dashboard.fetchAll(ctx.query);
  },

  /**
   * Retrieve dashboard records by site ID.
   *
   * @return {Object|Array}
   */

  findSiteDashboards: async (ctx) => {
    if (!ctx.params.site_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Check if site belong to user
    let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, ctx.state.user);
    if(!mySite){
      return ctx.notFound();
    }

    const query = _.assign({
      site: ctx.params.site_id
    }, ctx.query);

    return strapi.services.dashboard.fetchAll(query);
  },

  /**
   * Retrieve a dashboard record.
   *
   * @return {Object}
   */

  findSiteDashboard: async (ctx) => {
    if (!ctx.params.site_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Check if site belong to user
    let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, ctx.state.user);
    if(!mySite){
      return ctx.notFound();
    }

    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    const dashboard = await strapi.services.dashboard.fetch(ctx.params);
    try{
      if(dashboard.site.id === ctx.params.site_id)
        return ctx.send(dashboard);

      return ctx.notFound();
    }catch(err){
      return ctx.notFound();
    }
  },

  /**
   * Retrieve a dashboard record by site ID.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    return strapi.services.dashboard.fetch(ctx.params);
  },

  /**
   * Create a/an dashboard record.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    return strapi.services.dashboard.add(ctx.request.body);
  },

  /**
   * Create a/an dashboard record by site ID.
   *
   * @return {Object}
   */

  createCompanyDashboard: async (ctx) => {
    if (!ctx.params.site_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Check if site belong to user
    let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, ctx.state.user);
    if(!mySite){
      return ctx.notFound();
    }

    //Get site
    const site = await strapi.services.site.fetch({
      _id: ctx.params.site_id
    });

    //Check max dashboards permission
    let count = 1;
    if(site.dashboards && site.dashboards.length)
      count += site.dashboards.length;

    //Check if max dashboard reached
    if (count > strapi.config.DASHBOARDS_MAX)
      return ctx.badRequest(null, "Can't create new dashboard! You can create maximum " + strapi.config.DASHBOARDS_MAX + " dashboards per site.");

    try{
      //Prepare params
      const params = _.assign({}, ctx.request.body);

      //Get site id
      params.site = ctx.params.site_id;

      //Add site
      return strapi.services.dashboard.add(params);
    }catch(err){
      ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: adminError }] }] : err.message);
    }
  },

  /**
   * Update a/an dashboard record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    return strapi.services.dashboard.edit(ctx.params, ctx.request.body) ;
  },

  /**
   * Update a/an dashboard record by site ID.
   *
   * @return {Object}
   */

  updateCompanyDashboard: async (ctx, next) => {
    if (!ctx.params.site_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Check if site belong to user
    let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, ctx.state.user);
    if(!mySite){
      return ctx.notFound();
    }

    //Check if company has site
    const dashboard = await strapi.services.dashboard.fetch({
      _id: ctx.params._id
    });
    if(dashboard && dashboard.id && dashboard.site.id === ctx.params.site_id){
      //Prepare params
      const params = _.assign({}, ctx.request.body);
      delete params.site;
      delete params.managers;
      delete params.viewers;

      return strapi.services.dashboard.edit(ctx.params, params);
    }else{
      return ctx.badRequest(null, 'Dashboard not found');
    }
  },

  /**
   * Destroy a/an dashboard record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    return strapi.services.dashboard.remove(ctx.params);
  },

  /**
   * Destroy a/an dashboard record for company.
   *
   * @return {Object}
   */

  destroyCompanyDashboard: async (ctx, next) => {
    if (!ctx.params.site_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Check if site belong to user
    let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, ctx.state.user);
    console.warn(mySite, ctx.params);
    if(!mySite){
      return ctx.notFound();
    }

    //Check if company has site
    const dashboard = await strapi.services.dashboard.fetch({
      _id: ctx.params._id
    });
    if(dashboard && dashboard.id && dashboard.site.id === ctx.params.site_id){
      delete ctx.params.site_id;
      return strapi.services.dashboard.remove(ctx.params);
    }else{
      return ctx.badRequest(null, 'Dashboard not found');
    }
  }
};
