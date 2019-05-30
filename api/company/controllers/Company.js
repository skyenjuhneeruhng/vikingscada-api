'use strict';

const _ = require('lodash');
const emailRegExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

//Excel lib
const excel = require('node-excel-export');

//Write file
const fs = require('fs');

/**
 * Company.js controller   
 *
 * @description: A set of functions called "actions" for managing `Company`.
 */

module.exports = {

  /**
   * Get reports 
   *
   * @return {Object|Array}
   */

  getReport: async (ctx) => {
    const user = ctx.state.user;

    //get company id for reports
    let company_id = null;
    
    //For company admin
    if(user.company_admin)
      company_id = user.company_admin._id.toString();

    if(!company_id)
      return ctx.notFound();
  
    //Prepare from and to filters
    let to = (new Date(ctx.query.to) instanceof Date && !isNaN(new Date(ctx.query.to))) ? new Date(ctx.query.to) : new Date();
    let from = (new Date(ctx.query.from) instanceof Date && !isNaN(new Date(ctx.query.from))) ? new Date(ctx.query.from) : new Date(to.getTime() - 60 * 60000);

    //Prepare query
    let query = {
      createdAt_gte: from,
      createdAt_lte: to,
      company_id: company_id
    };

    if (ctx.query._start)
      query._start = parseInt(ctx.query._start);

    if (ctx.query._limit)
      query._limit = parseInt(ctx.query._limit);

    if (ctx.query.download){
      query._start = 0;
      query._limit = 50000;
    }

    let alerts = await strapi.services.alerts.fetchAll(query);

    //If not for download
    if(!ctx.query.download)
      return ctx.send(alerts);

    //If needed to download

    // You can define styles as json object
    const styles = {
      headerStyle: {
        fill: {
          fgColor: {
            rgb: 'FF6BB3FB'
          }
        },
        font: {
          sz: 11
        },
        alignment: {
          vertical: 'center',
          horizontal: 'center',
          wrapText: true,
        }
      },
      cellStyleBold: {
        font: {
          sz: 12,
          bold: true
        },
        alignment: {
          vertical: 'center',
          horizontal: 'center',
          wrapText: true,
        }
      },
      cellStyleLeft: {
        font: {
          sz: 11
        },
        alignment: {
          vertical: 'center',
          horizontal: 'left',
          wrapText: true,
        }
      },
      cellStyle: {
        font: {
          sz: 11
        },
        alignment: {
          vertical: 'center',
          horizontal: 'center',
          wrapText: true,
        }
      }
    };

    //Array of objects representing heading rows (very top)
    const heading = [
      //['Alert', 'Sensor ID', 'Widget Title', 'Sensor Value', 'Alert Value', 'Users receive SMS', 'Users receive Email']
    ];

    const specification = {
      alert_type: { // <- the key should match the actual data key
        displayName: 'Alert', // <- Here you specify the column header
        headerStyle: styles.headerStyle,
        cellStyle: styles.cellStyle,
        width: 50 // <- width in pixels
      },
      sensor_id: { // <- the key should match the actual data key
        displayName: 'Sensor ID', // <- Here you specify the column header
        headerStyle: styles.headerStyle,
        cellStyle: styles.cellStyleBold,
        width: 150 // <- width in pixels
      },
      widget_title: { // <- the key should match the actual data key
        displayName: 'Widget Title', // <- Here you specify the column header
        headerStyle: styles.headerStyle,
        cellStyle: styles.cellStyle,
        width: 125 // <- width in pixels
      },
      sensor_value: { // <- the key should match the actual data key
        displayName: 'Sensor', // <- Here you specify the column header
        headerStyle: styles.headerStyle,
        cellStyle: styles.cellStyleBold,
        width: 50 // <- width in pixels
      },
      alert_value: { // <- the key should match the actual data key
        displayName: 'Alert', // <- Here you specify the column header
        headerStyle: styles.headerStyle,
        cellStyle: styles.cellStyleBold,
        width: 50 // <- width in pixels
      },
      users_sms: {
        displayName: 'Users receive SMS', // <- Here you specify the column header
        headerStyle: styles.headerStyle,
        cellStyle: styles.cellStyleLeft,
        width: 350 // <- width in pixels
      },
      users_email: {
        displayName: 'Users receive Email', // <- Here you specify the column header
        headerStyle: styles.headerStyle,
        cellStyle: styles.cellStyleLeft,
        width: 350 // <- width in pixels
      },
      date: {
        displayName: 'Date', // <- Here you specify the column header
        headerStyle: styles.headerStyle,
        cellStyle: styles.cellStyleBold,
        width: 200 // <- width in pixels
      }
    };

    //Data for rows file
    const dataset = [];

    //Push data to dataset
    if(alerts && alerts.list && alerts.list.length){
      for (var i = 0; i < alerts.list.length; i++){
        let alert = alerts.list[i];

        //Prepare row
        let row = {
          alert_type: alert.type,
          sensor_id: alert.sensor_id,
          widget_title: alert.widget_title,
          sensor_value: alert.sensor_value,
          alert_value: alert.alert_value,
          users_sms: '',
          users_email: '',
          date: new Date(alert.createdAt).toUTCString()
        };

        //Prepare sms users
        if (alert.users && alert.users.sms) {
          for (var us = 0; us < alert.users.sms.length; us++) {
            let user = alert.users.sms[us];

            if (row.users_sms !== '')
              row.users_sms += `
`;
            row.users_sms += user.first_name + ' ' + user.last_name + ', ' + user.phone + ', ' + user.email + ';';
          }
        }

        //Prepare email users
        if(alert.users && alert.users.email){
          for (var ue = 0; ue < alert.users.email.length; ue++){
            let user = alert.users.email[ue];

            if (row.users_email !== '')
              row.users_email += `
`;

            row.users_email += user.first_name + ' ' + user.last_name + ', ' + user.phone + ', ' + user.email + ';';
          }
        }

        dataset.push(row);
      }
    }

    const report = excel.buildExport(
      [ // <- Notice that this is an array. Pass multiple sheets to create multi sheet report
        {
          name: 'Report', // <- Specify sheet name (optional)
          heading: heading, // <- Raw heading array (optional)
          //merges: merges, // <- Merge cell ranges
          specification: specification, // <- Report specification
          data: dataset // <-- Report data
        }
      ]
    );

    //File name
    let reportFileName = '/report ' + from.getTime() + '_' + to.getTime() + '.xlsx';

    //Relative path
    let relativePath = '/reports/company_' + company_id + '/' + reportFileName;

    //Reports folder
    let reportsFolder = __dirname + '/../../../public/reports';

    //Reports for company folder
    let companyReportsFolder = reportsFolder + '/company_' + company_id;

    //File path
    let filePath = companyReportsFolder + reportFileName;
    
    //Create if not exists
    if (!fs.existsSync(reportsFolder)) {
      fs.mkdirSync(reportsFolder);
    }
    if (!fs.existsSync(companyReportsFolder)) {
      fs.mkdirSync(companyReportsFolder);
    }

    //Open file
    let fd = fs.openSync(filePath, 'w');
    fs.writeSync(fd, report, 0, report.length, null);

    return ctx.send({
      url: strapi.config.API_URL + relativePath
    });
  },

  /**
   * Retrieve count of company records.
   *
   * @return {Object|Array}
   */

  count: async (ctx) => {
    let count = await strapi.services.company.count(ctx.query);
    return ctx.send({
      data: count
    });
  },

  /**
   * Retrieve company records.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    return strapi.services.company.fetchAll(ctx.query);
  },

  /**
   * Retrieve site managers records.
   *
   * @return {Object|Array}
   */

  findCompanyManagers: async (ctx) => {
    //Checking if user is approved
    if(!strapi.services.company.isApproved(ctx))
      return ctx.badRequest(null, 'Access denied! Your company not approved by administrator.');

    const user = ctx.state.user;

    if (ctx.query.site_manager && ctx.query.site_manager.match(/^[0-9a-fA-F]{24}$/)) {
      let mySite = await strapi.services.dashboard.isMySite(ctx.query.site_manager, user);
      if(!mySite){
        ctx.badRequest(null, 'Site not found');
      }
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

    const query = _.assign({
      manager_company: companyId
    }, ctx.query);

    //all query
    const allQuery = _.assign({
      manager_company: companyId
    }, ctx.query);
    delete allQuery._limit;
    delete allQuery._start;

    /*if(user.role.type === 'managers'){
      allQuery.site_manager = user.site_manager._id.toString();
      query.site_manager = user.site_manager._id.toString();
    }*/

    if(user.role.type === 'viewers'){
      allQuery.site_manager = user.site_viewer._id.toString();
      query.site_manager = user.site_viewer._id.toString();
    }

    let all = await strapi.plugins['users-permissions'].services.user.fetchAll(allQuery);
    let data = await strapi.plugins['users-permissions'].services.user.fetchAll(query);

    // Send 200 `ok`
    ctx.send({
      total: all.length || 0,
      list: data
    });
  },

  /**
   * Retrieve site viewers records.
   *
   * @return {Object|Array}
   */

  findCompanyViewers: async (ctx) => {
    //Checking if user is approved
    if(!strapi.services.company.isApproved(ctx))
      return ctx.badRequest(null, 'Access denied! Your company not approved by administrator.');

    const user = ctx.state.user;

    if (ctx.query.site_viewer && ctx.query.site_viewer.match(/^[0-9a-fA-F]{24}$/)) {
      let mySite = await strapi.services.dashboard.isMySite(ctx.query.site_viewer, user);
      if(!mySite){
        ctx.badRequest(null, 'Site not found');
      }
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

    const query = _.assign({
      viewer_company: companyId
    }, ctx.query);

    //all query
    const allQuery = _.assign({
      viewer_company: companyId
    }, ctx.query);
    delete allQuery._limit;
    delete allQuery._start;

    if(user.role.type === 'viewers'){
      allQuery.site_viewer = user.site_viewer._id.toString();
      query.site_viewer = user.site_viewer._id.toString();
    }

    let all = await strapi.plugins['users-permissions'].services.user.fetchAll(allQuery);
    let data = await strapi.plugins['users-permissions'].services.user.fetchAll(query);

    // Send 200 `ok`
    ctx.send({
      total: all.length || 0,
      list: data
    });
  },

  /**
   * Retrieve site managers records.
   *
   * @return {Object|Array}
   */

  findCompanyManager: async (ctx) => {
    //Checking if user is approved
    if(!strapi.services.company.isApproved(ctx))
      return ctx.badRequest(null, 'Access denied! Your company not approved by administrator.');

    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    const user = await strapi.plugins['users-permissions'].services.user.fetch({
      _id: ctx.params._id,
    });
    try{
      if(user.role.type === 'managers')
        return ctx.send(user);

      return ctx.notFound();
    }catch(err){
      return ctx.notFound();
    }
  },

  /**
   * Retrieve site viewers records.
   *
   * @return {Object|Array}
   */

  findCompanyViewer: async (ctx) => {
    //Checking if user is approved
    if(ctx.state.user.role.type === 'company'){
      if(!strapi.services.company.isApproved(ctx))
        return ctx.badRequest(null, 'Access denied! Your company not approved by administrator.');
    }

    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    const user = await strapi.plugins['users-permissions'].services.user.fetch({
      _id: ctx.params._id,
    });
    try{
      if(user.role.type === 'viewers'){
        if(ctx.state.user.role.type === 'company')
          return ctx.send(user);

        if(ctx.state.user.role.type === 'managers'){
          if(ctx.state.user.manager_company.id === user.viewer_company.id)
            return ctx.send(user);
        }

      }

      return ctx.notFound();
    }catch(err){
      return ctx.notFound();
    }
  },

  /**
   * Update a/an manager record.
   *
   * @return {Object}
   */

  updateManager: async (ctx, next) => {
    //Checking if user is approved
    if(!strapi.services.company.isApproved(ctx))
      return ctx.badRequest(null, 'Access denied! Your company not approved by administrator.');

    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    try {
      const advancedConfigs = await strapi.store({
        environment: '',
        type: 'plugin',
        name: 'users-permissions',
        key: 'advanced'
      }).get();

      const user = await strapi.plugins['users-permissions'].services.user.fetch(ctx.params);
      /*if(user.site_manager._id.toString() !== ctx.params.site_id)
        return ctx.notFound();*/

      if (ctx.request.body.site_manager && ctx.request.body.site_manager.match(/^[0-9a-fA-F]{24}$/) && (!user.site_manager || (ctx.request.body.site_manager !== user.site_manager._id.toString()))) {
        //Check if site users reach max
        const site = await strapi.services.site.fetch({
          _id: ctx.request.body.site_manager
        });

        let count = 1;
        if (site) {
          if (site.managers && site.managers.length)
            count += site.managers.length;

          if (site.viewers && site.viewers.length)
            count += site.viewers.length;
        }

        //Check if max users
        if (count > strapi.config.COMPANY_USERS_MAX)
          return ctx.badRequest(null, "Can't create new user! You can create maximum " + strapi.config.COMPANY_USERS_MAX + " users per site.");

        //Check if managers max users
        if ((site.managers.length + 1) > strapi.config.COMPANY_MANAGERS_MAX)
          return ctx.badRequest(null, "Can't create new manager! You can create maximum " + strapi.config.COMPANY_MANAGERS_MAX + " managers per site.");
      }

      if (advancedConfigs.unique_email && ctx.request.body.email && _.get(ctx.request, 'body.email') !== user.email) {
        const users = await strapi.plugins['users-permissions'].services.user.fetchAll({ email: ctx.request.body.email });

        if (users && _.find(users, user => (user.id || user._id).toString() !== ctx.params._id)) {
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

      if (_.get(ctx.request, 'body.password') === user.password){
        delete ctx.request.body.password;
      }

      if (_.get(ctx.request, 'body.role', '').toString() === '0' && (!_.get(ctx.state, 'user.role') || _.get(ctx.state, 'user.role', '').toString() !== '0')) {
        delete ctx.request.body.role;
      }

      const data = await strapi.plugins['users-permissions'].services.user.edit(ctx.params, ctx.request.body) ;

      // Send 200 `ok`
      ctx.send(data);
    } catch(error) {
      ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: error.message, field: error.field }] }] : error.message);
    }
  },

  /**
   * Update a/an viewer record.
   *
   * @return {Object}
   */

  updateViewer: async (ctx, next) => {
    //Checking if user is approved
    if(ctx.state.user.role.type === 'company'){
      if(!strapi.services.company.isApproved(ctx))
        return ctx.badRequest(null, 'Access denied! Your company not approved by administrator.');
    }

    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    try {
      const advancedConfigs = await strapi.store({
        environment: '',
        type: 'plugin',
        name: 'users-permissions',
        key: 'advanced'
      }).get();

      const user = await strapi.plugins['users-permissions'].services.user.fetch(ctx.params);
      /*if(user.site_viewer._id.toString() !== ctx.params.site_id)
        return ctx.notFound();*/

      if (ctx.request.body.site_viewer && ctx.request.body.site_viewer.match(/^[0-9a-fA-F]{24}$/) && (!user.site_viewer || (ctx.request.body.site_viewer !== user.site_viewer._id.toString()))) {
        //Check if site users reach max
        const site = await strapi.services.site.fetch({
          _id: ctx.request.body.site_viewer
        });

        let count = 1;
        if (site) {
          if (site.managers && site.managers.length)
            count += site.managers.length;

          if (site.viewers && site.viewers.length)
            count += site.viewers.length;
        }

        //Check if max users
        if (count > strapi.config.COMPANY_USERS_MAX)
          return ctx.badRequest(null, "Can't create new user! You can create maximum " + strapi.config.COMPANY_USERS_MAX + " users per site.");
      }

      if(ctx.state.user.role.type === 'managers'){
        if(ctx.state.user.site_manager._id.toString() !== user.site_viewer._id.toString())
          return ctx.badRequest(null, 'Access denied! You can edit only viewers from own site.');
      }

      if (advancedConfigs.unique_email && ctx.request.body.email && _.get(ctx.request, 'body.email') !== user.email) {
        const users = await strapi.plugins['users-permissions'].services.user.fetchAll({ email: ctx.request.body.email });

        if (users && _.find(users, user => (user.id || user._id).toString() !== ctx.params.id)) {
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

      if (_.get(ctx.request, 'body.password') === user.password){
        delete ctx.request.body.password;
      }

      if (_.get(ctx.request, 'body.role', '').toString() === '0' && (!_.get(ctx.state, 'user.role') || _.get(ctx.state, 'user.role', '').toString() !== '0')) {
        delete ctx.request.body.role;
      }

      const data = await strapi.plugins['users-permissions'].services.user.edit(ctx.params, ctx.request.body) ;

      // Send 200 `ok`
      ctx.send(data);
    } catch(error) {
      ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: error.message, field: error.field }] }] : error.message);
    }
  },

  /**
   * Retrieve a company record.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    return strapi.services.company.fetch(ctx.params);
  },

  /**
   * Try verify user by code from sms
   *
   * @return {Object}
   */

  verifyMe: async (ctx) => {
    const user = ctx.state.user;
    if(!user){
      return ctx.badRequest(null, 'Auth key is missing');
    }

    //Check if user already verified
    if(user.verified){
      return ctx.badRequest(null, 'You already verified');
    }

    //Get code
    var code = ctx.request.body.code;

    //Check if code avaliable
    if(!code){
      return ctx.badRequest(null, 'The verification code is missing');
    }

    //Check if code is correct
    if(parseInt(code) !== user.verify_code){
      return ctx.badRequest(null, 'The verification code is incorrect.');
    }

    //Prepare user update
    let updateUser = _.assign({}, user);
    delete updateUser.password;
    delete updateUser.company_admin;

    //Verify user
    updateUser.verified = true;
    const data = await strapi.plugins['users-permissions'].services.user.edit(user, updateUser);

    ctx.send('OK');
  },

  /**
   * Send verify code to auth user by SMS
   *
   * @return {Object}
   */

  sendVerifyCode: async (ctx) => {
    const user = ctx.state.user;
    if(!user){
      return ctx.badRequest(null, 'Auth key is missing');
    }

    //Check if user already verified
    if(user.verified){
      return ctx.badRequest(null, 'You already verified');
    }

    //Import twilio sms module
    const twilioClient = require('twilio')(strapi.config.TWILIO_SID, strapi.config.TWILIO_TOKEN);

    //Generate verify code (8 length)
    const verifyCode = Math.floor(Math.random() * 900000) + 100000;

    //Update verify code for user
    let updateUser = _.assign({}, user);
    updateUser.verify_code = verifyCode;

    //Fix bug with clear password
    delete updateUser.password;
    delete updateUser.company_admin;

    const data = await strapi.plugins['users-permissions'].services.user.edit(user, updateUser);

    let smsBody = {
      body: 'Verify code: ' + verifyCode,
      from: strapi.config.TWILIO_PHONE,
      to: user.phone
    };

    if (smsBody.to.toString().substring(0, 3) === '380')
      smsBody.to = '+' + smsBody.to.toString();

    //Send message to his number
    twilioClient.messages
      .create(smsBody)
      .then(message => {}, err => {})
      .done();

    ctx.send('OK');
  },

  /**
   * Register user and company record.
   *
   * @return {Object}
   */

  register: async (ctx) => {
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
    const role = await strapi.plugins['users-permissions'].services.userspermissions.getRoleByType(settings.default_role);
    if (!role) {
      return ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: 'Auth.form.error.role.notFound' }] }] : 'Impossible to find the root role.');
    }

    // Check if the provided identifier is an email or not.
    const isEmail = emailRegExp.test(params.identifier);

    if (isEmail) {
      params.identifier = params.identifier.toLowerCase();
    }

    params.role = role._id || role.id;
    //params.password = await strapi.plugins['users-permissions'].services.user.hashPassword(params);

    try {
      const user = await strapi.plugins['users-permissions'].services.user.add(params);

      //Default megabites - for demo (20mb)
      await strapi.services.payment.addCustomMegabites(user, +strapi.config.DEMO_MEGABITES);

      //add relation user admin
      params.admin = user.id;

      //Create company
      const company = await strapi.services.company.add(params);

      ctx.send({
        jwt: strapi.plugins['users-permissions'].services.jwt.issue(_.pick(user.toJSON ? user.toJSON() : user, ['_id', 'id'])),
        user: _.assign({company_admin: company}, _.omit(user.toJSON ? user.toJSON() : user, ['password', 'resetPasswordToken']))
      });
    } catch(err) {
      const adminError = _.includes(err.message, 'username') ? 'Auth.form.error.username.taken' : 'Auth.form.error.email.taken';

      ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: adminError }] }] : err.message);
    }
  },

  /**
   * Register manager for company record.
   *
   * @return {Object}
   */

  registerManager: async (ctx) => {
    //Checking if user is approved
    if(!strapi.services.company.isApproved(ctx))
      return ctx.badRequest(null, 'Access denied! Your company not approved by administrator.');

    return strapi.services.company.registerCompanyUser(ctx, 'managers');
  },

  /**
   * Register viewer for company record.
   *
   * @return {Object}
   */

  registerViewer: async (ctx) => {
    //Checking if user is approved
    if(ctx.state.user.role.type === 'company'){
      if(!strapi.services.company.isApproved(ctx))
        return ctx.badRequest(null, 'Access denied! Your company not approved by administrator.');
    }

    return strapi.services.company.registerCompanyUser(ctx, 'viewers');
  },

  /**
   * Register manager for company record.
   *
   * @return {Object}
   */

  createCompanyManager: async (ctx) => {
    //Checking if user is approved
    if(!strapi.services.company.isApproved(ctx))
      return ctx.badRequest(null, 'Access denied! Your company not approved by administrator.');

    return strapi.services.company.registerCompanyUser(ctx, 'managers');
  },

  /**
   * Register viewer for company record.
   *
   * @return {Object}
   */

  createCompanyViewer: async (ctx) => {
    //Checking if user is approved
    if(!strapi.services.company.isApproved(ctx))
      return ctx.badRequest(null, 'Access denied! Your company not approved by administrator.');

    return strapi.services.company.registerCompanyUser(ctx, 'viewers');
  },

  /**
   * Create a/an company record.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    return strapi.services.company.add(ctx.request.body);
  },

  /**
   * Update a/an company record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    const company = await strapi.services.company.findById(ctx.params._id);

    //Edit company admin
    if(company.admin && company.admin.id){
      try {
        const advancedConfigs = await strapi.store({
          environment: '',
          type: 'plugin',
          name: 'users-permissions',
          key: 'advanced'
        }).get();

        const user = await strapi.plugins['users-permissions'].services.user.fetch({_id: company.admin.id});

        if (advancedConfigs.unique_email && ctx.request.body.email && _.get(ctx.request, 'body.email') !== user.email) {
          const users = await strapi.plugins['users-permissions'].services.user.fetchAll({ email: ctx.request.body.email });

          if (users && _.find(users, user => (user.id || user._id).toString() !== ctx.params.id)) {
            return ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: 'Auth.form.error.email.taken', field: ['email'] }] }] : 'Email is already taken.');
          }
        }

        if (_.get(ctx.request, 'body.password') && _.get(ctx.request, 'body.password') === user.password){
          delete ctx.request.body.password;
        }

        if (_.get(ctx.request, 'body.role', '').toString() === '0' && (!_.get(ctx.state, 'user.role') || _.get(ctx.state, 'user.role', '').toString() !== '0')) {
          delete ctx.request.body.role;
        }

        if(_.get(ctx.request, 'body.phone') && _.get(ctx.request, 'body.phone') != user.phone){
          ctx.request.body.verified = false;
          ctx.request.body.verify_code = '';
        }

        if (_.get(ctx.request, 'body.add_traffic')){
          await strapi.services.payment.addCustomMegabites(user, +ctx.request.body.add_traffic);
          delete ctx.request.body.add_traffic;
        }

        const data = await strapi.plugins['users-permissions'].services.user.edit({id: company.admin.id}, ctx.request.body);
      } catch(error) {
        return ctx.badRequest(null, ctx.request.admin ? [{ messages: [{ id: error.message, field: error.field }] }] : error.message);
      }
    }

    return strapi.services.company.edit(ctx.params, ctx.request.body);
  },

  /**
   * Destroy a/an company record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    return strapi.services.company.remove(ctx.params);
  },

  /**
   * Destroy a/an company manager.
   *
   * @return {Object}
   */

  destroyManager: async (ctx, next) => {
    //Checking if user is approved
    if(!strapi.services.company.isApproved(ctx))
      return ctx.badRequest(null, 'Access denied! Your company not approved by administrator.');

    /*if (!ctx.params.site_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }*/

    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Check if site belong to user
    /*let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, ctx.state.user);
    if(!mySite){
      return ctx.notFound();
    }*/

    //const user = await strapi.plugins['users-permissions'].services.user.fetch({_id: ctx.params._id});
    try{
      const data = await strapi.plugins['users-permissions'].services.user.remove(ctx.params);
      return ctx.send(data);
    }catch(err){
      return ctx.notFound();
    }
  },

  /**
   * Destroy a/an company viewer.
   *
   * @return {Object}
   */

  destroyViewer: async (ctx, next) => {
    //Checking if user is approved
    if(ctx.state.user.role.type === 'company'){
      if(!strapi.services.company.isApproved(ctx))
        return ctx.badRequest(null, 'Access denied! Your company not approved by administrator.');
    }

    /*if (!ctx.params.site_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }*/

    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Check if site belong to user
    /*let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, ctx.state.user);
    if(!mySite){
      return ctx.notFound();
    }*/

    //const user = await strapi.plugins['users-permissions'].services.user.fetch({_id: ctx.params._id});
    try{
      const data = await strapi.plugins['users-permissions'].services.user.remove(ctx.params);
      return ctx.send(data);
    }catch(err){
      return ctx.notFound();
    }
  }
};
