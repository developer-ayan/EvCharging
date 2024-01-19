var fs = require('fs');
const { BASE_URL } = require('./urls');

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

module.exports = {
    delete_file,
    removeLeadingZero
}