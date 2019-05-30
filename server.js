'use strict';

/**
 * Use `server.js` to run your application without `$ strapi start`.
 * To start the server, run: `$ npm start`.
 *
 * This is handy in situations where the Strapi CLI is not relevant or useful.
 */

process.chdir(__dirname);

(() => {
  
  /**
   * Events
   */
  const EventEmitter = require('events');
  class MyEmitter extends EventEmitter {}

  //Inialize event instance
  const strapi = require('strapi');

  //Add emitter
  strapi.eventEmitter = new MyEmitter();

  strapi.start();

  /**
   * Viking SOCKET.IO Server start
   */

  //Prepare socket variables
  const io = require('socket.io')(2337);

  //Get token from header
  const getToken = function (cookie) {
    const match = cookie.match(new RegExp('(^| )BRJWT=([^;]+)'));
    if (match) {
      return match[2].replace('Bearer%20', '');
    }
  };

  //Errors
  const ERROR_MSG = 'Authentication error';

  io.use((socket, next) => {
    next();
    /*const token = getToken(socket.handshake.headers.cookie);
    if (token) {
      strapi.plugins['users-permissions'].services.jwt.verify(token)
        .then(({
          _id
        }) => {
          if (_id) {
            next();
          } else {
            throw ERROR_MSG;
          }
        })
        .catch((err) => {
          next(new Error(ERROR_MSG));
        });
    } else {
      next(new Error(ERROR_MSG));
    }*/
  });

  //Handle new connections
  io.on('connection', socket => {
    console.log('New user connected');
    try {
      strapi.eventEmitter.on('message', (topic, message) => {
        socket.emit(topic, JSON.stringify(message));
      });
    } catch(e) {
      //
    }

    socket.on('disconnect', () => console.log('disconnected'));
  });


  /**
   * IoT Gateway connection start
   */

  //AWS IOT Setup
  const iot = require('aws-iot-device-sdk');
  const configs = {
    keyPath: __dirname + '/certs/private.pem.key',
    certPath: __dirname + '/certs/certificate.pem.crt',
    caPath: __dirname + '/certs/rootCA.pem',
    clientId: 'BackendConnectionGatewaysProduction', //REMOVE 2 AFTER DEPLOY TO DEV
    host: 'a2i7445fyxf9u-ats.iot.us-east-2.amazonaws.com',
    options: {
      clean: false,
      will: {
        qos: 1
      }
    }
  };

  //Iot connect
  const device = iot.device(configs);

  //Restart Gateway
  try {
    strapi.eventEmitter.on('gateway:restart', (gatewayId) => {
      device.publish('/' + gatewayId + '/command', 'restart');
    });
  } catch (e) {
    //
  }

  //Command for Gateway
  try {
    strapi.eventEmitter.on('gateway:command', (config) => {
      //On/Off widget
      if (config.command_name === 'switch'){
        device.publish('/' + config.sensor._id.toString() + '/' + config.sensor.modbus_register_address, JSON.stringify({
          command_name: 'switch',
          'arguments': config.args
        }));
      }

    });
  } catch (e) {
    //
  }

  //Handle connect event
  device.on('connect', function () {
    //console.log('connect');
    setTimeout(() => {
      //console.log('subscribe');
      device.subscribe('#');
      device.subscribe('$aws/events/presence/connected/+');
      device.subscribe('$aws/events/presence/disconnected/+');
    }, 2500);
  });

  //Handle message event
  device.on('message', async function (topic, payload) {
    //console.log(topic, payload);
    try {
      var message = JSON.parse(payload);
    } catch (e) {}
    //console.log(topic);

    let topicData = topic.split('/');

    //If connected
    if (topicData[3] === 'connected' && topicData[4]) {
      //console.log('Connected', topic, topicData[4]);
    }

    //If disconnected
    if (topicData[3] === 'disconnected' && topicData[4]) {
      strapi.services.alerts.communicationFailer(topicData[4]);
    }

    //Prepare topic
    if (topicData[1] && topicData[2] === 'sensor' && topicData[3] === 'data') {
      let result = await strapi.services.payment.calcTrafic(topicData[1], message);
      if (result !== false && result.traffic !== 'off') {
        //Prepare value by bitmask or multiplier
        try {
          var data = await strapi.services.sensor.parseValue(topicData[1], message);
        } catch (e) {}

        //Checking alerts for this sensor
        let alerts = (data.bitmask) ? await strapi.services.alerts.checkEmitAlert(topicData[1], data.value, true) : await strapi.services.alerts.checkEmitAlert(topicData[1], data.value);

        //Check if alerts avaliable
        if (alerts && alerts.notifies) {
          for (var i = 0; i < alerts.notifies.length; i++) {
            strapi.eventEmitter.emit('message', '/' + alerts.notifies[i].widget_id + '/alert', {
              type: alerts.notifies[i].type,
              widget_title: alerts.notifies[i].widget_title
            });
          }
        }

        //Save value
        if (data.bitmask)
          await strapi.services.data.createValue(topicData[1], data.value, true);
        else
          await strapi.services.data.createValue(topicData[1], data.value);

        strapi.eventEmitter.emit('message', '/' + topicData[1] + '/data', data.value);

        //Emit traffic calc
        strapi.eventEmitter.emit('message', '/' + result.user_id + '/traffic', result.traffic);
      } else if (result !== false && result.traffic === 'off') {
        //Emit traffic calc
        strapi.eventEmitter.emit('message', '/' + result.user_id + '/traffic', 'off');
      } else {
        //console.log('Traffic is disallowed');

      }
    }
  });

})();
