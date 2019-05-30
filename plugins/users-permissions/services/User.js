'use strict';

/**
 * User.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

// Public dependencies.
const _ = require('lodash');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const toArray = require('stream-to-array');
const fs = require('fs');
const uuid = require('uuid/v4');

function niceHash(buffer) {
  return crypto
    .createHash('sha256')
    .update(buffer)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\//g, '-')
    .replace(/\+/, '_');
}

module.exports = {
  /**
   * Promise to add a/an user.
   *
   * @return {Promise}
   */

  add: async (values) => {
    if (values.password) {
      values.password = await strapi.plugins['users-permissions'].services.user.hashPassword(values);
    }

    // Use Content Manager business logic to handle relation.
    if (strapi.plugins['content-manager']) {
      return await strapi.plugins['content-manager'].services['contentmanager'].add({
        model: 'user'
      }, values, 'users-permissions');
    }

    return strapi.query('user', 'users-permissions').create(values);
  },

  /**
   * Promise to edit a/an user.
   *
   * @return {Promise}
   */

  edit: async (params, values) => {
    // Note: The current method will return the full response of Mongo.
    // To get the updated object, you have to execute the `findOne()` method
    // or use the `findOneOrUpdate()` method with `{ new:true }` option.
    if (values.password) {
      values.password = await strapi.plugins['users-permissions'].services.user.hashPassword(values);
    }

    // Use Content Manager business logic to handle relation.
    if (strapi.plugins['content-manager']) {
      params.model = 'user';
      params.id = (params._id || params.id);

      return await strapi.plugins['content-manager'].services['contentmanager'].edit(params, values, 'users-permissions');
    }

    return strapi.query('user', 'users-permissions').update(_.assign(params, values));
  },

  /**
   * Promise to fetch a/an user.
   *
   * @return {Promise}
   */

  fetch: (params) => {
    return strapi.query('user', 'users-permissions').findOne(_.pick(params, ['_id', 'id']));
  },

  /**
   * Promise to fetch all users.
   *
   * @return {Promise}
   */

  fetchAll: (params) => {
    const convertedParams = strapi.utils.models.convertParams('user', params);
    return strapi.query('user', 'users-permissions').find({
      limit: convertedParams.limit,
      skip: convertedParams.start,
      sort: convertedParams.sort,
      where: convertedParams.where,
    });
  },

  hashPassword: function (user = {}) {
    return new Promise((resolve) => {
      if (!user.password || this.isHashed(user.password)) {
        resolve(null);
      } else {
        bcrypt.hash(user.password, 10, (err, hash) => {
          resolve(hash)
        });
      }
    });
  },

  isHashed: (password) => {
    if (typeof password !== 'string' || !password) {
      return false;
    }

    return password.split('$').length === 4;
  },

  /**
   * Promise to remove a/an user.
   *
   * @return {Promise}
   */

  remove: async params => {
    // Use Content Manager business logic to handle relation.
    if (strapi.plugins['content-manager']) {
      params.model = 'user';
      params.id = (params._id || params.id);

      await strapi.plugins['content-manager'].services['contentmanager'].delete(params, {source: 'users-permissions'});
    }

    return strapi.query('user', 'users-permissions').delete(params);
  },

  validatePassword: (password, hash) => {
    return bcrypt.compareSync(password, hash);
  },

  /**
   * Get uploaded file
   */
  getFile: async(file_id) => {
    const data = await strapi.plugins['upload'].services.upload.fetch({
      _id: file_id
    });

    data.url = strapi.config.url + data.url;

    return data;
  },

  /**
   * Helper for upload files
   */
  uploadFile: async (ctx, label = null) => {

    // Retrieve provider configuration.
    const config = await strapi.store({
      environment: strapi.config.environment,
      type: 'plugin',
      name: 'upload'
    }).get({ key: 'provider' });

    // Extract optional relational data.
    const { refId, ref, source, field, path } = ctx.request.body.fields;
    const files = ctx.request.body.files;

    if (_.isEmpty(files)) {
      return false;
    }

    // Transform stream files to buffer
    const buffers = (label)? 
                        await strapi.plugins['users-permissions'].services.user.bufferize(ctx.request.body.files[label], true) :
                        await strapi.plugins['users-permissions'].services.user.bufferize(ctx.request.body.files);
    const enhancedFiles = buffers.map(file => {

      // Add details to the file to be able to create the relationships.
      if (refId && ref && field) {
        Object.assign(file, {
          related: [{
            refId,
            ref,
            source,
            field
          }]
        });
      }

      // Update uploading folder path for the file.
      if (path) {
        Object.assign(file, {
          path
        });
      }

      return file;
    });

    // Something is wrong (size limit)...
    if (ctx.status === 400) {
      return false;
    }

    const uploadedFiles = await strapi.plugins.upload.services.upload.upload(enhancedFiles, config);

    return uploadedFiles;
  },
  bufferize: async (files, noLabel = false) => {
    if (_.isEmpty(files) === 0) {
      throw 'Missing files.';
    }

    // files is always an array to map on
    files = _.isArray(files) ? files : [files];

    // transform all files in buffer
    return Promise.all(
      files.map(async stream => {
        const file = (noLabel) ? stream : stream.image;

        const parts = await toArray(fs.createReadStream(file.path));
        const buffers = parts.map(
          part => (_.isBuffer(part) ? part : Buffer.from(part)),
        );

        const buffer = Buffer.concat(buffers);

        return {
          name: file.name,
          sha256: niceHash(buffer),
          hash: uuid().replace(/-/g, ''),
          ext: file.name.split('.').length > 1 ?
            `.${_.last(file.name.split('.'))}`:
            '',
          buffer,
          mime: file.type,
          size: (file.size / 1000).toFixed(2),
        };
      }),
    );
  },
};
