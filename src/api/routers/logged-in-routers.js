const express = require('express');
const multer = require('multer')
const router = express.Router();
const upload = multer().none();
const { MongoClient } = require('mongodb')
const Station = require('../models/admin/create-station')
const Port = require('../models/admin/create-port')
const StationradiusUsers = require('../models/admin/station-radius')


router.get('/vehicle_category', async (req, res) => {
    try {
        const client = await MongoClient.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });
        const db = client.db(process.env.DATA_BASE);

        const allVehicleCategories = await db.collection('vehicle_category').find().toArray();
        client.close();

        res.json({ status: true, data: allVehicleCategories || [], message: 'These are all the categories.' });
    } catch (error) {
        res.status(500).json({ status: false, message: 'categories are not available' });
    }
});

router.post("/dashboard_stations", upload, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(200).json({ status: false, message: 'latitude and longitude are required' });
        }else{
            const radius = await StationradiusUsers.find({  });
            const set_radius = radius?.length > 0 ? parseFloat(radius?.[0]?.toObject()?.radius)  :  10
            const nearbyStations = await Station.find({
                latitude: {
                    $gt: parseFloat(latitude) - (set_radius / 111), // Latitude range
                    $lt: parseFloat(latitude) + (set_radius / 111),
                },
                longitude: {
                    $gt: parseFloat(longitude) - (set_radius / (111 * Math.cos(parseFloat(latitude) * Math.PI / 180))), // Longitude range
                    $lt: parseFloat(longitude) + (set_radius / (111 * Math.cos(parseFloat(latitude) * Math.PI / 180))),
                },
            });
    
            res.status(200).json({ status: true, data: nearbyStations, message: 'Stations fetch successfully.' });
        }
    } catch (error) {
        const status = error.name === 'ValidationError' ? 400 : 1;
        res.status(200).json({ status: false, message: error.message });
    }
});

router.post("/station_detail", upload, async (req, res) => {
    try {
        const { _id } = req.body;

        if (!_id) {
            return res.status(200).json({ status: false, message: '_id is required' });
        }
       await Promise.all([
         Station.findOne({ _id }),
         Port.find({ station_id : _id })
        ]).then((resonse) => {
            if(resonse[0]){
                const data = {
                    station_detail : resonse[0],
                    port_list : resonse[1]
                }
                res.status(200).json({ status: true, data, message: 'Station detail fetch successfully.' });
            }else{
                res.status(200).json({ status: false, message: 'Station not found!' });
            }
        }).catch(() => {
            res.status(200).json({ status: false, data : {}, message: 'something went wrong.' });
        })
       
    } catch (error) {
        console.log('error', error);
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({ status: false, message: error.message });
    }
});

router.post("/search_station", upload, async (req, res) => {
    try {
        const { search } = req.body;
        if (!search) {
            return res.status(200).json({ status: true, data: [], message: 'Stations fetched successfully.' });
        }else{
            const regex = new RegExp(search, 'i');
            const stations = await Station.find({ station_name: { $regex: regex } });
            if (stations.length > 0) {
                return res.status(200).json({ status: true, data: stations, message: 'Stations fetched successfully.' });
            } else {
                return res.status(200).json({ status: false, data: [], message: 'Stations not found!' });
            }
        }
       
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, data: [], message: 'Internal Server Error' });
    }
});




module.exports = router;