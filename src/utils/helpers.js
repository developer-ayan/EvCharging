var fs = require('fs');
const { BASE_URL } = require('./urls');

const delete_file = async (path, fileName) => {
    console.log(path + fileName)
    fs.unlink( './'+ path + fileName, function (err) {
        console.log('file deleted successfully');
    });
}

module.exports = {
    delete_file
}