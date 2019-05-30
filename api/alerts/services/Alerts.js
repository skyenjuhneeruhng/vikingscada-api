'use strict';

/**
 * Alerts.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

// Public dependencies.
const _ = require('lodash');
const URI = require("uri-js");

const uniqid = require('uniqid');

module.exports = {

  /**
   * Communication failer error
   */
  communicationFailer: async (gateway_id) => {
    if (!gateway_id.match(/^[0-9a-fA-F]{24}$/)) {
      return;
    }

    const gateway = await strapi.services.gateway.fetch({
      _id: gateway_id
    });

    if(!gateway)
      return;

    if (gateway.site){
      const site = await strapi.services.site.fetch({
        _id: gateway.site._id.toString()
      });

      if(site && site.company){
        const company = await strapi.services.company.fetch({
          _id: site.company._id.toString()
        });

        if(company && company.admin){
          //Make communication failer notification
          const twilioClient = require('twilio')(strapi.config.TWILIO_SID, strapi.config.TWILIO_TOKEN);

          let smsBody = {
            body: 'Warning! Your gateway "'+gateway.name+'" is offline.',
            from: strapi.config.TWILIO_PHONE,
            to: company.admin.phone
          };

          try{
            twilioClient.messages
              .create(smsBody)
              .then(message => {}, err => {})
              .done();
          } catch(e){}
          
          //Make email notification
          let emailNotify = strapi.plugins['email'].services.email.getTemplate('alert_notification');

          try {
            await strapi.plugins['email'].services.email.send({
              to: company.admin.email,
              from: `"${emailNotify.from.name}" <${emailNotify.from.email}>`,
              replyTo: emailNotify.response_email,
              subject: 'Gateway is offline',
              text: 'Warning! Your gateway "' + gateway.name + '" is offline.',
              html: 'Warning! Your gateway "' + gateway.name + '" is offline.'
            });
          } catch (e) {}

        }
      }
    }
  },

  /**
   * Check if value of stream need to be emit alert
   * 
   * @return {Promise}
   */
  checkEmitAlert: async (sensor_id, value, bitmask = false) => {
    if (!bitmask)
      value = +value;

    const sensor = await strapi.services.sensor.fetch({
      _id: sensor_id
    });

    //Get all widgets attached to this sensor
    const widgets = await strapi.services.widget.fetchAll({
      sensor: sensor_id,
      _limit: 100000
    }, true);
    if(widgets.list && widgets.list.length) {
      var alertrules = [];
      var dashboard = null;
      for(var i = 0; i < widgets.list.length; i++){
        if (widgets.list[i].dashboard && !dashboard)
          dashboard = widgets.list[i].dashboard;

        if (widgets.list[i].alert_rule){
          if(!bitmask){
            alertrules.push({
              low: widgets.list[i].alert_rule.low,
              normal: widgets.list[i].alert_rule.normal,
              danger: widgets.list[i].alert_rule.danger,
              widget_id: widgets.list[i]._id.toString(),
              widget_title: widgets.list[i].title
            });
          } else if (bitmask && widgets.list[i].alert_rule.bitmask) {
            alertrules.push({
              bitmask: widgets.list[i].alert_rule.bitmask,
              widget_id: widgets.list[i]._id.toString(),
              widget_title: widgets.list[i].title
            });
          }
        }
          
      }

      //Checking if alerts are needed
      let emitAlerts = [];
      for(var y = 0; y < alertrules.length; y++){
        let alert = alertrules[y];

        if(alert.bitmask){
          let previousValue = await strapi.services.data.fetchAll({
            sensor_id: sensor_id,
            _sort: 'createdAt:desc',
            _limit: 1
          });
          
          //Init bitmask
          var alertBitmask = alert.bitmask;
          if (typeof alertBitmask === typeof "string"){
            try{
              alertBitmask = JSON.parse(alert.bitmask);
            }catch(e){}
          }

          if (previousValue && previousValue[0] && previousValue[0].bitmask) {
            //console.log(value, alert.bitmask, previousValue[0].bitmask);
            var previousBitmask = previousValue[0].bitmask;

            if (typeof alertBitmask === typeof {}) {
              //Loop all values
              for (var ival = 0; ival < value.length; ival++) {
                let singleValue = value[ival];
                let objectKeys = Object.keys(singleValue);

                //Check if previous bitmask same as previous - if false - check alert
                if (typeof alertBitmask[objectKeys[0]] === typeof 1 && typeof previousBitmask[ival][objectKeys[0]] === typeof 1) {
                  if (singleValue[objectKeys[0]] !== previousBitmask[ival][objectKeys[0]]) {

                    //Check if value exists
                    if (singleValue[objectKeys[0]] === alertBitmask[objectKeys[0]]) {
                      emitAlerts.push({
                        type: 'bitmask',
                        widget_id: alert.widget_id,
                        widget_title: alert.widget_title,
                        bit: objectKeys[0],
                        alert_value: (alertBitmask[objectKeys[0]] === 1) ? 'On' : 'Off'
                      });
                    }

                  }
                }
              }

            }

          }else{
            if (typeof alertBitmask === typeof {}) {
              //Loop all values
              for (var ival = 0; ival < value.length; ival++) {
                let singleValue = value[ival];
                let objectKeys = Object.keys(singleValue);

                //Check if value exists
                if (typeof alertBitmask[objectKeys[0]] === typeof 1) {
                  //If value same as alert
                  if (singleValue[objectKeys[0]] === alertBitmask[objectKeys[0]]) {
                    emitAlerts.push({
                      type: 'bitmask',
                      widget_id: alert.widget_id,
                      widget_title: alert.widget_title,
                      bit: objectKeys[0],
                      alert_value: (alertBitmask[objectKeys[0]] === 1) ? 'On' : 'Off'
                    });
                  }
                }
              }

            }
          }
        } else {
          //Low - disabled
          /*if(value >= alert.low && value < alert.normal) {
            emitAlerts.push({
              type: 'low',
              widget_id: alert.widget_id,
              widget_title: alert.widget_title
            });
          }*/

          //Normal
          if (value >= alert.normal && value < alert.danger) {
            emitAlerts.push({
              type: 'normal',
              widget_id: alert.widget_id,
              widget_title: alert.widget_title,
              alert_value: alert.normal
            });
          }

          //High
          if (value >= alert.danger) {
            emitAlerts.push({
              type: 'danger',
              widget_id: alert.widget_id,
              widget_title: alert.widget_title,
              alert_value: alert.danger
            });
          }
        }
      }

      //If errors empty - return false
      if (!emitAlerts.length)
        return false;

      //Prepare company users
      let company = null;
      if (dashboard){
        dashboard = await strapi.services.dashboard.fetch({
          _id: dashboard._id.toString()
        });

        //Check if dashboard has site
        if(dashboard.site){
          let site = await strapi.services.site.fetch({
            _id: dashboard.site._id.toString()
          });

          //Check if site has company
          if(site.company){
            company = await strapi.services.company.fetch({
              _id: site.company._id.toString()
            });

            //Users
            let company_id = company._id.toString();
            let admin = company.admin || null;
            let managers = company.managers || [];
            let viewers = company.viewers || [];

            //Get company settings for alarms
            let alarms = {
              alert_sms_admin: company.alert_sms_admin,
              alert_sms_managers: company.alert_sms_managers,
              alert_sms_viewers: company.alert_sms_viewers,
              alert_email_admin: company.alert_email_admin,
              alert_email_managers: company.alert_email_managers,
              alert_email_viewers: company.alert_email_viewers,
            };

            //Prepare alarms for users
            let allUsersNotify = [];
            let smsUsersNotify = [];
            let emailUsersNotify = [];

            //Push admin
            if(admin)
              allUsersNotify.push({
                _id: admin._id.toString(),
                email: admin.email,
                phone: admin.phone
              });

            if (alarms.alert_sms_admin)
              smsUsersNotify.push({
                _id: admin._id.toString(),
                email: admin.email,
                phone: admin.phone,
                first_name: admin.first_name,
                last_name: admin.last_name
              });

            if (alarms.alert_email_admin)
              emailUsersNotify.push({
                _id: admin._id.toString(),
                email: admin.email,
                phone: admin.phone,
                first_name: admin.first_name,
                last_name: admin.last_name
              });

            //Push managers
            for(var j = 0; j < managers.length; j++){
              let manager = managers[j];
              let notifyUser = {
                _id: manager._id.toString(),
                email: manager.email,
                phone: manager.phone,
                first_name: manager.first_name,
                last_name: manager.last_name
              };

              //Simple notification
              allUsersNotify.push(notifyUser);

              //SMS
              if (alarms.alert_sms_managers)
                smsUsersNotify.push(notifyUser);

              //Email
              if (alarms.alert_email_managers)
                emailUsersNotify.push(notifyUser);
            }

            //Push viewers
            for (var j = 0; j < viewers.length; j++) {
              let viewer = viewers[j];
              let notifyUser = {
                _id: viewer._id.toString(),
                email: viewer.email,
                phone: viewer.phone,
                first_name: viewer.first_name,
                last_name: viewer.last_name
              };

              //Simple notification
              allUsersNotify.push(notifyUser);

              //SMS
              if (alarms.alert_sms_managers)
                smsUsersNotify.push(notifyUser);

              //Email
              if (alarms.alert_email_managers)
                emailUsersNotify.push(notifyUser);
            }

            let result = {
              notifies: emitAlerts,
              users: allUsersNotify
            };

            //Send voice notification
            var voiceUsersNotify = await strapi.services.alerts.getPriorities('voice', company_id);
            strapi.services.alerts.makeNotification('voice', emitAlerts, voiceUsersNotify, company_id, sensor_id, value);

            //Acknowledge code
            const acknowledgeSMSCode = uniqid.time() + uniqid() + uniqid.process();

            //Send sms notification
            const twilioClient = require('twilio')(strapi.config.TWILIO_SID, strapi.config.TWILIO_TOKEN);
            for (var k = 0; k < smsUsersNotify.length; k++){
              for (var iw = 0; iw < emitAlerts.length; iw++) {
                let smsBody = {
                  body: 'Warning! This is a Viking SCADA Alert, '+sensor.name+' has reached ' + value,
                  from: strapi.config.TWILIO_PHONE,
                  to: smsUsersNotify[k].phone
                };

                if (smsBody.to.toString().substring(0, 3) === '380')
                  smsBody.to = '+' + smsBody.to.toString();

                if (emitAlerts[iw].type === 'danger'){
                  smsBody.body = 'Danger! This is a Viking SCADA Alert, ' + sensor.name + ' has reached ' + value;
                }

                //Bitmask alerts
                if (emitAlerts[iw].type === 'bitmask') {
                  smsBody.body = 'Warning! This is a Viking SCADA Alert, ' + sensor.name + ' On/Off Bit ' + emitAlerts[iw].bit + ' is in an ' + emitAlerts[iw].alert_value + ' State';
                }

                //Add acknowledge link
                smsBody.body += '. Click ' + strapi.config.APP_URL + '/sms/confirm/' + acknowledgeSMSCode + ' to confirm receiving this notification.';

                //Import twilio sms module
                try{
                  twilioClient.messages
                    .create(smsBody)
                    .then(message => {}, err => {})
                    .done();
                }catch(e){}
              }
            }

            //Create alerts for sms
            for (var ae = 0; ae < emitAlerts.length; ae++) {
              let emitAlert = emitAlerts[ae];

              let newAlert = (emitAlert.type === 'bitmask') ? {
                type: emitAlert.type,
                widget_title: emitAlert.widget_title,
                widget_id: emitAlert.widget_id,
                sensor_id: sensor_id,
                bit: emitAlert.bit,
                sensor_value: (emitAlert.alert_value === 'On') ? 0 : 1,
                alert_value: (emitAlert.alert_value === 'On') ? 1 : 0,
                company_id: company_id,
                users: {
                  sms: smsUsersNotify,
                  //email: emailUsersNotify
                },
                sms_code: acknowledgeSMSCode
              } : {
                type: (emitAlert.type === 'normal') ? 'warning' : emitAlert.type,
                widget_title: emitAlert.widget_title,
                widget_id: emitAlert.widget_id,
                sensor_id: sensor_id,
                sensor_value: value,
                alert_value: emitAlert.alert_value,
                company_id: company_id,
                users: {
                  sms: smsUsersNotify,
                  //email: emailUsersNotify
                },
                sms_code: acknowledgeSMSCode
              };

              await strapi.services.alerts.add(newAlert);
            }

            //Acknowledge code
            const acknowledgeEmailCode = uniqid.time() + uniqid() + uniqid.process();

            //Email notification 
            for (var e = 0; e < emailUsersNotify.length; e++) {
              for (var ew = 0; ew < emitAlerts.length; ew++) {
                let emailNotify = strapi.plugins['email'].services.email.getTemplate('alert_notification');
                emailNotify.message = 'This is a Viking SCADA Alert! ' + sensor.name + ' has reached ' + value;

                if (emitAlerts[ew].type === 'danger') {
                  emailNotify.object = 'Danger!';
                  emailNotify.message = 'Danger! This is a Viking SCADA Alert! ' + sensor.name + ' has reached ' + value;
                }

                //Bitmask alerts
                if (emitAlerts[ew].type === 'bitmask') {
                  emailNotify.message = 'Warning! This is a Viking SCADA Alert, ' + sensor.name + ' On/Off Bit ' + emitAlerts[ew].bit + ' is in an ' + emitAlerts[ew].alert_value + ' State';
                }

                //Add acknowledge confirm
                emailNotify.message += '. Click <a href="' + strapi.config.APP_URL + '/email/confirm/' + acknowledgeEmailCode + '">this link</a> to confirm receiving this notification.';

                try{
                  await strapi.plugins['email'].services.email.send({
                    to: emailUsersNotify[e].email,
                    from: `"${emailNotify.from.name}" <${emailNotify.from.email}>`,
                    replyTo: emailNotify.response_email,
                    subject: emailNotify.object,
                    text: emailNotify.message,
                    html: emailNotify.message
                  });
                } catch(e) {}
              }
            }

            //Create alerts for email
            for (var aee = 0; aee < emitAlerts.length; aee++) {
              let emitAlert = emitAlerts[aee];

              let newAlert = (emitAlert.type === 'bitmask') ? {
                type: emitAlert.type,
                widget_title: emitAlert.widget_title,
                widget_id: emitAlert.widget_id,
                sensor_id: sensor_id,
                bit: emitAlert.bit,
                sensor_value: (emitAlert.alert_value === 'On') ? 0 : 1,
                alert_value: (emitAlert.alert_value === 'On') ? 1 : 0,
                company_id: company_id,
                users: {
                  email: emailUsersNotify
                },
                email_code: acknowledgeEmailCode
              } : {
                type: (emitAlert.type === 'normal') ? 'warning' : emitAlert.type,
                widget_title: emitAlert.widget_title,
                widget_id: emitAlert.widget_id,
                sensor_id: sensor_id,
                sensor_value: value,
                alert_value: emitAlert.alert_value,
                company_id: company_id,
                users: {
                  email: emailUsersNotify
                },
                email_code: acknowledgeEmailCode
              };

              await strapi.services.alerts.add(newAlert);
            }

            return result;
          }
        }
      }

      
      return true;
    }

    return false;
  },

  /**
   * Return array with alert priorities
   * 
   * @param {String} - type = voice, sms, email
   * @param {String}
   * 
   * @return {Array}
   */
  getPriorities: async (type, company_id) => {
    //Get company
    const company = await strapi.services.company.fetch({
      _id: company_id
    });

    //Get priorities
    let prioritiesCount = await strapi.services.alertpriority.count({
      type: type,
      company: company._id.toString(),
      _sort: 'priority'
    });

    //If priorities empty
    if (!prioritiesCount) {
      var priority = 1;

      //First add admin as 1 priority
      await strapi.services.alertpriority.add({
        priority: priority,
        type: type,
        company: company._id.toString(),
        user: company.admin._id.toString()
      });

      //Increment priority
      priority++;

      //Second add managers if exists
      if (company.managers.length) {
        for (var m = 0; m < company.managers.length; m++) {
          await strapi.services.alertpriority.add({
            priority: priority,
            type: type,
            company: company._id.toString(),
            user: company.managers[m]._id.toString()
          });

          //Increment priority
          priority++;
        }
      }

      //Second add viewers if exists
      if (company.viewers.length) {
        for (var v = 0; v < company.viewers.length; v++) {
          await strapi.services.alertpriority.add({
            priority: priority,
            type: type,
            company: company._id.toString(),
            user: company.viewers[v]._id.toString()
          });

          //Increment priority
          priority++;
        }
      }

      //Try get priority and return
      let priorities = await strapi.services.alertpriority.fetchAll({
        type: type,
        company: company._id.toString(),
        _sort: 'priority'
      });

      return priorities;
    }

    //Fix priorities
    await strapi.services.alertpriority.fixPriority(company._id.toString(), type);

    //Try get priority and return
    let priorities = await strapi.services.alertpriority.fetchAll({
      type: type,
      company: company._id.toString(),
      _sort: 'priority'
    });

    //Get only enabled priorities
    var result = [];
    for (var p = 0; p < priorities.length; p++){
      if (priorities[p].enabled)
        result.push(priorities[p]);
    }

    return result;
  },

  /**
   * Make alerts scene by type, alert object and company_id
   * 
   * @return {Void}
   */
  makeNotification: async (type, alerts, priorityUsers, company_id, sensor_id, sensor_value, attemptUser = 0, attemptAlert = 0) => {

    //Get sensor
    const sensor = await strapi.services.sensor.fetch({
      _id: sensor_id
    });
    
    //Check if attempt is last
    if ((attemptUser+1) > priorityUsers.length) {
      const company = await strapi.services.company.fetch({
        _id: company_id
      });

      if (company && company.admin) {
        //If yes - call admin and stop

        if ((attemptAlert + 1) <= alerts.length) {
          let alert = alerts[attemptAlert];

          let date = new Date();
          //Prepare params to find
          let params = (alert.type === 'bitmask') ? {
            sensor_id: sensor_id,
            bit: alert.bit,
            _limit: 1,
            sid_ne: null,
            createdAt_gte: new Date(date.getTime() - 60 * 60000)
          } : {
            sensor_id: sensor_id,
            _limit: 1,
            sid_ne: null,
            createdAt_gte: new Date(date.getTime() - 60 * 60000)
          };

          //Get last alert for this sensor
          const alertsList = await strapi.services.alerts.fetchAll(params);

          //If alert exists
          if (alertsList.list && alertsList.list.length) {
            let alertItem = alertsList.list[0];

            if (alertItem.readed) {
              return;
            }
          }
          
          const client = require('twilio')(strapi.config.TWILIO_SID, strapi.config.TWILIO_TOKEN);

          let url = strapi.config.API_URL + '/public/alert/config';
          if (alert.type === 'bitmask')
            url += '?type=bitmask&sensor_name=' + sensor.name + '&sensor_value=' + alert.alert_value + '&bit=' + alert.bit;
          else
            url += '?type=' + alert.type + '&sensor_name=' + sensor.name + '&sensor_value=' + alert.alert_value + '';

          //Add admin param
          url += '&is_admin=true';

          url = URI.serialize(URI.parse(url));

          //Fix phone
          let phone = company.admin.phone;
          if (phone.toString().substring(0, 3) === '380')
            phone = '+' + phone.toString();

          client.calls
            .create({
              url: url,
              to: phone,
              from: '+19183471847'
            })
            .then(async call => {
              console.log(call.sid);
            })
            .done();
        }

        setTimeout(() => {
          strapi.services.alerts.makeNotification(type, alerts, priorityUsers, company_id, sensor_id, sensor_value, 0, (attemptAlert + 1));
        }, 60000);
      }

      return;
    }

    //Check if alert avaliable
    if ((attemptAlert + 1) <= alerts.length){
      let alert = alerts[attemptAlert];

      let date = new Date();
      //Prepare params to find
      let params = (alert.type === 'bitmask') ? {
        sensor_id: sensor_id,
        bit: alert.bit,
        _limit: 1,
        sid_ne: null,
        createdAt_gte: new Date(date.getTime() - 60 * 60000)
      } : {
        sensor_id: sensor_id,
        _limit: 1,
        sid_ne: null,
        createdAt_gte: new Date(date.getTime() - 60 * 60000)
      };

      //Get last alert for this sensor
      const alertsList = await strapi.services.alerts.fetchAll(params);
      
      //If alert exists
      if (alertsList.list && alertsList.list.length){
        let alertItem = alertsList.list[0];

        if (alertItem.readed){
          //Stop alerts
          return;
        }else{
          const alertUser = priorityUsers[attemptUser];
          const client = require('twilio')(strapi.config.TWILIO_SID, strapi.config.TWILIO_TOKEN);

          let url = strapi.config.API_URL + '/public/alert/config';
          if (alert.type === 'bitmask')
            url += '?type=bitmask&sensor_name=' + sensor.name + '&sensor_value=' + alert.alert_value + '&bit=' + alert.bit;
          else
            url += '?type=' + alert.type + '&sensor_name=' + sensor.name + '&sensor_value=' + alert.alert_value + '';

          url = URI.serialize(URI.parse(url));

          //Fix phone
          let phone = alertUser.user.phone;
          if (phone.toString().substring(0, 3) === '380')
            phone = '+' + phone.toString();

          client.calls
            .create({
              url: url,
              to: phone,
              from: '+19183471847'
            })
            .then(async call => {
              //Edit alert
              await strapi.services.alerts.edit({
                _id: alertItem._id.toString()
              }, {
                sid: call.sid
              });

              setTimeout(() => {
                strapi.services.alerts.makeNotification(type, alerts, priorityUsers, company_id, sensor_id, sensor_value, (attemptUser + 1), attemptAlert);
              }, 60000);
            })
            .done();
        }

      //If no alert exists
      }else{
        const alertUser = priorityUsers[attemptUser];
        const client = require('twilio')(strapi.config.TWILIO_SID, strapi.config.TWILIO_TOKEN);

        let url = strapi.config.API_URL + '/public/alert/config';
        if (alert.type === 'bitmask')
          url += '?type=bitmask&sensor_name=' + sensor.name + '&sensor_value=' + alert.alert_value + '&bit=' + alert.bit;
        else
          url += '?type=' + alert.type + '&sensor_name=' + sensor.name + '&sensor_value=' + sensor_value + '';

        url = URI.serialize(URI.parse(url));

        //Fix phone
        let phone = alertUser.user.phone;
        if (phone.toString().substring(0, 3) === '380')
          phone = '+' + phone.toString();

        client.calls
          .create({
            url: url,
            to: phone,
            from: '+19183471847'
          })
          .then(async call => {
            //Add new alert
            let newAlert = (alert.type === 'bitmask') ? {
              type: alert.type,
              widget_title: alert.widget_title,
              widget_id: alert.widget_id,
              sensor_id: sensor_id,
              bit: alert.bit,
              sensor_value: (alert.alert_value === 'On') ? 0 : 1,
              alert_value: (alert.alert_value === 'On') ? 1 : 0,
              company_id: company_id,
              users: {
                voice: priorityUsers,
              },
              sid: call.sid
            } : {
              type: (alert.type === 'normal') ? 'warning' : alert.type,
              widget_title: alert.widget_title,
              widget_id: alert.widget_id,
              sensor_id: sensor_id,
              sensor_value: sensor_value,
              alert_value: alert.alert_value,
              company_id: company_id,
              users: {
                voice: priorityUsers
              },
              sid: call.sid
            };

            await strapi.services.alerts.add(newAlert);

            setTimeout(() => {
              strapi.services.alerts.makeNotification(type, alerts, priorityUsers, company_id, sensor_id, sensor_value, (attemptUser + 1), attemptAlert);
            }, 60000);
          })
          .done();
      }
    }

  },

  /**
   * Promise to fetch all alerts.
   *
   * @return {Promise}
   */

  fetchAll: (params) => {
    const convertedParams = strapi.utils.models.convertParams('alerts', params);

    //prepare list of response
    let response = {
      total: 0,
      list: []
    };

    //Get total
    return Alerts
      .find()
      .where(convertedParams.where)
      .sort(convertedParams.sort)
      .populate(_.keys(_.groupBy(_.reject(strapi.models.alerts.associations, {
        autoPopulate: false
      }), 'alias')).join(' ')).count().then(function (count) {
        response.total = count;
        return Alerts
          .find()
          .where(convertedParams.where)
          .sort(convertedParams.sort)
          .skip(convertedParams.start)
          .limit(convertedParams.limit)
          .populate(_.keys(_.groupBy(_.reject(strapi.models.alerts.associations, {
            autoPopulate: false
          }), 'alias')).join(' ')).exec().then(function (items) {
            response.list = items;
            return response;
          });
      });
  },

  /**
   * Promise to fetch all alerts.
   *
   * @return {Promise}
   */

  count: (params) => {
    const convertedParams = strapi.utils.models.convertParams('alerts', params);

    //Get total
    return Alerts
      .find()
      .where(convertedParams.where)
      .sort(convertedParams.sort)
      .populate(_.keys(_.groupBy(_.reject(strapi.models.alerts.associations, { autoPopulate: false }), 'alias')).join(' ')).count();
  },

  /**
   * Promise to fetch a/an alerts.
   *
   * @return {Promise}
   */

  fetch: (params) => {
    return Alerts
      .findOne(_.pick(params, _.keys(Alerts.schema.paths)))
      .populate(_.keys(_.groupBy(_.reject(strapi.models.alerts.associations, {autoPopulate: false}), 'alias')).join(' '));
  },

  /**
   * Promise to add a/an alerts.
   *
   * @return {Promise}
   */

  add: async (values) => {
    const query = await Alerts.create(_.omit(values, _.keys(_.groupBy(strapi.models.alerts.associations, 'alias'))));
    const data = query.toJSON ? query.toJSON() : query;

    await strapi.hook.mongoose.manageRelations('alerts', _.merge(data, { values }));

    return query;
  },

  /**
   * Promise to edit a/an alerts.
   *
   * @return {Promise}
   */

  edit: async (params, values) => {
    // Note: The current method will return the full response of Mongo.
    // To get the updated object, you have to execute the `findOne()` method
    // or use the `findOneOrUpdate()` method with `{ new:true }` option.
    await strapi.hook.mongoose.manageRelations('alerts', _.merge(_.clone(params), { values }));
    return Alerts.update(params, values, { multi: true });
  },

  /**
   * Promise to remove a/an alerts.
   *
   * @return {Promise}
   */

  remove: async params => {
    // Note: To get the full response of Mongo, use the `remove()` method
    // or add spent the parameter `{ passRawResult: true }` as second argument.
    const data = await Alerts.findOneAndRemove(params, {})
      .populate(_.keys(_.groupBy(_.reject(strapi.models.alerts.associations, {autoPopulate: false}), 'alias')).join(' '));

    _.forEach(Alerts.associations, async association => {
      const search = (_.endsWith(association.nature, 'One')) ? { [association.via]: data._id } : { [association.via]: { $in: [data._id] } };
      const update = (_.endsWith(association.nature, 'One')) ? { [association.via]: null } : { $pull: { [association.via]: data._id } };

      await strapi.models[association.model || association.collection].update(
        search,
        update,
        { multi: true });
    });

    return data;
  },

  /**
   * Check if widget with sensor id can have alerts
   *
   * @return {Promise}
   */

  checkAlertAvaliable: async (sensor_id, widget_id = null) => {
    //Get sensor
    const sensor = await strapi.services.sensor.fetch({
      _id: sensor_id
    });
    if (!sensor)
      return false;

    var avaliable = true;

    //Check if this sensor not the same as requested
    const widgets = await strapi.services.widget.fetchAll({
      sensor: sensor._id.toString()
    }, true);

    //If widgets avaliable
    if (widgets.list && widgets.list.length) {
      for (var i = 0; i < widgets.list.length; i++) {
        let widgetItem = widgets.list[i];

        if (!widget_id || (widget_id && widgetItem._id.toString() !== widget_id)){
          //Check if widget has alert condition
          if (widgetItem.alert_rule) {
            avaliable = false;
            break;
          }
        }
      }
    }

    return avaliable;
  }
};
