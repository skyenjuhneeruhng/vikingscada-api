'use strict';

/**
 * Payment.js controller
 *
 * @description: A set of functions called "actions" for managing `Payment`.
 */

//Public dependencies
const _ = require('lodash');

module.exports = {

  /**
   * handle webhook request by Stripe
   *
   * @return {Object|Array}
   */

  handleWebHook: async (ctx) => {
    await strapi.services.payment.paymentWebhook(ctx, 'stripe');

    return ctx.send({ok: true});
  },

  /**
   * Get public key for Stripe
   *
   * @return {Object|Array}
   */

  getPublicKey: async (ctx) => {
    const publicKey = strapi.config.STRIPE_PUBLIC_TOKEN;
    if(!publicKey)
      return ctx.notFound();

    return ctx.send(publicKey);
  },

  /**
   * Get plans from stripe
   *
   * @return {Object|Array}
   */

  getPlans: async (ctx) => {
    //Init stripe
    const stripe = require('stripe')(strapi.config.STRIPE_TOKEN);

    //List of plans
    const listOfPlans = await stripe.plans.list();

    //Result
    var result = []
    var plans = listOfPlans.data || [];

    //Update result
    if (plans.length) {
      for (var i = 0; i < plans.length; i++) {
        result.push({
          id: plans[i].id,
          title: plans[i].nickname,
          desc: plans[i].metadata,
          product: plans[i].product,
          amount: plans[i].amount,
          currency: plans[i].currency,
          interval: plans[i].interval,
          usage_type: plans[i].usage_type
        });
      }
    }

    ctx.send(result);
  },

  /**
   * Unsubscribe me
   *
   * @return {Object|Array}
   */

  unsubscribeMe: async (ctx) => {
    await strapi.services.payment.unsubscribe(ctx.state.user);

    return ctx.send({ok: true});
  },

  /**
   * Create checkout with stripe for custom megabites
   *
   * @return {Object|Array}
   */

  buySubscribe: async (ctx) => {
    const planId = ctx.params._id || null;
    if(!planId)
      return ctx.send({ok: false});

    //Check if email undefined
    if (!ctx.request.body.stripeEmail)
      return ctx.send({ok: false});

    //Check if token is avaliable
    if (!ctx.request.body.stripeToken)
      return ctx.send({ok: false});

    const users = await strapi.plugins['users-permissions'].services.user.fetchAll({
      email: ctx.request.body.stripeEmail
    });
    const user = (users.length) ? users[0] : null;

    if (!user)
      return ctx.send({ok: false});

    if (!user.company_admin)
      return ctx.send({ok: false});
    
    //Make charge
    const stripe = require('stripe')(strapi.config.STRIPE_TOKEN);

    //Check if plan is exists
    try{
      var plan = await stripe.plans.retrieve(planId);
    } catch (e){
      //
    }
    if(!plan){
      return ctx.send({ok: false});
    }

    var product = await stripe.products.retrieve(plan.product);

    //Find customer if exists
    var customers = await stripe.customers.list({
      email: ctx.request.body.stripeEmail
    });
    
    var customer = null;
    if (customers.data && customers.data.length){
      customer = customers.data[0];
    }else{
      //Create customer
      customer = await stripe.customers.create({
        email: ctx.request.body.stripeEmail,
        source: ctx.request.body.stripeToken
      });
    }

    if(!customer)
      return ctx.send({ok: false});

    //First unsubscribe customer
    await strapi.services.payment.unsubscribe(user);

    //Create subscribition
    var subscribe = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{
        plan: plan.id,
      }]
    });

    if(!subscribe){
      return ctx.send({ok: false});
    }

    //If status not active
    if(subscribe.status !== 'active'){
      return ctx.send({ok: false});
    }

    //Prepare metadesc
    let metadesc = '';
    if (plan.metadata && typeof plan.metadata === typeof {}){
      let keys = Object.keys(plan.metadata);
      for(var mk = 0; mk < keys.length; mk++){
        if(metadesc !== ''){
          metadesc += ' , ' + plan.metadata[mk];
        } else {
          metadesc += plan.metadata[mk];
        }
      }
    }

    //If success then add payment transaction
    const invoice = await strapi.services.payment.add({
      user: user._id.toString(),
      type: 'subscribe',
      custom_plan_id: plan.id,
      payment_name: product.name,
      payment_desc: metadesc,
      purchased: +plan.amount
    });

    //Add megabites to user
    var mb = parseInt(product.unit_label.replace('mb', ''));
    await strapi.services.payment.addSubscribeMegabites(user, mb);

    let sites = await strapi.services.site.fetchAll({
      company: user.company_admin._id.toString()
    });
    sites = (sites.list && sites.list.length) ? sites.list : [];

    //Update gateways
    if (sites.length) {
      for (var i = 0; i < sites.length; i++) {
        if (sites[i].gateway && sites[i].gateway.length) {
          for (var y = 0; y < sites[i].gateway.length; y++){
            strapi.eventEmitter.emit('gateway:restart', sites[i].gateway[y]._id.toString());
          }
        }
      }
    }

    //Send email notification
    let emailNotify = strapi.plugins['email'].services.email.getTemplate('buy_subscribe');
    emailNotify.message = 'Congratulations! You have successfully purchased the subscription "' + product.unit_label + '", on <a href="' + strapi.config.APP_URL + '/invoice/' + invoice._id.toString() + '">this link</a> you can go to the invoice.';

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

    //Redirect to success page
    return ctx.send({ok: true});
  },

  /**
   * Create checkout with stripe for custom megabites
   *
   * @return {Object|Array}
   */

  buyCustomMegabites: async (ctx) => {
    //What is go from stripe payment
    /*ctx.request.body = {
      stripeToken: 'tok_1D7JDyK586tfBGVsWkkXe0dT',
      stripeTokenType: 'card',
      stripeEmail: 'rtes@tea.sd'
    };*/

    //Check if email undefined
    if (!ctx.request.body.stripeEmail)
      return ctx.send({ok: false});

    const users = await strapi.plugins['users-permissions'].services.user.fetchAll({
      email: ctx.request.body.stripeEmail
    });
    const user = (users.length) ? users[0] : null;

    if (!user)
      return ctx.send({ok: false});

    if (!user.company_admin)
      return ctx.send({ok: false});
    
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) 
      return ctx.send({ok: false});

    //Try to get plan
    const plan = await strapi.services.plan.fetch({_id: ctx.params._id});
    if (!plan)
      return ctx.send({ok: false});

    //Check if token is avaliable
    if (!ctx.request.body.stripeToken)
      return ctx.send({ok: false});
    
    //Make charge
    const stripe = require('stripe')(strapi.config.STRIPE_TOKEN);

    //Try charge
    const token = ctx.request.body.stripeToken; // Using Express

    const charge = await stripe.charges.create({
      amount: plan.price,
      currency: 'usd',
      description: 'Customer ' + user.email + ' from company ' + user.company_admin.company_name + ' bought ' + plan.mb + 'MB',
      source: token,
    });

    //If payment failed
    if (!charge.paid)
      return ctx.send({ok: false});

    //If success then add payment transaction
    const invoice = await strapi.services.payment.add({
      user: user._id.toString(),
      type: 'custom',
      custom_plan_id: plan._id.toString(),
      payment_name: plan.name,
      payment_desc: plan.desc,
      purchased: +plan.price
    });

    //Add megabites to user
    await strapi.services.payment.addCustomMegabites(user, +plan.mb);

    let sites = await strapi.services.site.fetchAll({
      company: user.company_admin._id.toString()
    });
    sites = (sites.list && sites.list.length) ? sites.list : [];

    //Update gateways
    if (sites.length) {
      for (var i = 0; i < sites.length; i++) {
        if (sites[i].gateway && sites[i].gateway.length) {
          for (var y = 0; y < sites[i].gateway.length; y++) {
            strapi.eventEmitter.emit('gateway:restart', sites[i].gateway[y]._id.toString());
          }
        }
      }
    }

    //Send email notification
    let emailNotify = strapi.plugins['email'].services.email.getTemplate('buy_custom');
    emailNotify.message = 'Congratulations! You have successfully purchased ' + plan.mb + 'mb, on <a href="' + strapi.config.APP_URL + '/invoice/' + invoice._id.toString() + '">this link</a> you can go to the invoice.';

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

    //Redirect to success page
    return ctx.send({ok: true});

    /*
      charge = {
        id: 'ch_1D7JZKK586tfBGVsdK4p1ftX',
        object: 'charge',
        amount: 1000,
        amount_refunded: 0,
        application: null,
        application_fee: null,
        balance_transaction: 'txn_1D7JZKK586tfBGVsV4pIxVEa',
        captured: true,
        created: 1536225270,
        currency: 'usd',
        customer: null,
        description: 'Buying 100Mb',
        destination: null,
        dispute: null,
        failure_code: null,
        failure_message: null,
        fraud_details: {},
        invoice: null,
        livemode: false,
        metadata: {},
        on_behalf_of: null,
        order: null,
        outcome: {
          network_status: 'approved_by_network',
          reason: null,
          risk_level: 'normal',
          seller_message: 'Payment complete.',
          type: 'authorized'
        },
        paid: true,
        receipt_email: null,
        receipt_number: null,
        refunded: false,
        refunds: {
          object: 'list',
          data: [],
          has_more: false,
          total_count: 0,
          url: '/v1/charges/ch_1D7JZKK586tfBGVsdK4p1ftX/refunds'
        },
        review: null,
        shipping: null,
        source: {
          id: 'card_1D7JZGK586tfBGVsNOlaxO9V',
          object: 'card',
          address_city: null,
          address_country: null,
          address_line1: null,
          address_line1_check: null,
          address_line2: null,
          address_state: null,
          address_zip: null,
          address_zip_check: null,
          brand: 'Visa',
          country: 'US',
          customer: null,
          cvc_check: 'pass',
          dynamic_last4: null,
          exp_month: 11,
          exp_year: 2024,
          fingerprint: 'qljl9hssia53PT36',
          funding: 'credit',
          last4: '4242',
          metadata: {},
          name: 'test@test2.com',
          tokenization_method: null
        },
        source_transfer: null,
        statement_descriptor: null,
        status: 'succeeded',
        transfer_group: null
      }
    */
  },

  /**
   * Retrieve user transactions records.
   *
   * @return {Object|Array}
   */

  getUserTransactions: async (ctx) => {
    if (!ctx.params.user_id.match(/^[0-9a-fA-F]{24}$/)) 
      return ctx.notFound();

    return strapi.services.payment.getTransactions(ctx.params.user_id, ctx.query);
  },

  /**
   * Retrieve user transactions records.
   *
   * @return {Object|Array}
   */

  getUserTransaction: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    if (!ctx.params.user_id.match(/^[0-9a-fA-F]{24}$/))
      return ctx.notFound();

    return strapi.services.payment.getTransaction(ctx.params._id, ctx.params.user_id, ctx.query);
  },

  /**
   * Retrieve my transactions records.
   *
   * @return {Object|Array}
   */

  getMyTransactions: async (ctx) => {
    return strapi.services.payment.getTransactions(ctx.state.user._id.toString(), ctx.query);
  },

  /**
   * Retrieve my transaction records by id.
   *
   * @return {Object|Array}
   */

  getMyTransaction: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    return strapi.services.payment.getTransaction(ctx.params._id, ctx.state.user._id.toString());
  },

  /**
   * Retrieve payment records.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    return strapi.services.payment.fetchAll(ctx.query);
  },

  /**
   * Retrieve a payment record.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    return strapi.services.payment.fetch(ctx.params);
  },

  /**
   * Create a/an payment record.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    return strapi.services.payment.add(ctx.request.body);
  },

  /**
   * Update a/an payment record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    return strapi.services.payment.edit(ctx.params, ctx.request.body) ;
  },

  /**
   * Destroy a/an payment record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    return strapi.services.payment.remove(ctx.params);
  }
};
