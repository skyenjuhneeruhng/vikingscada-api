'use strict';

/**
 * Widget.js controller
 *
 * @description: A set of functions called "actions" for managing `Widget`.
 */

module.exports = {

  /**
   * Retrieve widget records by dashboard id.
   *
   * @return {Object|Array}
   */

  getWidgets: async (ctx) => {
    if (!ctx.params.dashboard_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    ctx.query.dashboard = ctx.params.dashboard_id;

    return strapi.services.widget.fetchAll(ctx.query);
  },

  /**
   * Retrieve a widget record by dashboard id.
   *
   * @return {Object}
   */

  getWidget: async (ctx) => {
    if (!ctx.params.dashboard_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    ctx.params.dashboard = ctx.params.dashboard_id;
    delete ctx.params.dashboard_id;

    return strapi.services.widget.fetch(ctx.params);
  },

  /**
   * Create a/an widget record by dashboard id.
   *
   * @return {Object}
   */

  createWidget: async (ctx) => {
    if (!ctx.params.dashboard_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Check if dashboard exists
    const dashboard = await strapi.services.dashboard.fetch({
      _id: ctx.params.dashboard_id
    });
    if (!dashboard)
      return ctx.notFound();

    let widgetValue = {
      title: ctx.request.body.title,
      settings: ctx.request.body.settings || {},
      dashboard: ctx.params.dashboard_id,
      sensor: ctx.request.body.sensor_id
    };

    const widget = await strapi.services.widget.add(widgetValue);

    //Add alert rule
    let ruleValue = {
      widget: widget._id.toString()
    };

    //if alert with bitmask
    if (ctx.request.body.alert_bitmask) {
      ruleValue.bitmask = ctx.request.body.alert_bitmask;

      //Check if widget can have alerts
      let avaliable = await strapi.services.alerts.checkAlertAvaliable(ctx.request.body.sensor_id);
      if (avaliable)
        await strapi.services.alertrule.add(ruleValue);

      return ctx.send(widget);
    }

    //If no alert
    if (!ctx.request.body.alert_low && !ctx.request.body.alert_normal && !ctx.request.body.alert_high)
      return ctx.send(widget);

    if (ctx.request.body.alert_low)
      ruleValue.low = ctx.request.body.alert_low;

    if (ctx.request.body.alert_normal)
      ruleValue.normal = ctx.request.body.alert_normal;

    if (ctx.request.body.alert_high)
      ruleValue.danger = ctx.request.body.alert_high;

    //Check if widget can have alerts
    let avaliable = await strapi.services.alerts.checkAlertAvaliable(ctx.request.body.sensor_id);
    if (avaliable)
      await strapi.services.alertrule.add(ruleValue);

    return ctx.send(widget);
  },

  /**
   * Update a/an widget record by dashboard id.
   *
   * @return {Object}
   */

  updateWidget: async (ctx, next) => {
    if (!ctx.params.dashboard_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Check if dashboard exists
    const dashboard = await strapi.services.dashboard.fetch({
      _id: ctx.params.dashboard_id
    });
    if (!dashboard)
      return ctx.notFound();

    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    const widget = await strapi.services.widget.fetch({
      _id: ctx.params._id
    });

    const alertRule = await strapi.services.alertrule.fetch({
      widget: widget._id.toString()
    });
    if (alertRule)
      widget.alert_rule = alertRule;

    let widgetValue = {
      dashboard: ctx.params.dashboard_id
    };

    if (ctx.request.body.title)
      widgetValue.title = ctx.request.body.title;

    if (ctx.request.body.settings)
      widgetValue.settings = ctx.request.body.settings;

    if (ctx.request.body.sensor_id)
      widgetValue.sensor = ctx.request.body.sensor_id;

    if (widget.alert_rule && widget.alert_rule._id)
      widgetValue.alert_rule = widget.alert_rule._id.toString();
    
    //Update widget
    const updateWidget = await strapi.services.widget.edit({
      _id: ctx.params._id
    }, widgetValue);

    //If need update rules
    if (ctx.request.body.alert_low || ctx.request.body.alert_normal || ctx.request.body.alert_high || ctx.request.body.alert_bitmask) {
      if (widget && widget.alert_rule && widget.alert_rule._id) {
        //Add alert rule
        let ruleValue = {
          widget: widget._id.toString()
        };

        //if alert with bitmask
        if (ctx.request.body.alert_bitmask) {
          ruleValue.bitmask = ctx.request.body.alert_bitmask;

          //Check if widget can have alerts
          let avaliable = await strapi.services.alerts.checkAlertAvaliable(widget.sensor_id, widget._id.toString());
          if (avaliable)
            await strapi.services.alertrule.edit({
              _id: widget.alert_rule._id.toString()
            }, ruleValue);
        } else {
          if (ctx.request.body.alert_low)
            ruleValue.low = ctx.request.body.alert_low;

          if (ctx.request.body.alert_normal)
            ruleValue.normal = ctx.request.body.alert_normal;

          if (ctx.request.body.alert_high)
            ruleValue.danger = ctx.request.body.alert_high;

          //Check if widget can have alerts
          let avaliable = await strapi.services.alerts.checkAlertAvaliable(widget.sensor_id, widget._id.toString());
          if (avaliable)
            await strapi.services.alertrule.edit({
              _id: widget.alert_rule._id.toString()
            }, ruleValue);
        }

      } else if (widget && !widget.alert_rule) {
        //Add alert rule
        let ruleValue = {
          widget: widget._id.toString()
        };

        if (ctx.request.body.alert_bitmask) {
          ruleValue.bitmask = ctx.request.body.alert_bitmask;

          //Check if widget can have alerts
          let avaliable = await strapi.services.alerts.checkAlertAvaliable(widget.sensor_id, widget._id.toString());
          if (avaliable)
            await strapi.services.alertrule.add(ruleValue);

        } else {
          if (ctx.request.body.alert_low)
            ruleValue.low = ctx.request.body.alert_low;

          if (ctx.request.body.alert_normal)
            ruleValue.normal = ctx.request.body.alert_normal;

          if (ctx.request.body.alert_high)
            ruleValue.danger = ctx.request.body.alert_high;

          //Check if widget can have alerts
          let avaliable = await strapi.services.alerts.checkAlertAvaliable(widget.sensor_id, widget._id.toString());
          if (avaliable)
            await strapi.services.alertrule.add(ruleValue);
        }
      }
    }

    return ctx.send(updateWidget);
  },

  /**
   * Destroy a/an widget record by dashboard id.
   *
   * @return {Object}
   */

  destroyWidget: async (ctx, next) => {
    if (!ctx.params.dashboard_id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    //Check if dashboard exists
    const dashboard = await strapi.services.dashboard.fetch({
      _id: ctx.params.dashboard_id
    });
    if (!dashboard)
      return ctx.notFound();

    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }
    const widget = await strapi.services.widget.fetch({
      _id: ctx.params._id
    }, true);

    if (widget && widget.alert_rule && widget.alert_rule._id) {

      //Reattach alert rule to another widget with this sensor
      if(widget.sensor && widget.sensor._id){
        const widgets = await strapi.services.widget.fetchAll({
          _id_ne: widget._id.toString(),
          sensor: widget.sensor._id.toString()
        });
        if (widgets.list && widgets.list.length) {
          let newWidgetWithAlert = widgets.list[0];

          //Get alert rule for reattach
          const alertrule = await strapi.services.alertrule.fetch({
            _id: widget.alert_rule._id.toString()
          });

          await strapi.services.widget.edit({
            _id: newWidgetWithAlert._id.toString()
          }, {
            alert_rule: alertrule._id.toString()
          });

        } else {
          await strapi.services.alertrule.remove({
            _id: widget.alert_rule._id.toString()
          });
        }
      } else {
        await strapi.services.alertrule.remove({
          _id: widget.alert_rule._id.toString()
        });
      }

    }

    return strapi.services.widget.remove({
      _id: ctx.params._id
    });
  },

  /**
   * Retrieve widget records.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    return strapi.services.widget.fetchAll(ctx.query);
  },

  /**
   * Retrieve a widget record.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    return strapi.services.widget.fetch(ctx.params);
  },

  /**
   * Create a/an widget record.
   *
   * @return {Object}
   */

  create: async (ctx) => {
    return strapi.services.widget.add(ctx.request.body);
  },

  /**
   * Update a/an widget record.
   *
   * @return {Object}
   */

  update: async (ctx, next) => {
    return strapi.services.widget.edit(ctx.params, ctx.request.body);
  },

  /**
   * Destroy a/an widget record.
   *
   * @return {Object}
   */

  destroy: async (ctx, next) => {
    return strapi.services.widget.remove(ctx.params);
  }
};
