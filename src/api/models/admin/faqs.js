const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
    html: {
        type: String,
        required: true,
        trim: true,
    },
});

const Faqs = mongoose.model('faqs', faqSchema);

module.exports = Faqs;
