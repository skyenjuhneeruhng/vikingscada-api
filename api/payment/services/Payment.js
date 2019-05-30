'use strict';

/**
 * Payment.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

// Public dependencies.
const _ = require('lodash');
const fs = require('fs');

module.exports = {

  /**
   * Calc traffic for user by sensor id
   *
   * @return {Promise}
   */

  paymentWebhook: async (ctx, payment_system = 'stripe') => {

    //Event data
    const body = ctx.request.body;
    //const body = JSON.parse('{"id":"evt_1Ds8WADOY7wCyIHUoZp0upjp","object":"event","api_version":"2018-08-23","created":1547384206,"data":{"object":{"id":"in_1Ds7ZxDOY7wCyIHUIwXMtkmh","object":"invoice","amount_due":100,"amount_paid":0,"amount_remaining":100,"application_fee":null,"attempt_count":1,"attempted":true,"auto_advance":true,"billing":"charge_automatically","billing_reason":"subscription_cycle","charge":"ch_1Ds8W5DOY7wCyIHU4RTgdYxr","closed":false,"currency":"usd","customer":"cus_EK2ZEkH2I9irIB","date":1547380597,"default_source":null,"description":null,"discount":null,"due_date":null,"ending_balance":0,"finalized_at":1547384201,"forgiven":false,"hosted_invoice_url":"https://pay.stripe.com/invoice/invst_zRAYgdBrlXkpOVgoxnCp3qtY6l","invoice_pdf":"https://pay.stripe.com/invoice/invst_zRAYgdBrlXkpOVgoxnCp3qtY6l/pdf","lines":{"object":"list","data":[{"id":"sli_2bef7660e284aa","object":"line_item","amount":100,"currency":"usd","description":"1 100mb × 100MB (at $1.00 / day)","discountable":true,"livemode":true,"metadata":{},"period":{"end":1547466443,"start":1547380043},"plan":{"id":"plan_EK0AaayfKdikNG","object":"plan","active":true,"aggregate_usage":null,"amount":100,"billing_scheme":"per_unit","created":1547198310,"currency":"usd","interval":"day","interval_count":1,"livemode":true,"metadata":{},"nickname":"Bronze","product":"prod_EK09uisFZMktxW","tiers":null,"tiers_mode":null,"transform_usage":null,"trial_period_days":null,"usage_type":"licensed"},"proration":false,"quantity":1,"subscription":"sub_EK2ZzTOCBYRbOB","subscription_item":"si_EK2ZO0iZUsMREW","type":"subscription"}],"has_more":false,"total_count":1,"url":"/v1/invoices/in_1Ds7ZxDOY7wCyIHUIwXMtkmh/lines"},"livemode":true,"metadata":{},"next_payment_attempt":1547902601,"number":"B6EA5FD-0003","paid":false,"period_end":1547380043,"period_start":1547293643,"receipt_number":null,"starting_balance":0,"statement_descriptor":null,"status":"open","subscription":"sub_EK2ZzTOCBYRbOB","subtotal":100,"tax":0,"tax_percent":null,"total":100,"webhooks_delivered_at":1547380599}},"livemode":true,"pending_webhooks":1,"request":{"id":null,"idempotency_key":null},"type":"invoice.payment_failed"}');

    //Check if payment system is stripe
    if (payment_system === 'stripe') {

      //Initialize stripe
      const stripe = require('stripe')(strapi.config.STRIPE_TOKEN);

      //Twillio notifications
      const twilioClient = require('twilio')(strapi.config.TWILIO_SID, strapi.config.TWILIO_TOKEN);

      //Success payment invoice or failed
      if (body.type && (body.type === 'invoice.payment_succeeded' || body.type === 'invoice.payment_failed')) {
        const data = (body.data && body.data.object) ? body.data.object : null;
        if (data && data.subscription) {

          try{
            //Get subscribition
            const subscription = await stripe.subscriptions.retrieve(data.subscription);

            //Get customer
            const customer = await stripe.customers.retrieve(subscription.customer);
            
            //Get user object
            let user = await strapi.plugins['users-permissions'].services.user.fetchAll({
              email: customer.email
            });
            user = user[0] || null;

            //If user found
            if(user) {

              //Get plan
              const plan = await stripe.plans.retrieve(subscription.plan.id);

              //Get user plan from DB
              let planObject = await await strapi.services.payment.fetchAll({
                user: user._id.toString(),
                type: 'subscribe',
                status: 'subscribed',
                custom_plan_id: subscription.plan.id
              });
              planObject = (planObject.list && planObject.list[0]) ? planObject.list[0] : null;

              //If plan is exists
              if (planObject) {

                //Get product info
                const product = await stripe.products.retrieve(plan.product);

                //First subscribition payment
                if (data.billing_reason === 'subscription_update') {
                  if (body.type === 'invoice.payment_succeeded') {
                    let phone = ''+user.phone;

                    if (phone.substring(0, 3) === '380')
                      phone = '+' + phone;

                    //Send sms notification
                    twilioClient.messages
                      .create({
                        body: 'Congratulations! You have successfully purchased subscription "' + product.name + '", on ' + strapi.config.APP_URL + '/invoice/' + planObject._id.toString() + ' you can go to the invoice.',
                        from: strapi.config.TWILIO_PHONE,
                        to: phone
                      })
                      .then(message => {}, err => {})
                      .done();

                    //Send email notification
                    let emailNotify = strapi.plugins['email'].services.email.getTemplate('buy_subscribe_success');
                    emailNotify.message = 'Congratulations! You have successfully purchased subscription "' + product.name + '", on <a href="' + strapi.config.APP_URL + '/invoice/' + planObject._id.toString() + '">this link</a> you can go to the invoice.';

                    try {
                      await strapi.plugins['email'].services.email.send({
                        to: user.email,
                        from: `"${emailNotify.from.name}" <${emailNotify.from.email}>`,
                        replyTo: emailNotify.response_email,
                        subject: emailNotify.object,
                        text: emailNotify.message,
                        html: emailNotify.message
                      });
                    } catch (e) {}
                  } else if (body.type === 'invoice.payment_failed') {
                    //Unsubscribe user
                    await strapi.services.payment.unsubscribe(user);

                    let phone = '' + user.phone;

                    if (phone.substring(0, 3) === '380')
                      phone = '+' + phone;

                    //Send sms notification
                    twilioClient.messages
                      .create({
                        body: 'You tried to pay the subscription "' + product.name + '", but unfortunately the payment was not successful. Check the balance on your bank card or contact customer support.',
                        from: strapi.config.TWILIO_PHONE,
                        to: phone
                      })
                      .then(message => {}, err => {})
                      .done();

                    //Send email notification
                    let emailNotify = strapi.plugins['email'].services.email.getTemplate('buy_subscribe_failed');
                    emailNotify.message = 'You tried to pay the subscription "' + product.name + '", but unfortunately the payment was not successful. Check the balance on your bank card or contact customer support.';

                    try {
                      await strapi.plugins['email'].services.email.send({
                        to: user.email,
                        from: `"${emailNotify.from.name}" <${emailNotify.from.email}>`,
                        replyTo: emailNotify.response_email,
                        subject: emailNotify.object,
                        text: emailNotify.message,
                        html: emailNotify.message
                      });
                    } catch (e) {}
                  }
                }

                //Subscribe cycle
                else if (data.billing_reason === 'subscription_cycle') {

                  if (body.type === 'invoice.payment_succeeded') {

                    //If success then add payment transaction
                    await strapi.services.payment.edit({
                      _id: planObject._id.toString()
                    }, {
                      user: user._id.toString(),
                      type: 'subscribe',
                      custom_plan_id: plan.id
                    });

                    //Add megabites to user
                    var mb = parseInt(product.unit_label.replace('mb', ''));
                    await strapi.services.payment.addSubscribeMegabites(user, mb);

                    let phone = '' + user.phone;

                    if (phone.substring(0, 3) === '380')
                      phone = '+' + phone;

                    //Send sms notification
                    twilioClient.messages
                      .create({
                        body: 'Congratulations! You have successfully extended subscription "' + product.name + '", on ' + strapi.config.APP_URL + '/invoice/' + planObject._id.toString() + ' you can go to the invoice.',
                        from: strapi.config.TWILIO_PHONE,
                        to: phone
                      })
                      .then(message => {}, err => {})
                      .done();

                    //Send email notification
                    let emailNotify = strapi.plugins['email'].services.email.getTemplate('buy_subscribe_success');
                    emailNotify.object = 'You have successfully extended subscription!';
                    emailNotify.message = 'Congratulations! You have successfully extended subscription "' + product.name + '", on <a href="' + strapi.config.APP_URL + '/invoice/' + planObject._id.toString() + '">this link</a> you can go to the invoice.';

                    try {
                      await strapi.plugins['email'].services.email.send({
                        to: user.email,
                        from: `"${emailNotify.from.name}" <${emailNotify.from.email}>`,
                        replyTo: emailNotify.response_email,
                        subject: emailNotify.object,
                        text: emailNotify.message,
                        html: emailNotify.message
                      });
                    } catch (e) {}
                  } else if (body.type === 'invoice.payment_failed') {
                    //Unsubscribe user
                    await strapi.services.payment.unsubscribe(user);

                    let phone = '' + user.phone;

                    if (phone.substring(0, 3) === '380')
                      phone = '+' + phone;

                    //Send sms notification
                    twilioClient.messages
                      .create({
                        body: 'You tried to renew your subscription "' + product.name + '", but unfortunately the payment was not successful. Check the balance on your bank card or contact customer support.',
                        from: strapi.config.TWILIO_PHONE,
                        to: phone
                      })
                      .then(message => {}, err => {})
                      .done();

                    //Send email notification
                    let emailNotify = strapi.plugins['email'].services.email.getTemplate('buy_subscribe_failed');
                    emailNotify.message = 'You tried to renew your subscription "' + product.name + '", but unfortunately the payment was not successful. Check the balance on your bank card or contact customer support.';

                    try {
                      await strapi.plugins['email'].services.email.send({
                        to: user.email,
                        from: `"${emailNotify.from.name}" <${emailNotify.from.email}>`,
                        replyTo: emailNotify.response_email,
                        subject: emailNotify.object,
                        text: emailNotify.message,
                        html: emailNotify.message
                      });
                    } catch (e) {}
                  }
                }
              }

            }
          }catch(e){
            console.error('PAYMENT WEBHOOK', e);
          }
        }
      }
    }

    //Log for dev
    try{
      await strapi.services.payment.logPaymentWebhook(ctx, payment_system);
    }catch(e) { 
      //
    }
  },

  /**
   * Log payment webhook
   *
   * @return {Promise}
   */

  logPaymentWebhook: async (ctx, payment_system = 'stripe') => {

    //Project settings
    const LOGPATH = __dirname + '/../../../logs';

    //Check if log folder exists, if not - create
    if (!fs.existsSync(LOGPATH)) {
      fs.mkdirSync(LOGPATH);
    }

    const date = new Date();

    //Prepare file name
    const fileName = '/' + date.getFullYear() + '_' + (date.getMonth() + 1) + '_' + date.getDate() + '_stripe_webhook.txt';

    if (payment_system === 'stripe'){
      //Prepare log object
      let logItem = {
        type: '',
        query: {},
        params: {},
        body: {},
        date: date.toUTCString()
      };

      //Find type
      logItem.type = (typeof ctx.request.body === typeof 'string') ? 'string' : 'object';

      logItem.query = ctx.query;
      logItem.params = ctx.params;
      logItem.body = (logItem.type === 'string')? JSON.parse(ctx.request.body) : ctx.request.body;

      //Write message
      let newMessage = '[' + logItem.date + '] ::' + logItem.type + `::---> 
::::::: QUERY: ` + JSON.stringify(logItem.query) + `:::::::
::::::: PARAMS: ` + JSON.stringify(logItem.params) + `::::::: 
::::::: BODY: ` + JSON.stringify(logItem.body) + `:::::::
<--- END
`;

      //Read content from file
      fs.readFile(LOGPATH + fileName, 'utf8', (err, contents) => {
        contents = contents || '';

        //Add message to file
        contents += newMessage;

        //Write into file
        fs.writeFile(LOGPATH + fileName, contents, (err) => {
          if (err)
            console.log(err);
        });
      });
    }
  },

  /**
   * Calc traffic for user by sensor id
   *
   * @return {Promise}
   */

  calcTrafic: async (sensor_id, message) => {
    //Get sensor
    const sensor = await strapi.services.sensor.fetch({
      _id: sensor_id
    });
    if(!sensor)
      return false;

    //Check if sensor has site and site has company
    if (!sensor.site || (sensor.site && !sensor.site.company))
      return false;

    //Get gateway
    const gateways = await strapi.services.gateway.fetchAll({
      site: sensor.site._id.toString()
    });
    const gateway = (gateways.list && gateways.list.length) ? gateways.list[0] : null;
    if (!gateway)
      return false;

    //Get users
    const users = await strapi.plugins['users-permissions'].services.user.fetchAll({
      company_admin: sensor.site.company
    });
    if (!users.length){
      //Restart gateway
      strapi.eventEmitter.emit('gateway:restart', gateway._id.toString());
      return false;
    }

    //Get user
    const user = users[0];
    
    //Get traffic
    let traffic = await strapi.services.payment.getTraffic(user);
    if (traffic <= 0){
      //Restart gateway
      strapi.eventEmitter.emit('gateway:restart', gateway._id.toString());
      return {
        traffic: 'off',
        user_id: user._id.toString()
      };
    }

    //Calc bytes in message
    let bytes = Buffer.byteLength(''+message, 'utf8');

    //Add topic length
    bytes += 37;
    
    //Check if traffic allowed
    if ((traffic - bytes) < 0) {
      //Restart gateway
      strapi.eventEmitter.emit('gateway:restart', gateway._id.toString());
      
      return {
        traffic: 'off',
        user_id: user._id.toString()
      };
    }

    let newTraffic = await strapi.services.payment.refreshTraffic(user, bytes);
    if (newTraffic === false){
      //Restart gateway
      strapi.eventEmitter.emit('gateway:restart', gateway._id.toString());

      return {
        traffic: 'off',
        user_id: user._id.toString()
      };
    }

    return {
      traffic: traffic,
      user_id: user._id.toString()
    };
  },

  /**
   * Re calc user traffic
   *
   * @return {Promise}
   */

  refreshTraffic: async (user, bytes) => {
    var result = {
      user_id: user._id.toString(),
      traffic: 0
    };

    //If custom exists
    if (user.custom_bytes){
      let customTraffic = parseInt(user.custom_bytes) - parseInt(bytes);

      //If custom traffic allowed
      if (customTraffic > 0) {
        await strapi.plugins['users-permissions'].services.user.edit({
          _id: user._id.toString()
        }, {
          custom_bytes: customTraffic
        });

        //Notification

        result.traffic = await strapi.services.payment.getTraffic({
          subscribe_bytes: user.subscribe_bytes,
          custom_bytes: customTraffic
        });

      }else{
        //Make positive
        customTraffic = Math.abs(customTraffic);

        //Calc subscribe traffic
        var subscribeTraffic = parseInt(user.subscribe_bytes) - parseInt(customTraffic);

        //If traffic allowed
        if (subscribeTraffic > 0) {
          await strapi.plugins['users-permissions'].services.user.edit({
            _id: user._id.toString()
          }, {
            custom_bytes: 0,
            subscribe_bytes: subscribeTraffic
          });

          result.traffic = subscribeTraffic;

        //If traffic disalowed
        } else {
          await strapi.plugins['users-permissions'].services.user.edit({
            _id: user._id.toString()
          }, {
            custom_bytes: 0,
            subscribe_bytes: subscribeTraffic
          });

          if (subscribeTraffic < 0)
            return false;
        }
      }
    } else if (!user.custom_bytes && user.subscribe_bytes) {
      let subscribeTraffic = parseInt(user.subscribe_bytes) - parseInt(bytes);

      //If traffic allowed
      await strapi.plugins['users-permissions'].services.user.edit({
        _id: user._id.toString()
      }, {
        custom_bytes: 0,
        subscribe_bytes: subscribeTraffic
      });

      result.traffic = subscribeTraffic;

    } else {
      let subscribeTraffic = 0 - parseInt(bytes);

      await strapi.plugins['users-permissions'].services.user.edit({
        _id: user._id.toString()
      }, {
        custom_bytes: 0,
        subscribe_bytes: subscribeTraffic
      });

      result.traffic = subscribeTraffic;
    }

    return result;
  },

  /**
   * Add subscrive megabites to account
   *
   * @return {Promise}
   */

  addSubscribeMegabites: async (user, mb) => {
    var result = true;

    //Prepare megabites
    mb = parseInt(mb);

    //Get user subscribe bytes
    let bytes = user.subscribe_bytes || 0;

    //Prepare mb to bytes
    //let addBytes = (mb * 1024 * 1024) + bytes; //If need add exists bytes
    let addBytes = (mb * 1024 * 1024);

    await strapi.plugins['users-permissions'].services.user.edit({
      _id: user._id.toString()
    }, {
      subscribe_bytes: addBytes
    });

    return result;
  },

  /**
   * Add custom megabites to account
   *
   * @return {Promise}
   */

  addCustomMegabites: async (user, mb) => {
    var result = true;

    //Prepare megabites
    mb = parseInt(mb);

    //Get user custom bytes
    let bytes = user.custom_bytes || 0;

    //Prepare mb to bytes
    let addBytes = (mb * 1024 * 1024) + bytes; //If need add exists bytes

    await strapi.plugins['users-permissions'].services.user.edit({
      _id: user._id.toString()
    }, {
      custom_bytes: addBytes
    });

    return result;
  },

  /**
   * Get user traffic
   *
   * @return {Promise}
   */

  getTraffic: async (user, type = null) => {
    let subscribeMegabytes = user.subscribe_bytes || 0;
    let customMegabites = user.custom_bytes || 0;

    if(type === 'subscribe')
      return parseInt(subscribeMegabytes);

    if(type === 'custom')
      return parseInt(customMegabites);
    
    return parseInt(subscribeMegabytes + customMegabites);
  },

  /**
   * unsubscribe user
   *
   * @return {Promise}
   */

  unsubscribe: async (user, transactionId = null) => {
    var fetchParams = {
      user: user._id.toString(),
      type: 'subscribe'
    };
    if (transactionId)
      fetchParams._id = transactionId;

    const transactions = await strapi.services.payment.fetchAll(fetchParams);
    
    //Check if exists
    if (transactions.list && transactions.list.length) {
      
      //Make charge
      const stripe = require('stripe')(strapi.config.STRIPE_TOKEN);

      //Get customer
      var customers = await stripe.customers.list({
        email: user.email
      });
      
      if (customers.data && customers.data.length) {
        
        var customer = customers.data[0];

        //Check if user has subscribition
        if (customer.subscriptions && customer.subscriptions.data && customer.subscriptions.data.length){
          for (var s = 0; s < customer.subscriptions.data.length; s++) {
            var subs = customer.subscriptions.data[s];

            //Cancel
            await stripe.subscriptions.del(subs.id);
          }
        }
      }
      
      for (var i = 0; i < transactions.list.length; i++){
        var trans = transactions.list[i];

        //Change status
        await strapi.services.payment.edit({
          _id: trans._id.toString()
        }, {
          status: 'unsubscribed'
        });
      }
    }

    //User lost subscribe bytes
    await strapi.plugins['users-permissions'].services.user.edit({
      _id: user._id.toString()
    }, {
      subscribe_bytes: 0
    });
  },

  /**
   * Get user transaction by id.
   *
   * @return {Promise}
   */

  getTransaction: async (transaction_id, user_id) => {
    const transaction = await strapi.services.payment.fetch({
      _id: transaction_id
    });
    if (!transaction)
      return null;
    
    if (!transaction.user)
      return null;

    if (transaction.user._id.toString() !== user_id)
      return null;
    
    //Make charge
    const stripe = require('stripe')(strapi.config.STRIPE_TOKEN);

    //Prepare data
    if (transaction.type === 'custom') {
      let transactionData = {
        _id: transaction._id.toString(),
        id: transaction._id.toString(),
        type: transaction.type,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
        user: transaction.user,
        payment_name: transaction.payment_name || '',
        payment_desc: transaction.payment_desc || '',
        purchased: transaction.purchased || ''
      };

      //Add plan relation
      transactionData.custom_plan = await strapi.services.plan.fetch({
        _id: transaction.custom_plan_id
      });
      
      return transactionData;
    } else if (transaction.type === 'subscribe') {
      let transactionData = {
        _id: transaction._id.toString(),
        id: transaction._id.toString(),
        type: transaction.type,
        status: transaction.status,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
        user: transaction.user,
        payment_name: transaction.payment_name || '',
        payment_desc: transaction.payment_desc || '',
        purchased: transaction.purchased || ''
      };

      //Add plan relation
      transactionData.subscribe = await stripe.plans.retrieve(transaction.custom_plan_id);

      return transactionData;
    }

    return null;
  },

  /**
   * Get user transactions.
   *
   * @return {Promise}
   */

  getTransactions: async (user_id, query = {}) => {
    let params = _.assign(query, {
      user: user_id
    });
    const transactions = await strapi.services.payment.fetchAll(params);
    
    //Make charge
    const stripe = require('stripe')(strapi.config.STRIPE_TOKEN);

    //Prepare data
    var result = {
      total: transactions.total || 0,
      list: []
    };
    if (transactions.list.length){
      for (var i = 0; i < transactions.list.length; i++){
        //for custom
        if (transactions.list[i].type === 'custom'){
          let transaction = {
            _id: transactions.list[i]._id.toString(),
            id: transactions.list[i]._id.toString(),
            type: transactions.list[i].type,
            createdAt: transactions.list[i].createdAt,
            updatedAt: transactions.list[i].updatedAt,
            user: transactions.list[i].user,
            payment_name: transactions.list[i].payment_name || '',
            payment_desc: transactions.list[i].payment_desc || '',
            purchased: transactions.list[i].purchased || ''
          };

          //Add plan relation
          transaction.custom_plan = await strapi.services.plan.fetch({
            _id: transactions.list[i].custom_plan_id
          });

          //Add to result
          result.list.push(transaction);
        } else if (transactions.list[i].type === 'subscribe') {
          let transaction = {
            _id: transactions.list[i]._id.toString(),
            id: transactions.list[i]._id.toString(),
            type: transactions.list[i].type,
            status: transactions.list[i].status,
            createdAt: transactions.list[i].createdAt,
            updatedAt: transactions.list[i].updatedAt,
            user: transactions.list[i].user,
            payment_name: transactions.list[i].payment_name || '',
            payment_desc: transactions.list[i].payment_desc || '',
            purchased: transactions.list[i].purchased || ''
          };

          //Add plan relation
          transaction.subscribe = await stripe.plans.retrieve(transactions.list[i].custom_plan_id);

          //Add to result
          result.list.push(transaction);
        }
      }
    }

    return result;
  },

  /**
   * Promise to fetch all payments.
   *
   * @return {Promise}
   */

  fetchAll: (params) => {
    const convertedParams = strapi.utils.models.convertParams('payment', params);

    //prepare list of response
    let response = {total: 0, list: []};

    //Get total
    return Payment
      .find()
      .where(convertedParams.where)
      .sort(convertedParams.sort)
      .populate(_.keys(_.groupBy(_.reject(strapi.models.payment.associations, {autoPopulate: false}), 'alias')).join(' ')).count().then(function(count){
        response.total = count;
        return Payment
          .find()
          .where(convertedParams.where)
          .sort(convertedParams.sort)
          .skip(convertedParams.start)
          .limit(convertedParams.limit)
          .populate(_.keys(_.groupBy(_.reject(strapi.models.payment.associations, {autoPopulate: false}), 'alias')).join(' ')).exec().then(function(items){
            response.list = items;
            return response;
          });
      });
  },

  /**
   * Promise to fetch a/an payment.
   *
   * @return {Promise}
   */

  fetch: (params) => {
    return Payment
      .findOne(_.pick(params, _.keys(Payment.schema.paths)))
      .populate(_.keys(_.groupBy(_.reject(strapi.models.payment.associations, {autoPopulate: false}), 'alias')).join(' '));
  },

  /**
   * Promise to add a/an payment.
   *
   * @return {Promise}
   */

  add: async (values) => {
    const query = await Payment.create(_.omit(values, _.keys(_.groupBy(strapi.models.payment.associations, 'alias'))));
    const data = query.toJSON ? query.toJSON() : query;

    await strapi.hook.mongoose.manageRelations('payment', _.merge(data, { values }));

    return query;
  },

  /**
   * Promise to edit a/an payment.
   *
   * @return {Promise}
   */

  edit: async (params, values) => {
    // Note: The current method will return the full response of Mongo.
    // To get the updated object, you have to execute the `findOne()` method
    // or use the `findOneOrUpdate()` method with `{ new:true }` option.
    await strapi.hook.mongoose.manageRelations('payment', _.merge(_.clone(params), { values }));
    return Payment.update(params, values, { multi: true });
  },

  /**
   * Promise to remove a/an payment.
   *
   * @return {Promise}
   */

  remove: async params => {
    // Note: To get the full response of Mongo, use the `remove()` method
    // or add spent the parameter `{ passRawResult: true }` as second argument.
    const data = await Payment.findOneAndRemove(params, {})
      .populate(_.keys(_.groupBy(_.reject(strapi.models.payment.associations, {autoPopulate: false}), 'alias')).join(' '));

    _.forEach(Payment.associations, async association => {
      const search = (_.endsWith(association.nature, 'One')) ? { [association.via]: data._id } : { [association.via]: { $in: [data._id] } };
      const update = (_.endsWith(association.nature, 'One')) ? { [association.via]: null } : { $pull: { [association.via]: data._id } };

      await strapi.models[association.model || association.collection].update(
        search,
        update,
        { multi: true });
    });

    return data;
  }
};
