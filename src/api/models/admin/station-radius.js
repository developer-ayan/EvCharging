const mongoose = require('mongoose');

const stationRadiusSchema = new mongoose.Schema({
    radius: {
        type: String,
        required: true,
        trim: true,
    },
});

const stationRadiusUsers = mongoose.model('radius', stationRadiusSchema);

module.exports = stationRadiusUsers;
