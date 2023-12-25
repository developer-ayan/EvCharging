const mongoose = require('mongoose');
const { BASE_URL, DATA_BASE } = require('../utils/urls');

console.log('testing url',  process.env.MONGO_URL)

mongoose.connect(process.env.MONGO_URL)
// mongoose.connect(`${BASE_URL}/${DATA_BASE}`)
    .then(() => {
        console.log("Connected to MongoDB");
    })
    .catch((error) => {
        console.error("Error connecting to MongoDB:", error.message);
    });
