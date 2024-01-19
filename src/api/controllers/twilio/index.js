const accountSid = 'ACfc3ba06ba47f608d251bce7b6693a35b';
const authToken = '387448c675cdeea1c0b4bf8d07b3f3bb';

const SendSms = (phone, message) => {
  const client = require('twilio')(accountSid, authToken);
  client.messages
    .create({
       body: message,
       from: '+17198736018',
       to: phone
     })
    .then(message => console.log(message.sid));
}

module.exports = SendSms;
