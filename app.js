// Assuming the database connection setup is in '../../config/conn'
require('dotenv').config();
require('./src/config/conn');

const express = require('express');
const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

const authRoutes = require('./src/api/routers/auth-routers');
const loggedInRoutes = require('./src/api/routers/logged-in-routers');
const adminRoutes = require('./src/api/routers/admin-routers');

app.use('/auth', authRoutes);
app.use('/app/logged_in', loggedInRoutes);
app.use('/admin', adminRoutes);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
