require('dotenv').config();

const express = require('express');
const app = express();
const Promise = require('bluebird');
const request = require('request-promise');
const parse = require('csv-parse/lib/sync');

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static('public'));

var createMessage = (params) => {
  return Promise.all([
    sendToFacebook(params),
    sendToEmail(params)
  ]);
};

const sendToFacebook = (params) => {
  return request({
    method: 'post',
    url: `https://graph.facebook.com/v2.10/${params.FACEBOOK_GROUP_ID}/feed`,
    qs: {
      access_token: params.fbtoken,
      message: params.message
    }
  })
  .then(function(response) {
    return new Promise(function(resolve, reject) {
      resolve(!!JSON.parse(response).id);
    });
  });
};

const sendToEmail = (params) => {
  function getEmails() {
    return request(params.EMAILS_CSV_URL)
    .then(function(response) {
      return new Promise(function(resolve, reject) {
        var emails = parse(response, { columns: true })
        .filter(function(record) { return record['Are you on Facebook?'] === 'No'; })
        .map(function(record) { return `<${record['Email Address']}>`; });

        resolve({ params: params, emails: emails });
      });
    });
  };

  function sendEmail(args) {
    var params = args.params;
    var emails = args.emails;

    return new Promise(function(resolve, reject) {
      var mailgun = require('mailgun-js')({ apiKey: params.MAILGUN_KEY, domain: params.MAILGUN_DOMAIN });

      var data = {
        from: `Stage Crew <bot@${params.MAILGUN_DOMAIN}>`,
        'h:Reply-To': params.MAILGUN_DEFAULT_EMAIL,
        to: params.MAILGUN_DEFAULT_EMAIL,
        bcc: emails.join(','),
        subject: '[Stage Crew] New Announcement',
        text: params.message
      };

      mailgun.messages().send(data, function(error, body) {
        if (error) {
          reject(error);
        } else {
          resolve(body);
        }
      });
    });
  }

  return getEmails()
  .then(sendEmail);
};

app.post('/create', function(req, res) {
  var params = {
    FACEBOOK_GROUP_ID: process.env.FACEBOOK_GROUP_ID,
    fbtoken: req.body.fbtoken,
    message: req.body.message,

    EMAILS_CSV_URL: process.env.EMAILS_CSV_URL,
    MAILGUN_DEFAULT_EMAIL: process.env.MAILGUN_DEFAULT_EMAIL,
    MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN,
    MAILGUN_KEY: process.env.MAILGUN_KEY
  };

  createMessage(params)
  .then(function() {
    console.log(`Successfully sent message ${params.message}`);
    res.json({ ok: true });
  })
  .catch(function(err) {
    console.log(`ERR: ${err}, PARAMS: ${params}`);
    res.json({ ok: false });
  });
});

app.get('/ping', function(req, res) {
  console.log('ping request');
  res.status(200).end();
})

app.listen(process.env.PORT || 9292, function() {
  console.log('Server is now running...');
});
