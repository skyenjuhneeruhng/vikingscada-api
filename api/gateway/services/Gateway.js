'use strict';

/**
 * Gateway.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

// Public dependencies.
const _ = require('lodash');
const fs = require('fs');
const fse = require('fs-extra');
const ncp = require('ncp').ncp;
const archiver = require('archiver');

//Firmware path's
const gatewayFirmwareTmpPath = __dirname + '/tmp';
const gatewayFirmwareFolderPath = __dirname + '/firmware';
const gatewayFirmwareFilePath = '/bin/vs_global_config.lua';

module.exports = {

  /**
   * Promise to fetch all gateways.
   *
   * @return {Promise}
   */

  fetchAll: (params) => {
    const convertedParams = strapi.utils.models.convertParams('gateway', params);

    //prepare list of response
    let response = {
      total: 0,
      list: []
    };

    //Get total
    return Gateway
      .find()
      .where(convertedParams.where)
      .sort(convertedParams.sort)
      .populate(_.keys(_.groupBy(_.reject(strapi.models.gateway.associations, {
        autoPopulate: false
      }), 'alias')).join(' ')).count().then(function (count) {
        response.total = count;
        return Gateway
          .find()
          .where(convertedParams.where)
          .sort(convertedParams.sort)
          .skip(convertedParams.start)
          .limit(convertedParams.limit)
          .populate(_.keys(_.groupBy(_.reject(strapi.models.gateway.associations, {
            autoPopulate: false
          }), 'alias')).join(' ')).exec().then(function (items) {
            response.list = items;
            return response;
          });
      });
  },

  /**
   * Promise to fetch a/an gateway.
   *
   * @return {Promise}
   */

  findByID: (id) => {
    return Gateway
      .findOne({
        _id: id
      })
      .populate("");
  },

  /**
   * Promise to fetch a/an gateway.
   *
   * @return {Promise}
   */

  fetch: (params) => {
    return Gateway
      .findOne(_.pick(params, _.keys(Gateway.schema.paths)))
      .populate(_.keys(_.groupBy(_.reject(strapi.models.gateway.associations, {autoPopulate: false}), 'alias')).join(' '));
  },

  /**
   * Promise to add a/an gateway.
   *
   * @return {Promise}
   */

  add: async (values) => {
    const query = await Gateway.create(_.omit(values, _.keys(_.groupBy(strapi.models.gateway.associations, 'alias'))));
    const data = query.toJSON ? query.toJSON() : query;

    await strapi.hook.mongoose.manageRelations('gateway', _.merge(data, { values }));

    return query;
  },

  /**
   * Promise to edit a/an gateway.
   *
   * @return {Promise}
   */

  edit: async (params, values) => {
    // Note: The current method will return the full response of Mongo.
    // To get the updated object, you have to execute the `findOne()` method
    // or use the `findOneOrUpdate()` method with `{ new:true }` option.
    await strapi.hook.mongoose.manageRelations('gateway', _.merge(_.clone(params), { values }));
    return Gateway.update(params, values, { multi: true });
  },

  /**
   * Promise to remove a/an gateway.
   *
   * @return {Promise}
   */

  remove: async params => {
    // Note: To get the full response of Mongo, use the `remove()` method
    // or add spent the parameter `{ passRawResult: true }` as second argument.
    const data = await Gateway.findOneAndRemove(params, {})
      .populate(_.keys(_.groupBy(_.reject(strapi.models.gateway.associations, {autoPopulate: false}), 'alias')).join(' '));

    _.forEach(Gateway.associations, async association => {
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
   * Prepare firmware
   *
   * @return {Promise}
   */

  prepareFirmware: async params => {
    //Check if folder exists
    if (!fs.existsSync(__dirname + '/../../../public/firmware/')) {
      fs.mkdirSync(__dirname + '/../../../public/firmware/');
    }
    if (!fs.existsSync(gatewayFirmwareTmpPath)) {
      fs.mkdirSync(gatewayFirmwareTmpPath);
    }
    
    return new Promise(function(rs, rj){
      //Get gateway ID
      let gatewayId = params.gatewayId;

      //Get gateway name
      let gatewayName = params.gatewayName;

      //Generate gateway AWS Thing name
      let gatewayThingName = params.gatewayThingName + params.gatewayId;

      //Auth URL
      let authUrl = params.authUrl;

      //Base url
      let baseUrl = params.baseUrl;

      //Credentials IoT
      let iotCredentials = params.credentials;

      //Geolocation request url
      let geoUrl = params.geoUrl;

      //Traffic url
      let trafficUrl = params.trafficUrl;

      //Prepare temp path folder
      let firmwareTmpPath = gatewayFirmwareTmpPath + '/' + gatewayId;

      //Copy source of firmware to temp folder
      ncp(gatewayFirmwareFolderPath, firmwareTmpPath, function (err) {
        if (err) {
          return console.error(err);
        }

        //Read temp firmware config file
        fs.readFile(firmwareTmpPath + gatewayFirmwareFilePath, 'utf8', async function (err, data) {
          if (err) {
            return console.log(err);
          }

          //Change lua variables
          const firmwareConfig = await strapi.plugins['users-permissions'].services.userspermissions.template(data, {
            UUID: gatewayId,
            DEVICE_NAME: gatewayName,
            THING_NAME: gatewayThingName,
            AUTH_URL: authUrl,
            DEVICE_CONFIG_URL: authUrl,
            BASE_URL: baseUrl,
            IOT_CREDENTIALS: iotCredentials,
            CURRENT_LOCATION_URL: geoUrl,
            MQTT_BROKER_URL: 'a2i7445fyxf9u-ats.iot.us-east-2.amazonaws.com',
            MQTT_BASE_TOPIC: '', //'aws/things/' + gatewayName + '__' + gatewayId + '/shadow/update'
            VS_USED_TRAFFIC_URL: trafficUrl
          });

          //Write to file
          fs.writeFile(firmwareTmpPath + gatewayFirmwareFilePath, firmwareConfig, function (err) {
            if (err) {
              throw err;
            }

            //Firmware folder
            var firmwareFolder = __dirname + '/../../../public/firmware/' + gatewayId;

            //Move folder to new destination
            ncp(firmwareTmpPath, firmwareFolder, function (err) {
              if (err) {
                throw err;
              }

              //Tar bin
              /*var binOutput = fs.createWriteStream(firmwareFolder + '/bin.tar');
              var binArchive = archiver('tar', {
                zlib: {
                  level: 9
                } // Sets the compression level.
              });

              binOutput.on('close', function () {
                //Remove bin folder
                fse.remove(firmwareFolder + '/bin', function () {*/
                  //Zip firmware
                  var firmwareOutput = fs.createWriteStream(firmwareFolder + '.tar');
                  var firmwareArchive = archiver('tar', {
                    zlib: {
                      level: 9
                    } // Sets the compression level.
                  });

                  firmwareOutput.on('close', function () {
                    //Clean folders
                    fse.remove(firmwareTmpPath, function () {
                      fse.remove(firmwareFolder, function () {
                        rs('/firmware/' + gatewayId + '.tar');
                      });
                    });
                  });
                  firmwareOutput.on('end', function () {
                    rj('Data has been drained');
                  });

                  firmwareOutput.on('warning', function (err) {
                    if (err.code === 'ENOENT') {
                      // log warning
                    } else {
                      // throw error
                      throw err;
                    }
                  });
                  firmwareOutput.on('error', function (err) {
                    throw err;
                  });

                  firmwareArchive.pipe(firmwareOutput);

                  //Archive bin folder
                  firmwareArchive.directory(firmwareFolder, false);

                  //Make archive
                  firmwareArchive.finalize();
                /*});

              });
              binOutput.on('end', function () {
                rj('Data has been drained');
              });

              binArchive.on('warning', function (err) {
                if (err.code === 'ENOENT') {
                  // log warning
                } else {
                  // throw error
                  throw err;
                }
              });
              binArchive.on('error', function (err) {
                throw err;
              });

              binArchive.pipe(binOutput);

              //Archive bin folder
              binArchive.directory(firmwareFolder + '/bin', false);

              //Make archive
              binArchive.finalize();*/
            });
          });
        });
      });
    });
  }
};
