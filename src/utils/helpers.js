var fs = require('fs');
const { BASE_URL } = require('./urls');
const OneSignal = require('onesignal-node');
const Notification = require('../api/models/common/notification');
const Users = require('../api/models/auth/users');

const delete_file = async (path, fileName) => {
    console.log(path + fileName)
    fs.unlink( './'+ path + fileName, function (err) {
        console.log('file deleted successfully');
    });
}

function removeLeadingZero(phoneNumber) {
    // Check if the phone number starts with a zero
    if (phoneNumber.startsWith('0')) {
        // Remove the leading zero
        phoneNumber = phoneNumber.slice(1);
    }
    
    return phoneNumber;
}

async function sendNotification(user_id, heading, message) {
    const restApi = "OTMzNDhjYTItOGI2NC00ZDFlLTgxODMtODI2OTMxZGIzODUy"
    const appId = "2fe1426b-1143-4ac2-bfa7-3fa03a5d432c"
    try {

        const find = await Users.findOne({_id : user_id});

        const client = new OneSignal.Client(appId, restApi);

        const notification = {
            headings: { en: heading || 'Notification Title' },
            contents: { en: message || 'Hello, this is a push notification!' },
            include_player_ids: [find?.notification_token],
            // included_segments: ['All'],
        };

        const response = await client.createNotification(notification);
        const transaction = await Notification.create({user_id, heading , message })
        return true;
    } catch (error) {
        return error.message;
    }
}

module.exports = {
    delete_file,
    removeLeadingZero,
    sendNotification
}