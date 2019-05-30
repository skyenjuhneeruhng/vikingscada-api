'use strict';

/**
 * AwsIoT.js service
 *
 * @description: Manage IoT things and other
 */

//Public dependencies
const fs = require('fs');
const fse = require('fs-extra');
const ncp = require('ncp').ncp;
const archiver = require('archiver');

//AWS CLI Dependencies
const awsCli = require('aws-cli-js');
const Options = awsCli.Options;
const Aws = awsCli.Aws;

//Setup options for cli
const options = new Options(
    /* accessKey    */
    'AKIAJOIXADPWKFE3OLGA',
    /* secretKey    */
    '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'
);

//Initialize aws cli interface
const aws = new Aws(options);

//Default configuration for thing
const THING_GROUP = 'VikingSCADAGroup';
const POLICY_NAME = 'VikingSCADAPolicy';

const config = require('./config/custom.json');

const CERTS_URL = config.API_URL + '/certs';
const CERTS_PATH = __dirname + '/public/certs';
const ROOTCA_PATH = __dirname + '/certs/rootCA.pem';

const CERT_PEM_NAME = 'certificate.pem.crt';
const KEY_PAIR_PUBLIC = 'public.pem.key';
const KEY_PAIR_PRIVATE = 'private.pem.key';
const ROOT_CA_PEM = 'rootCA.pem';

