'use strict';

/**
 * Sensor.js controller
 *
 * @description: A set of functions called "actions" for managing `Sensor`.
 */

module.exports = {

  /**
   * Send command to sensor
   *
   * @return {Object|Array}
   */

  sendCommandToSensor: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    const sensor = await strapi.services.sensor.fetch(ctx.params);
    if(!sensor)
      return ctx.notFound();

    //Commands
    if(ctx.request.body.command_name === 'switch') {
      let args = ctx.request.body.args || null;
      if (args)
        strapi.eventEmitter.emit('gateway:command', {
          command_name: 'switch',
          sensor: sensor,
          args: args
        });
    }

    return ctx.send({ok: true});
  },

  /**
   * Get sensors records.
   *
   * @return {Object|Array}
   */

  getSensors: async (ctx) => {
    if (!ctx.params.site_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Check if site belong to user
    let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, ctx.state.user);
    if (!mySite) {
      return ctx.notFound();
    }

    //Add site id filter
    ctx.query.site = ctx.params.site_id;

    return strapi.services.sensor.fetchAll(ctx.query);
  },

  /**
   * Get a sensor record.
   *
   * @return {Object}
   */

  getSensor: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    if (!ctx.params.site_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Check if site belong to user
    let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, ctx.state.user);
    if (!mySite) {
      return ctx.notFound();
    }

    const sensor = await strapi.services.sensor.fetch(ctx.params);

    //Check if device belong to site
    if (sensor.site && sensor.site._id && sensor.site._id.toString() === ctx.params.site_id)
      return ctx.send(sensor);

    return ctx.notFound();
  },

  /**
   * Create a/an sensor record.
   *
   * @return {Object}
   */

  createSensor: async (ctx) => {
    if (!ctx.params.site_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Check if site belong to user
    let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, ctx.state.user);
    if (!mySite) {
      return ctx.notFound();
    }

    //Add site id to body
    ctx.request.body.site = ctx.params.site_id;

    //Check if name already taken
    let sensors = await strapi.services.sensor.fetchAll({
      name: ctx.request.body.name,
      device: ctx.request.body.device
    });
    if(sensors.list && sensors.list.length)
      return ctx.badRequest(null, 'Sensor name is already taken.');

    //Check if modbus_register_address already taken
    let sensorsMRACheck = await strapi.services.sensor.fetchAll({
      modbus_register_address: ctx.request.body.modbus_register_address,
      device: ctx.request.body.device
    });
    if (sensorsMRACheck.list && sensorsMRACheck.list.length)
      return ctx.badRequest(null, 'Sensor modbus register address is already taken.');

    const addedSensor = await strapi.services.sensor.add(ctx.request.body);
    const sensor = await strapi.services.sensor.fetch({
      _id: addedSensor._id.toString()
    });

    if (sensor.device && sensor.device._id){
      const device = await strapi.services.device.fetch({
        _id: sensor.device._id.toString()
      });
      if (device.gateway && device.gateway._id)
        strapi.eventEmitter.emit('gateway:restart', device.gateway._id.toString());
    }

    return ctx.send(sensor);
  },

  /**
   * Update a/an sensor record.
   *
   * @return {Object}
   */

  updateSensor: async (ctx, next) => {
    if (!ctx.params.site_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Check if site belong to user
    let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, ctx.state.user);
    if (!mySite) {
      return ctx.notFound();
    }

    //Add site id to body
    ctx.request.body.site = ctx.params.site_id;

    const sensor = await strapi.services.sensor.fetch({
      _id: ctx.params._id
    });

    //Check if name already exists
    if (ctx.request.body.name && sensor.name !== ctx.request.body.name) {
      //Check if name already taken
      let sensors = await strapi.services.sensor.fetchAll({
        name: ctx.request.body.name,
        device: sensor.device._id.toString()
      });
      if (sensors.list && sensors.list.length)
        return ctx.badRequest(null, 'Sensor name is already taken.');
    }

    //Check if modbus_register_address already taken
    if (ctx.request.body.modbus_register_address && sensor.modbus_register_address !== parseInt(ctx.request.body.modbus_register_address)) {
      //Check if name already taken
      let sensorsMRACheck = await strapi.services.sensor.fetchAll({
        modbus_register_address: ctx.request.body.modbus_register_address,
        device: sensor.device._id.toString()
      });
      if (sensorsMRACheck.list && sensorsMRACheck.list.length)
        return ctx.badRequest(null, 'Sensor modbus register address is already taken.');
    }

    await strapi.services.sensor.edit(ctx.params, ctx.request.body);
    if (sensor.device && sensor.device._id) {
      const device = await strapi.services.device.fetch({
        _id: sensor.device._id.toString()
      });
      if (device.gateway && device.gateway._id)
        strapi.eventEmitter.emit('gateway:restart', device.gateway._id.toString());
    }

    return strapi.services.sensor.fetch(ctx.params)
  },

  /**
   * Destroy a/an sensor record.
   *
   * @return {Object}
   */

  destroySensor: async (ctx, next) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    if (!ctx.params.site_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Check if site belong to user
    let mySite = await strapi.services.dashboard.isMySite(ctx.params.site_id, ctx.state.user);
    if (!mySite) {
      return ctx.notFound();
    }

    const sensor = await strapi.services.sensor.fetch(ctx.params);

    //Check if device belong to site
    if (sensor.site && sensor.site._id && sensor.site._id.toString() === ctx.params.site_id){
      if (sensor.device && sensor.device._id) {
        const device = await strapi.services.device.fetch({
          _id: sensor.device._id.toString()
        });
        if (device.gateway && device.gateway._id)
          strapi.eventEmitter.emit('gateway:restart', device.gateway._id.toString());
      }
      
      return strapi.services.sensor.remove({
        _id: sensor._id.toString()
      });
    }

    return ctx.notFound();
  },

  /**
   * Retrieve sensor records.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    return strapi.services.sensor.fetchAll(ctx.query);
  },

  /**
   * Retrieve a sensor record.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    return strapi.services.sensor.fetch(ctx.params);
  },

  /**
   * Create a/an sensor record.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    return strapi.services.sensor.add(ctx.request.body);
  },

  /**
   * Update a/an sensor record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    return strapi.services.sensor.edit(ctx.params, ctx.request.body) ;
  },

  /**
   * Destroy a/an sensor record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    return strapi.services.sensor.remove(ctx.params);
  }
};
