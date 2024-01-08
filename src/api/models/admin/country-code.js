const mongoose = require('mongoose');

const countryCodeSchema = new mongoose.Schema({
    country_code: {
        type: String,
        required: true,
        trim: true,
    },
    country_name: {
        type: String,
        required: true,
        trim: true,
    },
    country_short_name: {
        type: String,
        required: true,
        trim: true,
    },
    country_image: {
        type: String,
        required: true,
        trim: true,
    },
});

const CountryCode = mongoose.model('country_codes', countryCodeSchema);

module.exports = CountryCode;
