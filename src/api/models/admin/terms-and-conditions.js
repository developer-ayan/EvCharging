const mongoose = require('mongoose');

const termsAndConditionSchema = new mongoose.Schema({
    html: {
        type: String,
        required: true,
        trim: true,
    },
});

const TermsAndConditions = mongoose.model('terms_and_conditions', termsAndConditionSchema);

module.exports = TermsAndConditions;
