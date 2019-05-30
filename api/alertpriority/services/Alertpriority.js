'use strict';

/**
 * Alertpriority.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

// Public dependencies.
const _ = require('lodash');

module.exports = {

  /**
   * Set priority up for user
   *
   * @return {Promise}
   */

  upPriority: async (ctx, type) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    const priority = await strapi.services.alertpriority.fetch({
      _id: ctx.params._id,
      type: type
    });

    if(!priority)
      return ctx.badRequest(null, 'Priority not found');

    let firstPriority = 1;
    if (priority.priority === firstPriority)
      return ctx.badRequest(null, 'Priority already first in list');

    //Get previous
    let previous = await strapi.services.alertpriority.fetch({
      company: priority.company._id.toString(),
      type: type,
      priority: parseInt(priority.priority - 1)
    });

    if (previous) {
      //Update previous
      await strapi.services.alertpriority.edit({
        _id: previous._id.toString()
      }, {
        priority: priority.priority
      });

      //Update current
      await strapi.services.alertpriority.edit({
        _id: priority._id.toString()
      }, {
        priority: parseInt(priority.priority - 1)
      });
    }

    return ctx.send({ok: true});
  },

  /**
   * Set priority down for user
   *
   * @return {Promise}
   */

  downPriority: async (ctx, type) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    const priority = await strapi.services.alertpriority.fetch({
      _id: ctx.params._id,
      type: type
    });

    if(!priority)
      return ctx.badRequest(null, 'Priority not found');

    let lastPriority = await strapi.services.alertpriority.count({
      type: type,
      company: priority.company._id.toString()
    });

    if (priority.priority === lastPriority)
      return ctx.badRequest(null, 'Priority already last in list');

    //Get next
    let next = await strapi.services.alertpriority.fetch({
      company: priority.company._id.toString(),
      type: type,
      priority: parseInt(priority.priority + 1)
    });

    if (next) {
      //Update previous
      await strapi.services.alertpriority.edit({
        _id: next._id.toString()
      }, {
        priority: priority.priority
      });

      //Update current
      await strapi.services.alertpriority.edit({
        _id: priority._id.toString()
      }, {
        priority: parseInt(priority.priority + 1)
      });
    }

    return ctx.send({ok: true});
  },

  /**
   * Set priority for user
   *
   * @return {Promise}
   */

  activatePriority: async (ctx, type, enabled = false) => {
    if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) {
      return ctx.notFound();
    }

    const priority = await strapi.services.alertpriority.fetch({
      _id: ctx.params._id,
      type: type
    });

    if(!priority)
      return ctx.badRequest(null, 'Priority not found');

    await strapi.services.alertpriority.edit({
      _id: priority._id.toString()
    }, {
      enabled: enabled
    });

    return ctx.send({ok: true});
  },

  /**
   * Get priorities by type
   *
   * @return {Promise}
   */

  getPriority: async (ctx, type) => {
    //Get admin of company
    const user = ctx.state.user;

    //Check if company exists
    if(!user.company_admin)
      return ctx.badRequest(null, 'Company not found');

    //Get company
    const company = await strapi.services.company.fetch({
      _id: user.company_admin._id.toString()
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
        user: user._id.toString()
      });

      //Increment priority
      priority++;

      //Second add managers if exists
      if (company.managers.length){
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

      return ctx.send({
        total: priorities.length,
        list: priorities
      });

    }

    //Fix priorities
    await strapi.services.alertpriority.fixPriority(company._id.toString(), type);

    //Try get priority and return
    let priorities = await strapi.services.alertpriority.fetchAll({
      type: type,
      company: company._id.toString(),
      _sort: 'priority'
    });

    return ctx.send({
      total: priorities.length,
      list: priorities
    });
  },

  /**
   * Fix priorities
   *
   * @return {Promise}
   */

  fixPriority: async (company_id, type) => {
    //Get company
    const company = await strapi.services.company.fetch({
      _id: company_id
    });

    //If admin not exists
    if (!company.admin)
      return;

    //If company not exists remove all priorities
    if (!company) {
      const priorities = await strapi.services.alertpriority.fetchAll({
        company: company_id
      });

      if (priorities.length){
        for (var p = 0; p < priorities.length; p++){
          await strapi.services.alertpriority.remove({
            _id: priorities[p]._id.toString()
          });
        }
      }
    } else {
      const priorities = await strapi.services.alertpriority.fetchAll({
        type: type,
        company: company_id,
        _sort: 'priority'
      });

      //If priorities exists try fix it
      if (priorities.length) {

        //Priority count
        let priority = 1;
        for(var pf = 0; pf < priorities.length; pf++){
          let item = priorities[pf];

          //Check if user not exists - then remove
          if (!item.user){
            await strapi.services.alertpriority.remove({
              _id: item._id.toString()
            });
          }else{
            //Check if priority not correct
            if (item.priority !== priority){
              await strapi.services.alertpriority.edit({
                _id: item._id.toString()
              }, {
                priority: priority
              });
            }

            //Increment priority
            priority++;
          }
        }
        
        //Not created alert priorities for users
        var missingUsers = [];

        //Check admin
        let adminMissing = true;
        for (var pa = 0; pa < priorities.length; pa++) {
          if (priorities[pa].user._id.toString() === company.admin._id.toString()) {
            adminMissing = false;
          }
        }
        if (adminMissing)
          missingUsers.push(company.admin);

        //Check managers
        if (company.managers && company.managers.length) {
          for (var m = 0; m < company.managers.length; m++) {
            let managerMissing = true;
            for (var pm = 0; pm < priorities.length; pm++) {
              if (priorities[pm].user._id.toString() === company.managers[m]._id.toString()) {
                managerMissing = false;
              }
            }
            if (managerMissing)
              missingUsers.push(company.managers[m]);
          }
        }

        //Check viewers
        if (company.viewers && company.viewers.length) {
          for (var v = 0; v < company.viewers.length; v++) {
            let viewerMissing = true;
            for (var pv = 0; pv < priorities.length; pv++) {
              if (priorities[pv].user._id.toString() === company.viewers[v]._id.toString()) {
                viewerMissing = false;
              }
            }
            if (viewerMissing)
              missingUsers.push(company.viewers[v]);
          }
        }

        //If users missing
        if (missingUsers.length) {
          for (var mu = 0; mu < missingUsers.length; mu++){
            await strapi.services.alertpriority.add({
              priority: priority,
              type: type,
              company: company._id.toString(),
              user: missingUsers[mu]._id.toString()
            });

            //Increment priority
            priority++;
          }
        }
      }
    }    
  },

  /**
   * Promise to fetch all alertpriorities.
   *
   * @return {Promise}
   */

  fetchAll: (params) => {
    const convertedParams = strapi.utils.models.convertParams('alertpriority', params);

    return Alertpriority
      .find()
      .where(convertedParams.where)
      .sort(convertedParams.sort)
      .skip(convertedParams.start)
      .limit(convertedParams.limit)
      .populate(_.keys(_.groupBy(_.reject(strapi.models.alertpriority.associations, {autoPopulate: false}), 'alias')).join(' '));
  },

  /**
   * Promise to fetch all alertpriorities.
   *
   * @return {Promise}
   */

  count: (params) => {
    const convertedParams = strapi.utils.models.convertParams('alertpriority', params);

    return Alertpriority
      .find()
      .where(convertedParams.where)
      .sort(convertedParams.sort)
      .populate('').count();
  },

  /**
   * Promise to fetch a/an alertpriority.
   *
   * @return {Promise}
   */

  fetch: (params) => {
    return Alertpriority
      .findOne(_.pick(params, _.keys(Alertpriority.schema.paths)))
      .populate(_.keys(_.groupBy(_.reject(strapi.models.alertpriority.associations, {autoPopulate: false}), 'alias')).join(' '));
  },

  /**
   * Promise to add a/an alertpriority.
   *
   * @return {Promise}
   */

  add: async (values) => {
    const query = await Alertpriority.create(_.omit(values, _.keys(_.groupBy(strapi.models.alertpriority.associations, 'alias'))));
    const data = query.toJSON ? query.toJSON() : query;

    await strapi.hook.mongoose.manageRelations('alertpriority', _.merge(data, { values }));

    return query;
  },

  /**
   * Promise to edit a/an alertpriority.
   *
   * @return {Promise}
   */

  edit: async (params, values) => {
    // Note: The current method will return the full response of Mongo.
    // To get the updated object, you have to execute the `findOne()` method
    // or use the `findOneOrUpdate()` method with `{ new:true }` option.
    await strapi.hook.mongoose.manageRelations('alertpriority', _.merge(_.clone(params), { values }));
    return Alertpriority.update(params, values, { multi: true });
  },

  /**
   * Promise to remove a/an alertpriority.
   *
   * @return {Promise}
   */

  remove: async params => {
    // Note: To get the full response of Mongo, use the `remove()` method
    // or add spent the parameter `{ passRawResult: true }` as second argument.
    const data = await Alertpriority.findOneAndRemove(params, {})
      .populate(_.keys(_.groupBy(_.reject(strapi.models.alertpriority.associations, {autoPopulate: false}), 'alias')).join(' '));

    _.forEach(Alertpriority.associations, async association => {
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
