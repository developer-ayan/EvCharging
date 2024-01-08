const mongoose = require('mongoose');

const portSchema = new mongoose.Schema({

    station_id: {
        type: String,
        required: true,
        trim: true,
    },
    port_type: {
        type: String,
        required: true,
        trim: true,
    },
    unit_price: {
        type: String,
        required: true,
        trim: true,
    },
});

const Ports = mongoose.model('ports', portSchema);

module.exports = Ports;
