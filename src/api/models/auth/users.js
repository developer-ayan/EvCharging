const mongoose = require('mongoose');

const registerSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
    },
    phone: {
        type: String,
        unique: true,
        trim: true,
    },
    email: {
        type: String,
        unique: true,
        trim: true,
    },
    bike_mode: {
        type: String,
        default: null, // Set the default value here
        trim: true,
    },
    password: {
        type: String,
        trim: true,
    },
    social_id: {
        type: String,
        default: null, // Set the default value here
        trim: true,
    },
    profile_image: {
        type: String,
        default: null, // Set the default value here
        trim: true,
    },
});

const Users = mongoose.model('users', registerSchema);

module.exports = Users;