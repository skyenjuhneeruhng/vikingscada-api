'use strict';

/**
 * Dashboard.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

// Public dependencies.
const _ = require('lodash');

module.exports = {

  /**
   * Checking if is site is belong to user
   *
   * @return {Promise}
   */

  isMySite: async (site_id, user) => {
    const site = await strapi.services.site.fetch({_id: site_id});
    let company = null;

    if(user.role.type === "company")
      company = user.company_admin;

    if(user.role.type === "managers")
      company = user.manager_company;

    if(user.role.type === "viewers")
      company = user.viewer_company;

    if(company === null)
      return false;

    //Check company
    try{
      let companyId = company.id || company._id.toString();
      if(site.company.id === companyId)
        return true;

      return false;
    }catch(err){
      return false;
    }
  },

  /**
   * Promise to fetch all dashboards.
   *
   * @return {Promise}
   */

  fetchAll: (params) => {
    const convertedParams = strapi.utils.models.convertParams('dashboard', params);

    //prepare list of response
    let response = {total: 0, list: []};

    return Dashboard
      .find()
      .where(convertedParams.where)
      .sort(convertedParams.sort)
      .populate(_.keys(_.groupBy(_.reject(strapi.models.dashboard.associations, {autoPopulate: false}), 'alias')).join(' ')).count().then(function(count){
          response.total = count;
          return Dashboard
            .find()
            .where(convertedParams.where)
            .sort(convertedParams.sort)
            .skip(convertedParams.start)
            .limit(convertedParams.limit)
            .populate(_.keys(_.groupBy(_.reject(strapi.models.dashboard.associations, {autoPopulate: false}), 'alias')).join(' ')).exec().then(function(items){
              response.list = items;
              return response;
            });
        });
  },

  /**
   * Promise to fetch a/an dashboard.
   *
   * @return {Promise}
   */

  fetch: (params) => {
    return Dashboard
      .findOne(_.pick(params, _.keys(Dashboard.schema.paths)))
      .populate(_.keys(_.groupBy(_.reject(strapi.models.dashboard.associations, {autoPopulate: false}), 'alias')).join(' '));
  },

  /**
   * Promise to add a/an dashboard.
   *
   * @return {Promise}
   */

  add: async (values) => {
    const query = await Dashboard.create(_.omit(values, _.keys(_.groupBy(strapi.models.dashboard.associations, 'alias'))));
    const data = query.toJSON ? query.toJSON() : query;

    await strapi.hook.mongoose.manageRelations('dashboard', _.merge(data, { values }));

    const dashboard = await Dashboard
                      .findOne(_.pick({
                        _id: query.id
                      }, _.keys(Dashboard.schema.paths)))
                      .populate(_.keys(_.groupBy(_.reject(strapi.models.dashboard.associations, {
                        autoPopulate: false
                      }), 'alias')).join(' '));
    
    return dashboard;
  },

  /**
   * Promise to edit a/an dashboard.
   *
   * @return {Promise}
   */

  edit: async (params, values) => {
    // Note: The current method will return the full response of Mongo.
    // To get the updated object, you have to execute the `findOne()` method
    // or use the `findOneOrUpdate()` method with `{ new:true }` option.
    await strapi.hook.mongoose.manageRelations('dashboard', _.merge(_.clone(params), { values }));
    return Dashboard.update(params, values, { multi: true });
  },

  /**
   * Promise to remove a/an dashboard.
   *
   * @return {Promise}
   */

  remove: async params => {
    const dashboard = await strapi.services.dashboard.fetch(params);

    //Remove all widgets
    if (dashboard.widgets && dashboard.widgets.length){
      for (var i = 0; i < dashboard.widgets.length; i++){
        await strapi.services.widget.remove({
          _id: dashboard.widgets[i]._id.toString()
        });
      }
    }

    // Note: To get the full response of Mongo, use the `remove()` method
    // or add spent the parameter `{ passRawResult: true }` as second argument.
    const data = await Dashboard.findOneAndRemove(params, {})
      .populate(_.keys(_.groupBy(_.reject(strapi.models.dashboard.associations, {autoPopulate: false}), 'alias')).join(' '));

    _.forEach(Dashboard.associations, async association => {
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
