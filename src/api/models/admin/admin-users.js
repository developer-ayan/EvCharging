const mongoose = require('mongoose');
const { created_at } = require('../../../utils/static-values');

const adminUserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
        trim: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    profile_image: {
        type: String,
        default: null,
        trim: true,
    },
    created_at: {
        type: String,
        default: created_at,
        trim: true,
    },
});

const AdminUsers = mongoose.model('admin_users', adminUserSchema);

module.exports = AdminUsers;
