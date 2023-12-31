const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const stationSchema = new mongoose.Schema({
    station_name: {
        type: String,
        required: true,
        trim: true,
    },
    unit_price: {
        type: String,
        required: true,
        trim: true,
    },
    location: {
        type: {
            type: String,
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: [0, 0]
        },
        name: {
            type: String,
            required: true,
            trim: true
        }
    },
    station_image: {
        type: String,
        default: null, // Set the default value here
        trim: true,
    },
    start_time: {
        type: String,
        default: null, // Set the default value here
        trim: true,
    },
    end_time: {
        type: String,
        default: null, // Set the default value here
        trim: true,
    },
    serial_no: {
        type: String,
        default: generateCustomSerialNumber,
        unique: true,
    },
});

function generateCustomSerialNumber() {
    const staticPrefix = "#";
    const uuid = uuidv4().toUpperCase(); 
    const serialNumber = staticPrefix + uuid.substr(0, 7) ;

    return serialNumber;
}

stationSchema.index({ location: '2dsphere' });

const Stations = mongoose.model('station', stationSchema);

module.exports = Stations;
