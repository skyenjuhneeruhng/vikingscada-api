'use strict';

/**
 * Alerts.js controller
 *
 * @description: A set of functions called "actions" for managing `Alerts`.
 */

module.exports = {

  /**
   * Retrieve alerts records.
   *
   * @return {Object|Array}
   */

  checkAlertAvaliable: async (ctx) => {
    if (!ctx.params.sensor_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    let avaliable = await strapi.services.alerts.checkAlertAvaliable(ctx.params.sensor_id);
    
    return ctx.send({avaliable: avaliable});
  },

  /**
   * Receive alert confirm from sms
   * 
   * @return {Object|Array}
   */
  alertSMSConfirm: async (ctx) => {
    let code = ctx.request.body.code;
    if(!code)
      return ctx.notFound();

    const alerts = await strapi.services.alerts.fetchAll({
      sms_code: code,
      _limit: 1
    });

    if (alerts.list && alerts.list[0] && alerts.list[0]._id) {
      if (alerts.list[0].readed && alerts.list[0].user_readed) {
        return ctx.send({
          ok: false,
          first_name: alerts.list[0].user_readed.first_name,
          last_name: alerts.list[0].user_readed.last_name,
          email: alerts.list[0].user_readed.email,
        });
      }

      let updateAlert = {
        readed: true,
        user_readed: ctx.state.user._id.toString()
      };

      //Update alert to readed
      await strapi.services.alerts.edit({
        _id: alerts.list[0]._id.toString()
      }, updateAlert);

      return ctx.send({ok: true});
    }

    return ctx.notFound();
  },

  /**
   * Receive alert confirm from email
   * 
   * @return {Object|Array}
   */
  alertEmailConfirm: async (ctx) => {
    let code = ctx.request.body.code;
    if(!code)
      return ctx.notFound();

    const alerts = await strapi.services.alerts.fetchAll({
      email_code: code,
      _limit: 1
    });

    if (alerts.list && alerts.list[0] && alerts.list[0]._id) {
      if (alerts.list[0].readed && alerts.list[0].user_readed) {
        return ctx.send({
          ok: false,
          first_name: alerts.list[0].user_readed.first_name,
          last_name: alerts.list[0].user_readed.last_name,
          email: alerts.list[0].user_readed.email,
        });
      }

      let updateAlert = {
        readed: true,
        user_readed: ctx.state.user._id.toString()
      };

      //Update alert to readed
      await strapi.services.alerts.edit({
        _id: alerts.list[0]._id.toString()
      }, updateAlert);

      return ctx.send({ok: true});
    }
    
    return ctx.notFound();
  },

  /**
   * Receive alert confirm from voice call
   * 
   * @return {Object|Array}
   */
  alertConfirm: async (ctx) => {
    //Check if sid exists
    let sid = ctx.request.body.CallSid || null;
    if(sid){
      //Get alert with sid id
      const alerts = await strapi.services.alerts.fetchAll({
        sid: sid,
        _limit: 1
      });
      if (alerts.list && alerts.list[0] && alerts.list[0]._id) {
        let updateAlert = {
          readed: true
        };

        let phoneCalled = ctx.request.body.Called.toString().replace('+', '');

        //Find user who readed
        const users = await strapi.plugins['users-permissions'].services.user.fetchAll({
          phone: phoneCalled,
          _limit: 1
        });
        if (users && users.length && users[0]._id) {
          updateAlert.user_readed = users[0]._id.toString();
        }

        //Update alert to readed
        await strapi.services.alerts.edit({
          _id: alerts.list[0]._id.toString()
        }, updateAlert);
      }
    }

    const VoiceResponse = require('twilio').twiml.VoiceResponse;

    const twiml = new VoiceResponse();

    twiml.say('Thank you for acknowledging the alert.');

    ctx.res.writeHead(200, {
      'Content-Type': 'text/xml'
    });
    ctx.res.end(twiml.toString());
  },

  /**
   * Send alert configuration
   * 
   * @return {Object|Array}
   */
  alertConfig: async (ctx) => {
    const VoiceResponse = require('twilio').twiml.VoiceResponse;

    const twiml = new VoiceResponse();

    let type = ctx.query.type;
    let sensorName = ctx.query.sensor_name;
    let sensorValue = ctx.query.sensor_value;
    let isAdmin = ctx.query.is_admin || false;

    let text = null;

    //If warning
    if (type === 'warning' || type === 'normal') {
      text = 'Warning! This is a Viking SCADA Alert, ' + sensorName + ' has reached ' + sensorValue;

    }else if (type === 'danger'){
      text = 'Danger! This is a Viking SCADA Alert, ' + sensorName + ' has reached ' + sensorValue;

    }else if(type === 'bitmask'){
      let bit = ctx.query.bit || 0;
      text = 'Warning! This is a Viking SCADA Alert, ' + sensorName + ' On/Off Bit ' + bit + ' is in an ' + sensorValue + ' State';
    }
    
    if (!text)
      return ctx.send('');

    twiml.say(text);

    if (!isAdmin) {
      const gather = twiml.gather({
        input: 'dtmf speech',
        action: strapi.config.API_URL + '/public/alert/confirm',
        method: 'POST'
      });
      gather.say('To confirm receipt of the notification, press or say 1. To exit, press #.');
    }else{
      //Add some content for admin
      twiml.say('This alert has not been acknowledged.');
    }

    ctx.res.writeHead(200, {
      'Content-Type': 'text/xml'
    });
    ctx.res.end(twiml.toString());
  },

  /**
   * Retrieve alerts records. 
   *
   * @return {Object|Array}
   */

  getAlertsForWidget: async (ctx) => {
    if (!ctx.params.sensor_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    var dates = ctx.query.date.split(',');
    var result = {};

    for(var d = 0; d < dates.length; d++){
      let currentDate = dates[d];

      var date = (new Date(currentDate) instanceof Date && !isNaN(new Date(currentDate))) ? new Date(currentDate) : new Date(),
        y = date.getFullYear(),
        m = date.getMonth();
      var firstDay = new Date(y, m, 1).getDate();
      var lastDay = new Date(y, m + 1, 0).getDate();

      //Prepare month entry
      result[currentDate] = [];

      for (var i = 0; i < lastDay; i++) {

        let to = (new Date(currentDate) instanceof Date && !isNaN(new Date(currentDate))) ? new Date(currentDate) : new Date();
        let from = (new Date(currentDate) instanceof Date && !isNaN(new Date(currentDate))) ? new Date(currentDate) : new Date();

        from.setDate(i + 1);
        from.setHours(0);
        from.setMinutes(0);
        from.setSeconds(0);
        from.setMilliseconds(0);

        to.setDate(i + 1);
        to.setHours(23);
        to.setMinutes(59);
        to.setSeconds(59);
        to.setMilliseconds(0);

        let dangerAlerts = await strapi.services.alerts.count({
          sensor_id: ctx.params.sensor_id,
          createdAt_gte: from,
          createdAt_lte: to,
          type: 'danger',
        });

        let warningAlerts = await strapi.services.alerts.count({
          sensor_id: ctx.params.sensor_id,
          createdAt_gte: from,
          createdAt_lte: to,
          type: 'warning',
        });

        if (dangerAlerts) {
          result[currentDate].push(2);
        } else if (!dangerAlerts && warningAlerts) {
          result[currentDate].push(1);
        } else {
          result[currentDate].push(0);
        }

      }
    }

    return ctx.send(result); //31days 0 - normal, 1 - warning, 2 - danger
  },

  /**
   * Retrieve alerts records.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    return strapi.services.alerts.fetchAll(ctx.query);
  },

  /**
   * Retrieve a alerts record.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    return strapi.services.alerts.fetch(ctx.params);
  },

  /**
   * Create a/an alerts record.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    return strapi.services.alerts.add(ctx.request.body);
  },

  /**
   * Update a/an alerts record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    return strapi.services.alerts.edit(ctx.params, ctx.request.body) ;
  },

  /**
   * Destroy a/an alerts record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    return strapi.services.alerts.remove(ctx.params);
  }
};
