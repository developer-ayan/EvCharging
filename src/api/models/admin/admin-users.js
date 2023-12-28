const mongoose = require('mongoose');

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
});

const AdminUsers = mongoose.model('admin_users', adminUserSchema);

module.exports = AdminUsers;
