const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { DATE_FORMATE } = require('../../../utils/urls');
const { created_at, time_zone } = require('../../../utils/static-values');

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
    transaction_id: {
        type: String,
        trim: true,
        default: null,
    },
    status: {
        type: String,
        trim: true,
        default: 'pending',
    },
    date: {
        type: String,
        trim: true,
        default: moment(new Date()).tz(time_zone).format(DATE_FORMATE),
    },
    created_at: {
        type: String,
        trim: true,
        default: created_at,
    },
});

const Booking = mongoose.model('bookings', bookingSchema);

module.exports = Booking;
