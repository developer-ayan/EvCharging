const mongoose = require('mongoose');
const { created_at } = require('../../../utils/static-values');

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
    port_name: {
        type: String,
        required: true,
        trim: true,
    },
    port_description: {
        type: String,
        required: true,
        trim: true,
    },
    port_image: {
        type: String,
        required: true,
        trim: true,
    },
    date: {
        type: String,
        trim: true,
        default: created_at,
    },
});

const Ports = mongoose.model('ports', portSchema);

module.exports = Ports;
