'use strict';

/**
 * Widget.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

// Public dependencies.
const _ = require('lodash');

module.exports = {

  /**
   * Promise to fetch all widgets.
   *
   * @return {Promise}
   */

  fetchAll: (params, noprepare = false, norelation = false) => {
    const convertedParams = strapi.utils.models.convertParams('widget', params);

    //prepare list of response
    let response = {total: 0, list: []};

    //Prepare populate
    let populate = (norelation)? '' : _.keys(_.groupBy(_.reject(strapi.models.widget.associations, {autoPopulate: false}), 'alias')).join(' ');

    return Widget
      .find()
      .where(convertedParams.where)
      .sort(convertedParams.sort)
      .populate(populate).count().then(function (count) {
        response.total = count;
        return Widget
          .find()
          .where(convertedParams.where)
          .sort(convertedParams.sort)
          .skip(convertedParams.start)
          .limit(convertedParams.limit)
          .populate(populate).exec().then(function(items){
            if (noprepare) {
              response.list = items;
              return response;
            } else {
              let result = items.map((value) => {
                let newValue = {
                  _id: value._id,
                  id: value.id,
                  title: value.title,
                  settings: value.settings,
                  createdAt: value.createdAt,
                  updatedAt: value.updatedAt,
                  dashboard: value.dashboard
                };

                //Set values
                newValue.sensor_id = (value.sensor && value.sensor._id) ? value.sensor._id.toString() : null;

                //Set alert
                if (value.alert_rule) {
                  newValue.alert_low = value.alert_rule.low;
                  newValue.alert_normal = value.alert_rule.normal;
                  newValue.alert_high = value.alert_rule.danger;
                }

                return newValue;
              });

              response.list = result;
              return response;
            }
          });
      });
  },

  /**
   * Promise to fetch a/an widget.
   *
   * @return {Promise}
   */

  fetch: async (params, noprepared = false) => {
    const widget = await Widget
      .findOne(_.pick(params, _.keys(Widget.schema.paths)))
      .populate(_.keys(_.groupBy(_.reject(strapi.models.widget.associations, {autoPopulate: false}), 'alias')).join(' '));

    if(noprepared)
      return widget;

    if (!widget)
      return widget;

    let newValue = {
      _id: widget._id,
      id: widget.id,
      title: widget.title,
      settings: widget.settings,
      createdAt: widget.createdAt,
      updatedAt: widget.updatedAt,
      dashboard: widget.dashboard
    };

    //Set values 
    newValue.sensor_id = (widget.sensor && widget.sensor._id) ? widget.sensor._id.toString() : null;

    //Set alert
    if (widget.alert_rule) {
      newValue.alert_low = widget.alert_rule.low;
      newValue.alert_normal = widget.alert_rule.normal;
      newValue.alert_high = widget.alert_rule.danger;
    }

    newValue.alert_rule = widget.alert_rule;

    return newValue;
  },

  /**
   * Promise to add a/an widget.
   *
   * @return {Promise}
   */

  add: async (values) => {
    const query = await Widget.create(_.omit(values, _.keys(_.groupBy(strapi.models.widget.associations, 'alias'))));
    const data = query.toJSON ? query.toJSON() : query;

    await strapi.hook.mongoose.manageRelations('widget', _.merge(data, { values }));

    return query;
  },

  /**
   * Promise to edit a/an widget.
   *
   * @return {Promise}
   */

  edit: async (params, values) => {
    // Note: The current method will return the full response of Mongo.
    // To get the updated object, you have to execute the `findOne()` method
    // or use the `findOneOrUpdate()` method with `{ new:true }` option.
    await strapi.hook.mongoose.manageRelations('widget', _.merge(_.clone(params), { values }));
    return Widget.update(params, values, { multi: true });
  },

  /**
   * Promise to remove a/an widget.
   *
   * @return {Promise}
   */

  remove: async params => {
    //get widget for remove dependencies
    const widget = await strapi.services.widget.fetch(params);

    if(widget){
      let removeAlerts = true;
      if (widget.sensor_id && widget.alert_rule && widget.alert_rule._id) {
        //Get all widget with this sensor_id
        const sensorWidgets = await strapi.services.widget.fetchAll({
          sensor: widget.sensor_id,
          _sort: 'createdAt:desc'
        }, true);
        if(sensorWidgets.list && sensorWidgets.list.length){
          for (let w of sensorWidgets.list){
            if(w._id.toString() !== widget._id.toString()){
              await strapi.services.widget.edit({
                _id: w._id.toString()
              }, {
                alert_rule: widget.alert_rule._id.toString()
              });
              removeAlerts = false;
              break;
            }
          }
        }
      }
      //Remove alerts
      if (removeAlerts) {
        if (widget.alert_rule && widget.alert_rule._id) {
          await strapi.services.alertrule.remove({
            _id: widget.alert_rule._id.toString()
          });
        }
      }
    }

    // Note: To get the full response of Mongo, use the `remove()` method
    // or add spent the parameter `{ passRawResult: true }` as second argument.
    const data = await Widget.findOneAndRemove(params, {})
      .populate(_.keys(_.groupBy(_.reject(strapi.models.widget.associations, {autoPopulate: false}), 'alias')).join(' '));

    try {
      _.forEach(Widget.associations, async association => {
        const search = (_.endsWith(association.nature, 'One')) ? {[association.via]: data._id} : {[association.via]: {$in: [data._id]}};
        const update = (_.endsWith(association.nature, 'One')) ? {[association.via]: null} : {$pull: {[association.via]: data._id}};

        await strapi.models[association.model || association.collection].update(
          search,
          update,
          {multi: true});
      });
    } catch(e){
      //
    }

    return data;
  }
};
