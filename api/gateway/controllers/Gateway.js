'use strict';

/**
 * Gateway.js controller
 *
 * @description: A set of functions called "actions" for managing `Gateway`.
 */

//Public modules
const _ = require('lodash');

//AWS IoT Cli
const AWSIoTService = require('../../../AwsIoT');

module.exports = {

  /**
   * Retrieve gateway records.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    return strapi.services.gateway.fetchAll(ctx.query);
  },

  /**
   * Retrieve gateway records.
   *
   * @return {Object|Array}
   */

  findGateways: async (ctx) => {
    //Get currect user
    const user = ctx.state.user;

    //Check if site is my
    let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, user);
    if (!mySite) {
      ctx.badRequest(null, 'Site not found');
    }

    //Add to query
    ctx.query.site = ctx.params.site_id;

    return strapi.services.gateway.fetchAll(ctx.query);
  },

  /**
   * Retrieve a gateway record.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    return strapi.services.gateway.fetch(ctx.params);
  },

  /**
   * Retrieve gateway records.
   *
   * @return {Object|Array}
   */

  findGateway: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Get currect user
    const user = ctx.state.user;

    //Check if site is my
    let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, user);
    if (!mySite) {
      ctx.badRequest(null, 'Site not found');
    }

    return strapi.services.gateway.fetch({
      _id: ctx.params._id,
      site: ctx.params.site_id
    });
  },

  /**
   * Update geo location of gateway record.
   *
   * @return {Object}
   */

  saveTrafficGateway: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    const gateway = await strapi.services.gateway.fetch({
      _id: ctx.params._id
    });

    if (!gateway)
      return ctx.notFound();

    if (!gateway.site || (gateway.site && !gateway.site.company))
      return ctx.notFound();

    //Get users
    // const users = await strapi.plugins['users-permissions'].services.user.fetchAll({
    //   company_admin: gateway.site.company
    // });
    // if (!users.length){
    //   //Restart gateway
    //   strapi.eventEmitter.emit('gateway:restart', gateway._id.toString());
    //   return false;
    // }
    //
    // //Get user
    // const user = users[0];
    //
    // let bytes = ctx.request.body.sent || 0;
    // bytes = +bytes;
    //
    // let newTraffic = await strapi.services.payment.refreshTraffic(user, bytes);
    // if (newTraffic === false || (newTraffic && newTraffic.traffic <= 0)) {
    //   //Restart gateway
    //   strapi.eventEmitter.emit('gateway:restart', gateway._id.toString());
    // }

    return ctx.send({ok: true});
  },

  /**
   * Update geo location of gateway record.
   *
   * @return {Object}
   */

  saveGeoGateway: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    const gateway = await strapi.services.gateway.fetch({
      _id: ctx.params._id
    });

    if (!gateway)
      return ctx.notFound();

    if (!gateway.site || (gateway.site && !gateway.site.company))
      return ctx.notFound();

    if (!ctx.request.body.lat || !ctx.request.body.long)
      return ctx.badRequest(null, 'Wrong parameters provided.');

    let updateGateway = {
      lat: ctx.request.body.lat,
      long: ctx.request.body.long
    };

    if (ctx.request.body.version)
      updateGateway.version = ctx.request.body.version;

    await strapi.services.gateway.edit({
      _id: gateway._id.toString()
    }, updateGateway);

    return ctx.send({ok: true});
  },

  /**
   * Create a/an gateway record.
   *
   * @return {Object}
   */

  activateGateway: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    const gateway = await strapi.services.gateway.fetch({
      _id: ctx.params._id
    });

    if (!gateway)
      return ctx.notFound();

    if (!gateway.site || (gateway.site && !gateway.site.company))
      return ctx.notFound();

    //Get users
    const users = await strapi.plugins['users-permissions'].services.user.fetchAll({
      company_admin: gateway.site.company
    });
    if (!users.length) {
      return ctx.notFound();
    }

    //Get user
    const user = users[0];

    //Get traffic
    var traffic = await strapi.services.payment.getTraffic(user);

    //Change status to connected
    await strapi.services.gateway.edit({ _id: ctx.params._id }, {
      status: 'connected'
    });
    
    //Prepare devices
    if (gateway.devices.length){
      for (var i = 0; i < gateway.devices.length; i++) {
        let device = await strapi.services.device.fetch({
          _id: gateway.devices[i]._id.toString()
        });

        if (device.sensors && device.sensors.length)
          gateway.devices[i].sensors = device.sensors;
      }
    }

    //Prepare gateway configs
    let gatewayConfig = {
      global_id: gateway.id,
      name: gateway.name || 'My device',
      site_id: (gateway.site && gateway.site._id) ? gateway.site._id.toString() : null,
      devices: (traffic > 8)?  gateway.devices : [], //Sensor relation to do
      interface: {}
    };

    //Add example credentials
    gatewayConfig.credentials = {
      certs_url: 'http://165.227.132.86:5055/certs_tar',
      ca_file: 'rootCA.pem',
      cert_file: 'maven-indeema.pem.crt',
      key_file: 'maven-indeema.pem.key'
    }

    //Add
    gatewayConfig.mqtt = {
      credentials: {
        url: '165.227.132.86',
        port: 1883,
        secure: false
      },
      topics: {
        /*data: '/device/' + gateway.id + '/data',
        update: '/device/' + gateway.id + '/update',
        stop: '/device/' + gateway.id + '/stop',
        restart: '/device/' + gateway.id + '/restart'*/
      }
    }
    
    ctx.send(gatewayConfig);
  },

  /**
   * Create a/an gateway record.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    const values = _.assign({}, ctx.request.body);

    //Add site
    //values.site

    //Set status field as default value
    values.status = 'pending';

    const gateway = await strapi.services.gateway.add(values);

    //Create gateway thing
    var gatewayThingName = gateway.name.split(' ').join('_') + '__' + gateway.id;
    var credentials = await AWSIoTService.getCerts(gatewayThingName);
    if (!credentials) {
      //Create new thing
      var result = await AWSIoTService.createNewThing(gatewayThingName, gatewayThingName);

      //Save credentials
      credentials = await AWSIoTService.saveCerts(gatewayThingName, result.certificates);
    }
    
    const firmwareUrl = await strapi.services.gateway.prepareFirmware({
      gatewayId: gateway.id,
      gatewayName: gateway.name,
      baseUrl: strapi.config.API_URL,
      gatewayThingName: 'GATEWAY-RV50-',
      authUrl: strapi.config.API_URL + '/account/gateway/public/auth/' + gateway.id,
      credentials: credentials.certs_url,
      geoUrl: strapi.config.API_URL + '/account/gateway/public/geo/' + gateway.id,
      trafficUrl: strapi.config.API_URL + '/account/gateway/public/traffic/' + gateway.id
    });

    return ctx.send({
      firmware: strapi.config.API_URL + firmwareUrl,
      id: gateway.id,
      name: gateway.name,
      desc: gateway.desc,
      status: gateway.status,
      createdAt: gateway.createdAt,
      updatedAt: gateway.updatedAt
    });
  },

  /**
   * Create a/an gateway record.
   *
   * @return {Object}
   */

  createGateway: async (ctx) => {
    const values = _.assign({}, ctx.request.body);

    //Get currect user
    const user = ctx.state.user;

    //Check if site is my
    let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, user);
    if (!mySite) {
      ctx.badRequest(null, 'Site not found');
    }

    //Add site
    values.site = ctx.params.site_id;

    //Set status field as default value
    values.status = 'pending';

    const gateway = await strapi.services.gateway.add(values);

    //Create gateway thing
    var gatewayThingName = gateway.name.split(' ').join('_') + '__' + gateway.id;
    var credentials = await AWSIoTService.getCerts(gatewayThingName);
    if (!credentials) {
      //Create new thing
      var result = await AWSIoTService.createNewThing(gatewayThingName, gatewayThingName);

      //Save credentials
      credentials = await AWSIoTService.saveCerts(gatewayThingName, result.certificates);
    }
    
    const firmwareUrl = await strapi.services.gateway.prepareFirmware({
      gatewayId: gateway.id,
      gatewayName: gateway.name,
      baseUrl: strapi.config.API_URL,
      gatewayThingName: 'GATEWAY-RV50-',
      authUrl: strapi.config.API_URL + '/account/gateway/public/auth/' + gateway.id,
      credentials: credentials.certs_url,
      geoUrl: strapi.config.API_URL + '/account/gateway/public/geo/' + gateway.id,
      trafficUrl: strapi.config.API_URL + '/account/gateway/public/traffic/' + gateway.id
    });

    ctx.send({
      firmware: strapi.config.API_URL + firmwareUrl,
      id: gateway.id,
      name: gateway.name,
      desc: gateway.desc,
      status: gateway.status,
      createdAt: gateway.createdAt,
      updatedAt: gateway.updatedAt
    });
  },

  /**
   * Update a/an gateway record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    const values = _.assign({}, ctx.request.body);
    
    const gateway = await strapi.services.gateway.fetch({
      _id: ctx.params._id
    });

    //Check site
    if (gateway) {

      //Set status field as default value
      values.status = 'pending';

      await strapi.services.gateway.edit({
        _id: ctx.params._id
      }, values);

      const updatedGateway = await strapi.services.gateway.fetch({
        _id: ctx.params._id
      });

      //Create gateway thing
      var gatewayThingName = updatedGateway.name.split(' ').join('_') + '__' + updatedGateway.id;
      var credentials = await AWSIoTService.getCerts(gatewayThingName);
      if (!credentials) {
        //Create new thing
        var result = await AWSIoTService.createNewThing(gatewayThingName, gatewayThingName);

        //Save credentials
        credentials = await AWSIoTService.saveCerts(gatewayThingName, result.certificates);
      }

      const firmwareUrl = await strapi.services.gateway.prepareFirmware({
        gatewayId: updatedGateway.id,
        gatewayName: updatedGateway.name,
        baseUrl: strapi.config.API_URL,
        gatewayThingName: 'GATEWAY-RV50-',
        authUrl: strapi.config.API_URL + '/account/gateway/public/auth/' + updatedGateway.id,
        credentials: credentials.certs_url,
        geoUrl: strapi.config.API_URL + '/account/gateway/public/geo/' + updatedGateway.id,
        trafficUrl: strapi.config.API_URL + '/account/gateway/public/traffic/' + updatedGateway.id
      });

      ctx.send({
        firmware: strapi.config.API_URL + firmwareUrl,
        id: updatedGateway.id,
        name: updatedGateway.name,
        desc: updatedGateway.desc,
        status: updatedGateway.status,
        createdAt: updatedGateway.createdAt,
        updatedAt: updatedGateway.updatedAt
      });
    } else {
      ctx.badRequest(null, 'Gateway not found');
    }
  },

  /**
   * Update a/an gateway record. 
   *
   * @return {Object}
   */

  updateGateway: async (ctx, next) => {
    const values = _.assign({}, ctx.request.body);

    //Get currect user
    const user = ctx.state.user;

    //Check if site is my
    let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, user);
    if (!mySite) {
      ctx.badRequest(null, 'Site not found');
    }

    //Check gateway site
    const gateway = await strapi.services.gateway.fetch({
      _id: ctx.params._id
    });

    //Check site
    if (gateway.site && gateway.site._id && gateway.site._id.toString() === ctx.params.site_id) {
      //Add site
      values.site = ctx.params.site_id;

      //Set status field as default value
      values.status = 'pending';

      await strapi.services.gateway.edit({
        _id: ctx.params._id
      }, values);

      const updatedGateway = await strapi.services.gateway.fetch({
        _id: ctx.params._id
      });

      //Create gateway thing
      var gatewayThingName = updatedGateway.name.split(' ').join('_') + '__' + updatedGateway.id;
      var credentials = await AWSIoTService.getCerts(gatewayThingName);
      if (!credentials) {
        //Create new thing
        var result = await AWSIoTService.createNewThing(gatewayThingName, gatewayThingName);

        //Save credentials
        credentials = await AWSIoTService.saveCerts(gatewayThingName, result.certificates);
      }

      const firmwareUrl = await strapi.services.gateway.prepareFirmware({
        gatewayId: updatedGateway.id,
        gatewayName: updatedGateway.name,
        baseUrl: strapi.config.API_URL,
        gatewayThingName: 'GATEWAY-RV50-',
        authUrl: strapi.config.API_URL + '/account/gateway/public/auth/' + updatedGateway.id,
        credentials: credentials.certs_url,
        geoUrl: strapi.config.API_URL + '/account/gateway/public/geo/' + updatedGateway.id,
        trafficUrl: strapi.config.API_URL + '/account/gateway/public/traffic/' + updatedGateway.id
      });

      ctx.send({
        firmware: strapi.config.API_URL + firmwareUrl,
        id: updatedGateway.id,
        name: updatedGateway.name,
        desc: updatedGateway.desc,
        status: updatedGateway.status,
        createdAt: updatedGateway.createdAt,
        updatedAt: updatedGateway.updatedAt
      });
    } else {
      ctx.badRequest(null, 'Gateway not found');
    }

  },

  /**
   * Destroy a/an gateway record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    return strapi.services.gateway.remove(ctx.params);
  },

  /**
   * Destroy a/an gateway record.
   *
   * @return {Object}
   */

  destroyGateway: async (ctx, next) => {
    //Get currect user
    const user = ctx.state.user;

    //Check if site is my
    let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, user);
    if (!mySite) {
      ctx.badRequest(null, 'Site not found');
    }

    //Check gateway site
    const gateway = await strapi.services.gateway.fetch({
      _id: ctx.params._id
    });

    if (gateway && gateway.site && gateway.site._id && gateway.site._id.toString() === ctx.params.site_id)
      return strapi.services.gateway.remove({
        _id: ctx.params._id
      });
    else
      ctx.badRequest(null, 'Gateway not found');
  }
};
