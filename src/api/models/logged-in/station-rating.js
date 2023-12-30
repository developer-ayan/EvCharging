const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ratingSchema = new mongoose.Schema({
    station_id: {
        type: String,
        trim: true,
    },
    rating: {
        type: String,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
});

const Rating = mongoose.model('station_reviews', ratingSchema);

module.exports = Rating;
