'use strict';

const _ = require('lodash');

/**
 * Site.js controller
 *
 * @description: A set of functions called "actions" for managing `Site`.
 */

module.exports = {

  /**
   * Retrieve site records.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    return strapi.services.site.fetchAll(ctx.query);
  },

  /**
   * Retrieve site records inside company.
   *
   * @return {Object|Array}
   */

  findCompanySite: async (ctx) => {
    const user = ctx.state.user;
    if(!user){
      return ctx.badRequest(null, 'Unauthorized');
    }

    let companyId = false;
    if(user.role.type === 'company')
      companyId = user.company_admin._id.toString();
    else if(user.role.type === 'managers')
      companyId = user.manager_company._id.toString();
    else if(user.role.type === 'viewers')
      companyId = user.viewer_company._id.toString();

    if(!companyId)
      return ctx.notFound();

    ctx.query.company = companyId;

    if(user.role.type === 'viewers'){
      ctx.query._id = user.site_viewer._id.toString();
    }
    console.log(ctx.query);

    return strapi.services.site.fetchAll(ctx.query);
  },

  /**
   * Retrieve site for manager.
   *
   * @return {Object|Array}
   */

  findMySite: async (ctx) => {
    const user = ctx.state.user;

    let siteId = null;
    if(user.role.type === 'managers')
      siteId = user.site_manager._id.toString();
    else if(user.role.type === 'viewers')
      siteId = user.site_viewer._id.toString();

    if(siteId === null)
      return ctx.notFound();

    try{
      return strapi.services.site.fetch({_id: siteId});
    }catch(err){
      return ctx.notFound();
    }
  },

  /**
   * Retrieve a site record.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    return strapi.services.site.fetch(ctx.params);
  },

  /**
   * Retrieve a site record inside company.
   *
   * @return {Object}
   */

  findOneCompanySite: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }
    const user = ctx.state.user;
    if(!user){
      return ctx.badRequest(null, 'Unauthorized');
    }

    ctx.params.company = user.company_admin._id;

    return strapi.services.site.fetch(ctx.params);
  },

  /**
   * Create a/an site record.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    return strapi.services.site.add(ctx.request.body);
  },

  /**
   * Create a/an site record for attached company.
   *
   * @return {Object}
   */

  createCompanySite: async (ctx) => {
    const user = ctx.state.user;
    if(!user){
      return ctx.badRequest(null, 'Unauthorized');
    }

    try{
      //Prepare params
      const params = _.assign({}, ctx.request.body);

      //Get company id
      params.company = user.company_admin._id;

      //Add site
      return strapi.services.site.add(params);
    }catch(err){
      ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: adminError }] }] : err.message);
    }
  },

  /**
   * Update a/an site record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    return strapi.services.site.edit(ctx.params, ctx.request.body) ;
  },

  /**
   * Update a/an site record of company.
   *
   * @return {Object}
   */

  updateCompanySite: async (ctx, next) => {
    const user = ctx.state.user;
    if(!user){
      return ctx.badRequest(null, 'Unauthorized');
    }

    //Prepare
    const checkParams = {
      _id: ctx.params._id,
      company: user.company_admin._id.toString()
    };

    //Check if company has site
    let site = await strapi.services.site.fetchAll(checkParams);
    site = (site.list && site.list.length) ? site.list[0] : null;
    if(site && site.id/* && site.id === ctx.params._id*/){
      //Prepare params
      const params = _.assign({}, ctx.request.body);
      delete params.company;
      delete params.managers;
      delete params.viewers;
      delete params.dashboards;

      return strapi.services.site.edit({
        _id: site._id.toString()
      }, params);
    }else{
      return ctx.badRequest(null, 'Site not found');
    }
  },

  /**
   * Update a/an site record for manager.
   *
   * @return {Object}
   */

  updateManagerSite: async (ctx, next) => {
    const user = ctx.state.user;
    if(!user){
      return ctx.badRequest(null, 'Unauthorized');
    }

    try{
      //Prepare
      const checkParams = {
        _id:  user.site_manager._id.toString()
      };
      
      //Check if company has site
      let site = await strapi.services.site.fetchAll(checkParams);
      site = (site.list && site.list.length)? site.list[0] : null;
      if(site && site._id/* && site.id === ctx.params._id*/){
        //Prepare params
        const params = _.assign({}, ctx.request.body);
        delete params.company;
        delete params.managers;
        delete params.viewers;
        delete params.dashboards;

        return strapi.services.site.edit({
          _id: site._id.toString()
        }, params);
      }else{
        return ctx.badRequest(null, 'Site not found');
      }
    }catch(err){
      return ctx.notFound();
    }
  },

  /**
   * Destroy a/an site record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    return strapi.services.site.remove(ctx.params);
  },

  /**
   * Destroy a/an site record of company.
   *
   * @return {Object}
   */

  destroyCompanySite: async (ctx, next) => {
    const user = ctx.state.user;
    if(!user){
      return ctx.badRequest(null, 'Unauthorized');
    }

    //Prepare
    const checkParams = {
      id: ctx.params._id,
      company: user.company_admin._id
    };

    //Check if company has site
    const site = await strapi.services.site.fetch(checkParams);
    if(site){
      return strapi.services.site.remove(ctx.params);
    }else{
      return ctx.badRequest(null, 'Site not found');
    }
  }
};
