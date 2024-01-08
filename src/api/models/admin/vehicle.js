const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
    vehicle_name: {
        type: String,
        required: true,
        trim: true,
    },
    model_no: {
        type: String,
        required: true,
        trim: true,
    }
});

const Vehicles = mongoose.model('vehicles', vehicleSchema);

module.exports = Vehicles;
