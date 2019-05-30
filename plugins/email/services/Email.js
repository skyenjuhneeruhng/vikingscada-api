'use strict';

/**
 * Email.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

const _ = require('lodash');
const nodemailer = require('nodemailer');
const smtpTransport = require("nodemailer-smtp-transport");

const templates = require('../../../config/email-templates.json');

// Create reusable transporter object using SMTP transport.
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "vikingscada1@gmail.com",
    pass: "33154434Dph!12"
  }
});

module.exports = {
  send: (options, cb) => {
    // Default values.
    options = _.isObject(options) ? options : {};
    options.from = options.from || '"VIKING SCADA" <no-reply@viking.com>';
    options.replyTo = options.replyTo || '"VIKING SCADA" <no-reply@viking.com>';
    options.text = options.text || options.html;
    options.html = options.html || options.text;

    const emailArgs = {
      from: options.from,
      to: options.to,
      subject: options.subject,
      //text: options.text,
      html: options.html
    };

    // Return a promise of the function that sends the email.
    return transporter.sendMail(emailArgs);
  },

  getTemplate: (name) => {
    return templates[name] || null;
  }
};
