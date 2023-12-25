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
    latitude: {
        type: String,
        required: true,
        trim: true,
    },
    longitude: {
        type: String,
        required: true,
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

const Stations = mongoose.model('station', stationSchema);

module.exports = Stations;
