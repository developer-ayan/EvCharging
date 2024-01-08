// Assuming the database connection setup is in '../../config/conn'
require('dotenv').config();
require('./src/config/conn');

const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use('/uploads/station_images', express.static('uploads/station_images'));
app.use('/uploads/users', express.static('uploads/users'));

const authRoutes = require('./src/api/routers/auth-routers');
const loggedInRoutes = require('./src/api/routers/logged-in-routers');
const adminRoutes = require('./src/api/routers/admin-routers');
const commonRoutes = require('./src/api/routers/common-routers');

app.use('/auth', authRoutes);
app.use('/app/logged_in', loggedInRoutes);
app.use('/admin', adminRoutes);
app.use('/common', commonRoutes);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
