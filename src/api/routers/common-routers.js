const express = require('express');
const multer = require('multer');
const router = express.Router();
const upload = multer().none();
const path = require('path');
const fs = require('fs');

const {
  createCountryCode,
  editCountryCode,
  fetchCountryCodes,
  fetchCountryCodeDetail,
  createVehicleMode,
  editVehicleMode,
  fetchVehicles,
  fetchVehicleDetail
} = require('../controllers/admin');

// Destination folder
const destinationFolder = './uploads/station_images/';
const countryFolder = './uploads/country_images/';

// Create the destination folder if it doesn't exist

if (!fs.existsSync(countryFolder)) {
  fs.mkdirSync(countryFolder, { recursive: true });
}

if (!fs.existsSync(destinationFolder)) {
  fs.mkdirSync(destinationFolder, { recursive: true });
}

// Set storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, countryFolder);
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload_single_country_image = multer({ storage }).single('country_image');

// country code
router.post("/create_country_code", upload_single_country_image, createCountryCode);
router.post("/edit_country_code", upload_single_country_image, editCountryCode);
router.post("/fetch_country_code", upload, fetchCountryCodes);
router.post("/fetch_country_code_detail", upload, fetchCountryCodeDetail);

// Vehicles
router.post("/create_vehicle", upload, createVehicleMode);
router.post("/edit_vehicle", upload, editVehicleMode);
router.post("/fetch_vehicles", upload, fetchVehicles);
router.post("/fetch_vehicle_detail", upload, fetchVehicleDetail);

module.exports = router;