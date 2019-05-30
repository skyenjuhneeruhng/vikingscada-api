'use strict';

/**
 * User.js controller
 *
 * @description: A set of functions called "actions" for managing `User`.
 */

const _ = require('lodash');

module.exports = {

  /**
   * Retrieve user records.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    let data = await strapi.plugins['users-permissions'].services.user.fetchAll(ctx.query);
    data.reduce((acc, user) => {
      acc.push(_.omit(user.toJSON ? user.toJSON() : user, ['password', 'resetPasswordToken']));
      return acc;
    }, []);

    // Send 200 `ok`
    ctx.send(data);
  },

  /**
   * Retrieve managers records.
   *
   * @return {Object|Array}
   */

  findManagers: async (ctx) => {
    const role = await strapi.plugins['users-permissions'].services.userspermissions.getRoleByType('managers');
    if(!role)
      return ctx.notFound();

    const query = _.assign({role: role._id.toString()}, ctx.query);

    //all query
    const allQuery = _.assign({role: role._id.toString()}, ctx.query);
    delete allQuery._limit;
    delete allQuery._start;

    let all = await strapi.plugins['users-permissions'].services.user.fetchAll(allQuery);
    let data = await strapi.plugins['users-permissions'].services.user.fetchAll(query);

    data.reduce((acc, user) => {
      acc.push(_.omit(user.toJSON ? user.toJSON() : user, ['password', 'resetPasswordToken']));
      return acc;
    }, []);

    // Send 200 `ok`
    ctx.send({
      total: all.length || 0,
      list: data
    });
  },

  /**
   * Retrieve viewers records.
   *
   * @return {Object|Array}
   */

  findViewers: async (ctx) => {
    const role = await strapi.plugins['users-permissions'].services.userspermissions.getRoleByType('viewers');

    const query = _.assign({role: role._id.toString()}, ctx.query);

    //all query
    const allQuery = _.assign({role: role._id.toString()}, ctx.query);
    delete allQuery._limit;
    delete allQuery._start;

    let all = await strapi.plugins['users-permissions'].services.user.fetchAll(allQuery);
    let data = await strapi.plugins['users-permissions'].services.user.fetchAll(query);

    data.reduce((acc, user) => {
      acc.push(_.omit(user.toJSON ? user.toJSON() : user, ['password', 'resetPasswordToken']));
      return acc;
    }, []);

    // Send 200 `ok`
    ctx.send({
      total: all.length || 0,
      list: data
    });
  },

  /**
   * Retrieve user traffic.
   *
   * @return {Object|Array}
   */

  getMyTraffic: async (ctx) => {
    const user = ctx.state.user;

    const traffic = await strapi.services.payment.getTraffic(user);

    return ctx.send('' + traffic);
  },

  /**
   * Retrieve authenticated user.
   *
   * @return {Object|Array}
   */

  me: async (ctx) => {
    const user = ctx.state.user;

    if (!user) {
      return ctx.badRequest(null, [{ messages: [{ id: 'No authorization header was found' }] }]);
    }

    //Roles
    if (user.role._id) {
      user.role = await strapi.plugins['users-permissions'].services.userspermissions.getRole(user.role._id.toString(), null, true);
    }

    const data = _.omit(user.toJSON ? user.toJSON() : user, ['password', 'resetPasswordToken']);

    //Company relation
    if (data.company_admin) {
      data.company_admin = await strapi.services.company.findById(data.company_admin);
    }

    //Company manager relation
    if (data.manager_company) {
      data.manager_company = await strapi.services.company.findById(data.manager_company, true);
    }

    //Company viewer relation
    if (data.viewer_company) {
      data.viewer_company = await strapi.services.company.findById(data.viewer_company, true);
    }

    //Company site manager relation
    if (data.site_manager) {
      data.site_manager = await strapi.services.site.findById(data.site_manager, true);
      if (data.site_manager && data.site_manager._id) {
        const dashboards = await strapi.services.dashboard.fetchAll({
          site: data.site_manager._id.toString(),
          _sort: 'createdAt:asc'
        });

        const dashboardsList = [];
        if (dashboards && dashboards.list) {
          for (let dash of dashboards.list) {
            dashboardsList.push(dash._id.toString());
          }
        }

        data.dashboards = dashboardsList;
      }
    }

    //Company site viewer relation
    if (data.site_viewer) {
      data.site_viewer = await strapi.services.site.findById(data.site_viewer, true);
      if (data.site_viewer && data.site_viewer._id) {
        const dashboards = await strapi.services.dashboard.fetchAll({
          site: data.site_viewer._id.toString(),
          _sort: 'createdAt:asc'
        });

        const dashboardsList = [];
        if (dashboards && dashboards.list) {
          for (let dash of dashboards.list) {
            dashboardsList.push(dash._id.toString());
          }
        }

        data.dashboards = dashboardsList;
      }
    }

    // Send 200 `ok`
    ctx.send(data);
  },

  /**
   * Retrieve a user record.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    let data = await strapi.plugins['users-permissions'].services.user.fetch(ctx.params);

    if (data) {
      data = _.omit(data.toJSON ? data.toJSON() : data, ['password', 'resetPasswordToken']);
    }

    // Send 200 `ok`
    ctx.send(data);
  },

  /**
   * Create a/an user record.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    if ((await strapi.store({
      environment: '',
      type: 'plugin',
      name: 'users-permissions',
      key: 'advanced'
    }).get()).unique_email && ctx.request.body.email) {
      const user = await strapi.query('user', 'users-permissions').findOne({ email: ctx.request.body.email });

      if (user) {
        return ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: 'Auth.form.error.email.taken', field: ['email'] }] }] : 'Email is already taken.');
      }
    }

    try {
      const data = await strapi.plugins['users-permissions'].services.user.add(ctx.request.body);
      // Send 201 `created`
      ctx.created(data);
    } catch(error) {
      ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: error.message, field: error.field }] }] : error.message);
    }
  },

  /**
   * Update a/an user record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    try {
      const advancedConfigs = await strapi.store({
        environment: '',
        type: 'plugin',
        name: 'users-permissions',
        key: 'advanced'
      }).get();

      const user = await strapi.plugins['users-permissions'].services.user.fetch(ctx.params);

      if (advancedConfigs.unique_email && ctx.request.body.email && _.get(ctx.request, 'body.email') !== user.email) {
        const users = await strapi.plugins['users-permissions'].services.user.fetchAll({ email: ctx.request.body.email });

        if (users && _.find(users, user => (user.id || user._id).toString() !== ctx.params.id)) {
          return ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: 'Auth.form.error.email.taken', field: ['email'] }] }] : 'This email is already taken.');
        }
      }

      if (_.get(ctx.request, 'body.password') === user.password) {
        delete ctx.request.body.password;
      }

      if (_.get(ctx.request, 'body.role', '').toString() === '0' && (!_.get(ctx.state, 'user.role') || _.get(ctx.state, 'user.role', '').toString() !== '0')) {
        delete ctx.request.body.role;
      }

      if (ctx.request.body.email && advancedConfigs.unique_email) {
        const user = await strapi.query('user', 'users-permissions').findOne({
          email: ctx.request.body.email
        });

        if (user !== null && (user.id || user._id).toString() !== _.get(ctx.request, 'body.id')) {
          return ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: 'Auth.form.error.email.taken', field: ['email'] }] }] : 'This email is already taken.');
        }
      }

      //Check username
      if (_.get(ctx.request, 'body.username') !== user.username) {
        const users = await strapi.plugins['users-permissions'].services.user.fetchAll({
          username: ctx.request.body.username
        });

        if (users && _.find(users, user => (user.id || user._id).toString() !== user.id)) {
          return ctx.badRequest(null, 'This username is already taken.');
        }
      }

      //Check phone
      if (_.get(ctx.request, 'body.phone') !== user.phone) {
        const users = await strapi.plugins['users-permissions'].services.user.fetchAll({
          phone: ctx.request.body.phone
        });

        let isPhoneTaken = false;
        if (users) {
          for (var i = 0; i < users.length; i++) {
            if (users[i]._id.toString() !== user._id.toString())
              isPhoneTaken = true;
          }
        }

        if (isPhoneTaken) {
          return ctx.badRequest(null, 'This phone number is already taken.');
        }
      }

      if(_.get(ctx.request, 'body.phone') && _.get(ctx.request, 'body.phone') != user.phone){
        ctx.request.body.verified = false;
        ctx.request.body.verify_code = '';
      }

      const data = await strapi.plugins['users-permissions'].services.user.edit(ctx.params, ctx.request.body) ;

      // Send 200 `ok`
      ctx.send(data);
    } catch(error) {
      ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: error.message, field: error.field }] }] : error.message);
    }
  },

  /**
   * Update my user record.
   *
   * @return {Object}
   */

  updateMe: async (ctx, next) => {
    try {
      const advancedConfigs = await strapi.store({
        environment: '',
        type: 'plugin',
        name: 'users-permissions',
        key: 'advanced'
      }).get();

      //Get current user
      const user = ctx.state.user;

      //Prepare body
      const body = ctx.request.body.fields || ctx.request.body;

      //Check username
      if (body.username !== user.username) {
        const users = await strapi.plugins['users-permissions'].services.user.fetchAll({
          username: body.username
        });

        if (users && _.find(users, user => (user.id || user._id).toString() !== user.id)) {
          return ctx.badRequest(null, 'This username is already taken.');
        }
      }

      //Check phone
      if (body.phone !== user.phone) {
        const users = await strapi.plugins['users-permissions'].services.user.fetchAll({
          phone: body.phone
        });

        let isPhoneTaken = false;
        if(users){
          for(var i = 0; i < users.length; i++){
            if(users[i]._id.toString() !== user._id.toString())
              isPhoneTaken = true;
          }
        }

        if (isPhoneTaken) {
          return ctx.badRequest(null, 'This phone number is already taken.');
        }
      }

      if (advancedConfigs.unique_email && body.email && body.email !== user.email) {
        const users = await strapi.plugins['users-permissions'].services.user.fetchAll({ email: body.email });

        if (users && _.find(users, user => (user.id || user._id).toString() !== user.id)) {
          return ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: 'Auth.form.error.email.taken', field: ['email'] }] }] : 'This email is already taken.');
        }
      }

      if (body.password === user.password) {
        delete body.password;
      }

      if (body.role && user.role) {
        delete body.role;
      }

      if (body.phone && body.phone != user.phone) {
        body.verified = false;
        body.verify_code = '';
      }

      if (user.role.type === 'managers' || user.role.type === 'viewers')
        body.verified = true;

      //If company admin
      if(user.company_admin && user.company_admin._id){
        const company = await strapi.services.company.fetch({
          _id: user.company_admin._id.toString()
        });
        let companyParams = {
          id: company.id,
          company_name: body.company_name || company.company_name,
          address: body.address || company.address,
          zipcode: body.zipcode || company.zipcode,
          state: body.state || company.state,
          alert_sms_admin: body.alert_sms_admin || company.alert_sms_admin,
          alert_sms_managers: body.alert_sms_managers || company.alert_sms_managers,
          alert_sms_viewers: body.alert_sms_viewers || company.alert_sms_viewers,
          alert_email_admin: body.alert_email_admin || company.alert_email_admin,
          alert_email_managers: body.alert_email_managers || company.alert_email_managers,
          alert_email_viewers: body.alert_email_viewers || company.alert_email_viewers
        };

        //Images
        if (ctx.request.body.files){
          const images = await strapi.plugins['users-permissions'].services.user.uploadFile(ctx, 'company_logo');
          if (images && images[0] && images[0]._id)
            companyParams.company_logo = images[0]._id.toString();
        }

        //Clean params for user update
        delete body.company_name;
        delete body.address;
        delete body.zipcode;
        delete body.state;

        //Clean notifications data
        delete body.alert_sms_admin;
        delete body.alert_sms_managers;
        delete body.alert_sms_viewers;
        delete body.alert_email_admin;
        delete body.alert_email_managers;
        delete body.alert_email_viewers;
        
        await strapi.services.company.edit({_id: company._id.toString()}, companyParams);
      }

      ctx.params.id = user.id;
      body.id = user.id;

      //Delete traffic values
      delete body.custom_bytes;
      delete body.subscribe_bytes;

      const data = await strapi.plugins['users-permissions'].services.user.edit(ctx.params, body);

      if (data.company_admin && data.company_admin.company_logo){
        data.company_admin.company_logo = await strapi.plugins['users-permissions'].services.user.getFile(data.company_admin.company_logo);
      }

      if (data.manager_company && data.manager_company.company_logo) {
        data.manager_company.company_logo = await strapi.plugins['users-permissions'].services.user.getFile(data.manager_company.company_logo);
      }

      if (data.viewer_company && data.viewer_company.company_logo) {
        data.viewer_company.company_logo = await strapi.plugins['users-permissions'].services.user.getFile(data.viewer_company.company_logo);
      }

      // Send 200 `ok`
      ctx.send(data);
    } catch(error) {
      ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: error.message, field: error.field }] }] : error.message);
    }
  },

  /**
   * Destroy a/an user record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    const data = await strapi.plugins['users-permissions'].services.user.remove(ctx.params);

    // Send 200 `ok`
    ctx.send(data);
  }
};
