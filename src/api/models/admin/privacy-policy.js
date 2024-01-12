const mongoose = require('mongoose');

const privacyPolicySchema = new mongoose.Schema({
    html: {
        type: String,
        required: true,
        trim: true,
    },
});

const PrivacyPolicy = mongoose.model('privacy_policies', privacyPolicySchema);

module.exports = PrivacyPolicy;
