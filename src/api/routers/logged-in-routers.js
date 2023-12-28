const express = require('express');
const multer = require('multer')
const router = express.Router();
const upload = multer().none();
const { MongoClient } = require('mongodb')
const Station = require('../models/admin/create-station')


router.get('/vehicle_category', async (req, res) => {
    try {
        const client = await MongoClient.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });
        const db = client.db(process.env.DATA_BASE);

        const allVehicleCategories = await db.collection('vehicle_category').find().toArray();
        client.close();

        res.json({ status: true, data: allVehicleCategories || [], message: 'These are all the categories.' });
    } catch (error) {
        console.error('Error getting all vehicle categories:', error);
        res.status(500).json({ status: false, message: 'categories are not available' });
    }
});


// router.post("/dashboard_stations", upload, async (req, res) => {
//     try {
//         const { longitude , latitude } = req.body;

//         const nearbyStations = await Station.find({
//             $geoNear: {
//                 near: {
//                     type: 'Point',
//                     coordinates: [parseFloat(longitude), parseFloat(latitude)],
//                 },
//                 distanceField: 'distance',
//                 maxDistance: radius * 1000, // Convert radius to meters
//                 spherical: true,
//             },
//         });


//         if (!nearbyStations) {
//             return res.status(401).json({ status: false, message: 'Station not found' });
//         } else {

//             res.status(200).json({ status: true, data: nearbyStations, message: 'Stations fetch successfully.' });
//         }


//     } catch (error) {
//         console.log('error', error)
//         const status = error.name === 'ValidationError' ? 400 : 500;
//         res.status(status).json({ status: false, message: error.message });
//     }
// });

router.post("/dashboard_stations", upload, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(200).json({ status: false, message: 'latitude and longitude are required' });
        }

        const nearbyStations = await Station.find({
            latitude: {
                $gt: parseFloat(latitude) - (10 / 111), // Latitude range
                $lt: parseFloat(latitude) + (10 / 111),
            },
            longitude: {
                $gt: parseFloat(longitude) - (10 / (111 * Math.cos(parseFloat(latitude) * Math.PI / 180))), // Longitude range
                $lt: parseFloat(longitude) + (10 / (111 * Math.cos(parseFloat(latitude) * Math.PI / 180))),
            },
        });

        res.status(200).json({ status: true, data: nearbyStations, message: 'Stations fetch successfully.' });
    } catch (error) {
        console.log('error', error);
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({ status: false, message: error.message });
    }
});




module.exports = router;