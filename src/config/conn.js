const mongoose = require('mongoose');
const mongoUrl = process.env.MONGO_URL;

const username = 'ayanahmed255'; // Replace with your actual username
const password = 'Hello786@'; // Replace with your actual password (URL-encoded if necessary)

mongoose.connect(`mongodb+srv://${username}:${encodeURIComponent(password)}@cluster0.kffyovn.mongodb.net/`)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error.message);
  });
