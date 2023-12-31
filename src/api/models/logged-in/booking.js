const mongoose = require('mongoose');
const moment = require('moment');
const { DATE_FORMATE } = require('../../../utils/urls');

const bookingSchema = new mongoose.Schema({
    user_id: {
        type: String,
        trim: true,
    },
    station_id: {
        type: String,
        trim: true,
    },
    port_id: {
        type: String,
        trim: true,
    },
    start_time: {
        type: String,
        trim: true,
    },
    end_time: {
        type: String,
        trim: true,
    },
    account_type: {
        type: String,
        trim: true,
        default: null,
    },
    amount: {
        type: String,
        trim: true,
        default: 0,
    },
    date: {
        type: String,
        trim: true,
        default: moment(new Date()).format(DATE_FORMATE),
    },
});

const Booking = mongoose.model('bookings', bookingSchema);

module.exports = Booking;
