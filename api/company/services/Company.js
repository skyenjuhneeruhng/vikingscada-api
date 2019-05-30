'use strict';

/**
 * Company.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

// Public dependencies.
const _ = require('lodash');
const emailRegExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

module.exports = {

  /**
   * Check if user is approved for action
   *
   * @return {Promise}
   */

  isApproved: (ctx) => {
    if(strapi.config.APPROVED_ENABLED === false)
      return true;

    const user = ctx.state.user;

    try {
      //for company
      if(user.role.type === 'company'){
        if(user.company_admin.status !== 'approved')
          return false;
      }

      return true;
    }catch(error){
      return false;
    }
  },

  /**
   * Promise to count all companies.
   *
   * @return {Promise}
   */

  count: (params) => {
    const convertedParams = strapi.utils.models.convertParams('company', params);

    return Company
      .find()
      .where(convertedParams.where)
      .sort(convertedParams.sort)
      .populate(_.keys(_.groupBy(_.reject(strapi.models.company.associations, {autoPopulate: false}), 'alias')).join(' ')).count();
  },

  /**
   * Promise to fetch all companies.
   *
   * @return {Promise}
   */

  fetchAll: (params) => {
    const convertedParams = strapi.utils.models.convertParams('company', params);

    //prepare list of response
    let response = {total: 0, list: []};

    //Get total
    return Company
              .find()
              .where(convertedParams.where)
              .sort(convertedParams.sort)
              .populate(_.keys(_.groupBy(_.reject(strapi.models.company.associations, {autoPopulate: false}), 'alias')).join(' ')).count().then(function(count){
                response.total = count;
                return Company
                  .find()
                  .where(convertedParams.where)
                  .sort(convertedParams.sort)
                  .skip(convertedParams.start)
                  .limit(convertedParams.limit)
                  .populate(_.keys(_.groupBy(_.reject(strapi.models.company.associations, {autoPopulate: false}), 'alias')).join(' ')).exec().then(function(items){
                    response.list = items;
                    return response;
                  });
              });
  },

  /**
   * Promise to fetch a/an company.
   *
   * @return {Promise}
   */

  fetch: (params) => {
    return Company
      .findOne(_.pick(params, _.keys(Company.schema.paths)))
      .populate(_.keys(_.groupBy(_.reject(strapi.models.company.associations, {autoPopulate: false}), 'alias')).join(' '));
  },

  /**
   * Promise to find a/an company by ID.
   *
   * @return {Promise}
   */

  findById: async (id, withoutAssociations = false) => {
    let associations = (withoutAssociations)? {} : strapi.models.company.associations;

    const company = await Company
      .findOne(_.pick({_id: id}, _.keys(Company.schema.paths)))
      .populate(_.keys(_.groupBy(_.reject(associations, {autoPopulate: false}), 'alias')).join(' '));

    if (company && company.company_logo) {
      //company.company_logo = await strapi.plugins['users-permissions'].services.user.getFile(company.company_logo);
      company.setValue('company_logo', await strapi.plugins['users-permissions'].services.user.getFile(company.company_logo));
    }

    return company;
  },

  /**
   * Promise to add a/an company.
   *
   * @return {Promise}
   */

  add: async (values) => {
    const query = await Company.create(_.omit(values, _.keys(_.groupBy(strapi.models.company.associations, 'alias'))));
    const data = query.toJSON ? query.toJSON() : query;

    await strapi.hook.mongoose.manageRelations('company', _.merge(data, { values }));

    return query;
  },

  /**
   * Promise to edit a/an company.
   *
   * @return {Promise}
   */

  edit: async (params, values) => {
    // Note: The current method will return the full response of Mongo.
    // To get the updated object, you have to execute the `findOne()` method
    // or use the `findOneOrUpdate()` method with `{ new:true }` option.
    await strapi.hook.mongoose.manageRelations('company', _.merge(_.clone(params), { values }));
    return Company.update(params, values, { multi: true });
  },

  /**
   * Promise to remove a/an company.
   *
   * @return {Promise}
   */

  remove: async params => {
    const company = await strapi.services.company.fetch(params);
    if (!company)
      return false;

    const admin = company.admin;

    //Try remove admin
    //console.log('Remove company admin', admin._id.toString());
    await strapi.plugins['users-permissions'].services.user.remove({
      _id: admin._id.toString()
    });

    //Remove dependencies
    const sites = company.sites || [];
    if(sites.length){
      for (var sid = 0; sid < sites.length; sid++) {
        //Try remove dashboard
        /*const dashboards = await strapi.services.dashboard.fetchAll({
          site: sites[sid]._id.toString()
        });
        if (dashboards.list && dashboards.list.length){
          for (var did = 0; did < dashboards.list.length; did++){
            //console.log('Remove dashboard', dashboards.list[did]._id.toString());
            await strapi.services.dashboard.remove({
              _id: dashboards.list[did]._id.toString()
            });
          }
        }

        //Try remove gateways
        const gateways = await strapi.services.gateway.fetchAll({
          site: sites[sid]._id.toString()
        });
        if (gateways.list && gateways.list.length) {
          for (var gid = 0; gid < gateways.list.length; gid++) {
            //console.log('Remove gateway', gateways.list[gid]._id.toString());
            await strapi.services.gateway.remove({
              _id: gateways.list[gid]._id.toString()
            });
          }
        }

        //Try remove devices
        const devices = await strapi.services.device.fetchAll({
          site: sites[sid]._id.toString()
        });
        if (devices.list && devices.list.length) {
          for (var ddid = 0; ddid < devices.list.length; ddid++) {
            //console.log('Remove device', devices.list[ddid]._id.toString());
            await strapi.services.device.remove({
              _id: devices.list[ddid]._id.toString()
            });
          }
        }

        //Try remove sensors
        const sensors = await strapi.services.sensor.fetchAll({
          site: sites[sid]._id.toString()
        });
        if (sensors.list && sensors.list.length) {
          for (var ssid = 0; ssid < sensors.list.length; ssid++) {
            //console.log('Remove sensor', sensors.list[ssid]._id.toString());
            await strapi.services.sensor.remove({
              _id: sensors.list[ssid]._id.toString()
            });
          }
        }*/

        //Try remove site
        //console.log('Remove site', sites[sid]._id.toString());
        await strapi.services.site.remove({
          _id: sites[sid]._id.toString()
        });
      }
    }

    //Try remove managers
    const managers = company.managers || [];
    if(managers.length){
      for(var mid = 0; mid < managers.length; mid++){
        //console.log('Remove manager', managers[mid]._id.toString());
        await strapi.plugins['users-permissions'].services.user.remove({
          _id: managers[mid]._id.toString()
        });
      }
    }

    //Try remove managers
    const viewers = company.viewers || [];
    if (viewers.length) {
      for (var vid = 0; vid < viewers.length; vid++) {
        //console.log('Remove viewer', viewers[vid]._id.toString());
        await strapi.plugins['users-permissions'].services.user.remove({
          _id: viewers[vid]._id.toString()
        });
      }
    }

    // Note: To get the full response of Mongo, use the `remove()` method
    // or add spent the parameter `{ passRawResult: true }` as second argument.
    const data = await Company.findOneAndRemove(params, {})
      .populate(_.keys(_.groupBy(_.reject(strapi.models.company.associations, {autoPopulate: false}), 'alias')).join(' '));

    try{
      _.forEach(Company.associations, async association => {
        const search = (_.endsWith(association.nature, 'One')) ? { [association.via]: data._id } : { [association.via]: { $in: [data._id] } };
        const update = (_.endsWith(association.nature, 'One')) ? { [association.via]: null } : { $pull: { [association.via]: data._id } };

        await strapi.models[association.model || association.collection].update(
          search,
          update,
          { multi: true });
      });
    } catch(e) {
      //
    }

    return data;
  },

  /**
   * Register company user
   *
   * @return {Promise}
   */

  registerCompanyUser: async (ctx, roleType) => {
    //first create user
    const settings = await strapi.store({
      environment: '',
      type: 'plugin',
      name: 'users-permissions',
      key: 'advanced'
    }).get();

    if (!settings.allow_register) {
      return ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: 'Auth.advanced.allow_register' }] }] : 'Register action is currently disabled.');
    }

    const params = _.assign(ctx.request.body, {
      provider: 'local'
    });

    // Password is required.
    if (!params.password) {
      return ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: 'Auth.form.error.password.provide' }] }] : 'Please provide your password.');
    }

    // Throw an error if the password selected by the user
    // contains more than two times the symbol '$'.
    if (strapi.plugins['users-permissions'].services.user.isHashed(params.password)) {
      return ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: 'Auth.form.error.password.format' }] }] : 'Your password cannot contain more than three times the symbol `$`.');
    }

    // Check if the user is the first to register
    const role = await strapi.plugins['users-permissions'].services.userspermissions.getRoleByType(roleType);
    if (!role) {
      return ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: 'Auth.form.error.role.notFound' }] }] : 'Impossible to find the root role.');
    }

    // Check if the provided identifier is an email or not.
    const isEmail = emailRegExp.test(params.identifier);

    if (isEmail) {
      params.identifier = params.identifier.toLowerCase();
    }

    params.role = role._id || role.id;

    //verified false
    params.verified = false; //Bugfix for verify mangers&viewers

    //Get company id
    let companyId = null;
    let siteId = null;

    //Get company ID
    if(ctx.state.user.role.type === 'company')
      companyId = ctx.state.user.company_admin._id.toString();

    else if(ctx.state.user.role.type === 'managers')
      companyId = ctx.state.user.manager_company._id.toString();

    else if(ctx.params.company_id && ctx.params.company_id.match(/^[0-9a-fA-F]{24}$/))
      companyId = ctx.params.company_id;

    //Get site ID
    if (roleType === 'managers' && ctx.request.body.site_manager.match(/^[0-9a-fA-F]{24}$/))
      siteId = ctx.request.body.site_manager;

    else if (roleType === 'viewers' && ctx.request.body.site_viewer.match(/^[0-9a-fA-F]{24}$/))
      siteId = ctx.request.body.site_viewer;

    if(companyId === null)
      return ctx.badRequest(null, 'Company ID not found');

    //Site belong
    if(roleType === 'managers'){
      params.manager_company = companyId;
      params.verified = true;
    }else if(roleType === 'viewers'){
      params.viewer_company = companyId;
      params.verified = true;
    }

    //Check if company users reach max count strapi.config.COMPANY_USERS_MAX
    /*const company = await strapi.services.company.fetch({_id: companyId});

    //Get count of managers and viewers
    var count = 1; //already with 1 new person
    if(company.managers && company.managers.length)
      count += company.managers.length;
    if(company.viewers && company.viewers.length)
      count += company.viewers.length;*/
    
    //Check if site users reach max
    const site = await strapi.services.site.fetch({
      _id: siteId
    });

    //Count of site users
    let count = 1;
    if (site) {
      if (site.managers && site.managers.length)
        count += site.managers.length;
      if (site.viewers && site.viewers.length)
        count += site.viewers.length;
    }

    //Check if max users
    if(count > strapi.config.COMPANY_USERS_MAX)
      return ctx.badRequest(null, "Can't create new user! You can create maximum " + strapi.config.COMPANY_USERS_MAX +" users per site.");

    //Check if managers max users
    if (roleType === 'managers' && (site.managers.length + 1) > strapi.config.COMPANY_MANAGERS_MAX)
      return ctx.badRequest(null, "Can't create new manager! You can create maximum "+strapi.config.COMPANY_MANAGERS_MAX+" managers per site.");

    //params.password = await strapi.plugins['users-permissions'].services.user.hashPassword(params);

    try {
      const user = await strapi.plugins['users-permissions'].services.user.add(params);

      ctx.send(_.omit(user.toJSON ? user.toJSON() : user, ['password', 'resetPasswordToken']));
      /*ctx.send({
        jwt: strapi.plugins['users-permissions'].services.jwt.issue(_.pick(user.toJSON ? user.toJSON() : user, ['_id', 'id'])),
        user: _.omit(user.toJSON ? user.toJSON() : user, ['password', 'resetPasswordToken'])
      });*/
    } catch(err) {
      const adminError = _.includes(err.message, 'username') ? 'Auth.form.error.username.taken' : 'Auth.form.error.email.taken';

      ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: adminError }] }] : err.message);
    }
  }
};