module.exports = {

  /**
   * Create thing with certificates, attach police and certificates to thing
   *
   * @return {Promise}
   */

  createNewThing: async (name, gatewayId) => {
    var parseRaw = function(raw){
      let parsedArray = raw.split('-----');

      //Result object
      var result = {
        certificateArn: '',
        certificatePem: '',
        PublicKey: '',
        PrivateKey: ''
      };

      //Prepare certs
      for (var i = 0; i < parsedArray.length; i++) {
        //Arn
        if (i === 0) {
          var parseArn = parsedArray[i].split('	');
          result.certificateArn = parseArn[0];
        }

        //Certificate pem
        if (parsedArray[i] === 'BEGIN CERTIFICATE') {
          result.certificatePem += '-----BEGIN CERTIFICATE-----';
          result.certificatePem += parsedArray[i + 1] + '-----END CERTIFICATE-----';
        }

        //Public key
        if (parsedArray[i] === 'BEGIN PUBLIC KEY') {
          result.PublicKey += '-----BEGIN PUBLIC KEY-----';
          result.PublicKey += parsedArray[i + 1] + '-----END PUBLIC KEY-----';
        }

        //Private key
        if (parsedArray[i] === 'BEGIN RSA PRIVATE KEY') {
          result.PrivateKey += '-----BEGIN RSA PRIVATE KEY-----';
          result.PrivateKey += parsedArray[i + 1] + '-----END RSA PRIVATE KEY-----';
        }

      }

      return result;
    };

    return new Promise((rs, rj) => {
      var output = {};

      //Create thing command
      aws.command('iot create-thing --thing-name ' + name + ' --thing-type-name ' + THING_GROUP).then((data) => {
        //console.log('data = ', data);
        output.thing = {
          id: data.object.thingId,
          name: data.object.thingName,
          arn: data.object.thingArn
        };

        //Create IoT certificate
        aws.command('iot create-keys-and-certificate --set-as-active').then((data) => {
          //console.log('data = ', data);
          //New way of development certs
          let certs = parseRaw(data.raw);

          output.certificates = {
            arn: certs.certificateArn,
            certificatePem: certs.certificatePem,
            keyPair: {
              public: certs.PublicKey,
              private: certs.PrivateKey
            }
          };

          //Fix for broken command
          if (output.certificates.arn.search('certificateArn') >= 0) {
            let firstSplit = output.certificates.arn.split('"certificateArn": "');
            if (firstSplit[1]) {
              let secondSplit = firstSplit[1].split('"');
              output.certificates.arn = secondSplit[0]; //Parsed anr
            }
          }

          //Attach policy to certificate
          aws.command('iot attach-policy --policy-name ' + POLICY_NAME + ' --target "' + output.certificates.arn + '"').then((data) => {
            //console.log('data = ', data);

            //Attach certificate to thing by "certificateArn"
            aws.command('iot attach-thing-principal --thing-name ' + name + ' --principal "' + output.certificates.arn + '"').then((data) => {
              //console.log('data = ', data);

              rs(output);
            });
          });
        });
      });
    });
  },

  /**
   * Save certificates to files
   *
   * @return {Promise}
   */

  saveCerts: async (gatewayId, certs) => {
    return new Promise((rs, rj) => {
      //Check if certs folder exists
      if (!fs.existsSync(CERTS_PATH)) {
        fs.mkdirSync(CERTS_PATH);
      }

      //Init configs
      var certPemName = CERT_PEM_NAME;
      var keyPairPublic = KEY_PAIR_PUBLIC;
      var keyPairPrivate = KEY_PAIR_PRIVATE;
      var rootCAName = ROOT_CA_PEM;
      var certsFolderName = gatewayId + '-certs';

      //Init path`s
      var gatewayCertsFolder = CERTS_PATH + '/' + certsFolderName;
      var rootCAPath = gatewayCertsFolder + '/' + rootCAName;
      var certPemPath = gatewayCertsFolder + '/' + certPemName;
      var keyPairPublicPath = gatewayCertsFolder + '/' + keyPairPublic;
      var keyPairPrivatePath = gatewayCertsFolder + '/' + keyPairPrivate;

      //Create gateway certs folder
      if (!fs.existsSync(gatewayCertsFolder)) {
        fs.mkdirSync(gatewayCertsFolder);
      }

      //Fix replace
      certs.certificatePem = certs.certificatePem.replace('\n', `
`);
      certs.keyPair.public = certs.keyPair.public.replace('\n', `
`);
      certs.keyPair.private = certs.keyPair.private.replace('\n', `
`);

      //Write certificate pem
      fs.writeFile(certPemPath, certs.certificatePem, (err) => {
        if (err) {
          throw err;
        }

        //Write key pair public pem
        fs.writeFile(keyPairPublicPath, certs.keyPair.public, (err) => {
          if (err) {
            throw err;
          }

          //Write key pair private pem
          fs.writeFile(keyPairPrivatePath, certs.keyPair.private, (err) => {
            if (err) {
              throw err;
            }

            //Copy rootCA to certs folder
            ncp(ROOTCA_PATH, rootCAPath, (err) => {
              if (err) {
                throw err;
              }

              //Prepare archive
              var certsOutput = fs.createWriteStream(gatewayCertsFolder + '.tar');
              var certsArchive = archiver('tar', {
                zlib: {
                  level: 9
                } // Sets the compression level.
              });

              certsOutput.on('close', function () {
                //Done
                fse.remove(gatewayCertsFolder, function () {
                  rs({
                    certs_url: CERTS_URL + '/' + certsFolderName + '.tar',
                    ca_file: rootCAName,
                    cert_file: certPemName,
                    key_file: keyPairPrivate
                  });
                });
              });
              certsOutput.on('end', function () {
                //Error 
                rj('Data has been drained');
              });

              certsOutput.on('warning', function (err) {
                if (err.code === 'ENOENT') {
                  // log warning
                } else {
                  // throw error
                  throw err;
                }
              });
              certsOutput.on('error', function (err) {
                throw err;
              });

              certsArchive.pipe(certsOutput);

              //Archive bin folder
              certsArchive.directory(gatewayCertsFolder, false);

              //Make archive
              certsArchive.finalize();
            });
          });
        });
      });
    });
  },

  /**
   * Get certificates if exists
   *
   * @return {Promise}
   */

  getCerts: async (gatewayId) => {
    return new Promise((rs, rj) => {
      if (fs.existsSync(CERTS_PATH + '/' + gatewayId + '-certs.tar')) {
        rs({
          certs_url: CERTS_URL + '/' + gatewayId + '-certs.tar',
          ca_file: ROOT_CA_PEM,
          cert_file: CERT_PEM_NAME,
          key_file: KEY_PAIR_PRIVATE
        });
      }else{
        rs(false);
      }
    });
  },
};