const express = require('express');
const multer = require('multer')
const router = express.Router();
const upload = multer().none();
const { MongoClient } = require('mongodb')
const { BASE_URL, DATA_BASE } = require('../../utils/urls')
const Station = require('../models/admin/create-station')
const Port = require('../models/admin/create-port')

router.post("/create_station", upload, async (req, res) => {
    try {
        const { station_name, unit_price, latitude, longitude, location } = req.body;

        if (!station_name || !unit_price || !latitude, !longitude, !location) {
            return res.status(200).json({ status: false, message: 'All fields are required' });
        }

        await Station.create({ station_name, unit_price, latitude, longitude, location });
        res.status(201).json({ status: true, message: 'Station created successfully' });
    } catch (error) {
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({ status: false, message: error.message });
    }
});

router.post("/edit_station", upload, async (req, res) => {
    try {

        const { _id, station_name, unit_price, latitude, longitude, location } = req.body;
        if (!_id) {
            return res.status(404).json({ status: false, message: '_id is required' });
        }
        const station = await Station.findOne({ _id });
        if (!station) {
            return res.status(404).json({ status: false, message: 'Station not found' });
        }

        station.station_name = station_name || station.station_name;
        station.unit_price = unit_price || station.unit_price;
        station.latitude = latitude || station.latitude;
        station.longitude = longitude || station.longitude;
        station.location = location || station.location;

        const updatedStation = await station.save();

        res.status(200).json({ status: true, data: updatedStation, message: 'Station updated successfully' });

    } catch (error) {
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({ status: false, message: error.message });
    }
});

router.post("/delete_station", upload, async (req, res) => {
    try {

        const { _id } = req.body;

        if (!_id) {
            return res.status(404).json({ status: false, message: 'Station not found' });
        }

        const deletedStation = await Station.findByIdAndDelete(_id);
        res.status(200).json({ status: true, message: 'Station delete successfully.' });

    } catch (error) {
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});

router.post("/station_detail", upload, async (req, res) => {
    try {
        const { _id } = req.body;
        if (!_id) {
            return res.status(404).json({ status: false, message: '_id is required' });
        }
        const station = await Station.findOne({ _id });
        if (!station) {
            return res.status(401).json({ status: false, message: 'Station not found' });
        }
        res.status(200).json({ status: true, data: station, message: 'Station fetch successfully.' });
    } catch (error) {
        console.log('error', error)
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({ status: false, message: error.message });
    }
});

router.get("/station_list", async (req, res) => {
    try {
        const stations = await Station.find({});
        res.status(200).json({ status: true, data: stations, message: 'Stations fetch successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});

router.post("/create_station_port", upload, async (req, res) => {
    try {
        const { station_id, port_type, slots } = req.body;
        if (!station_id || !port_type || !slots) {
            return res.status(200).json({ status: false, message: 'All fields are required' });
        }
        await Port.create({ station_id, port_type, slots });
        res.status(201).json({ status: true, message: 'Port created successfully' });
    } catch (error) {
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({ status: false, message: error.message });
    }
});

router.post("/edit_station_port", upload, async (req, res) => {
    try {

        const { _id, port_typet, slots } = req.body;
        if (!_id) {
            return res.status(404).json({ status: false, message: '_id is required' });
        }
        const port = await Port.findOne({ _id });
        if (!port) {
            return res.status(404).json({ status: false, message: 'Port not found' });
        }

        port.port_type = port_type || port.port_type;
        port.slots = slots || port.slots;

        const updatedStation = await port.save();

        res.status(200).json({ status: true, message: 'Station updated successfully' });

    } catch (error) {
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({ status: false, message: error.message });
    }
});

router.post("/station_port_detail", upload, async (req, res) => {
    try {
        const { _id } = req.body;
        if (!_id) {
            return res.status(404).json({ status: false, message: '_id is required' });
        }

        const port = await Port.findOne({ _id });
        if (!port) {
            return res.status(401).json({ status: false, message: 'Port not found' });
        }

        const station = await Station.findOne({ _id: port?.station_id });
        if (!station) {
            return res.status(401).json({ status: false, message: 'Station not found' });
        }

        // Use the spread operator to merge properties
        const data = {
            ...port.toObject(),
            unit_price: station?.unit_price
        };

        res.status(200).json({ status: true, data, message: 'Port fetch successfully.' });
    } catch (error) {
        console.log('error', error);
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({ status: false, message: error.message });
    }
});


router.post("/station_port_list", upload, async (req, res) => {
    try {
        const { station_id } = req.body;
        if (!station_id) {
            return res.status(404).json({ status: false, message: 'station_id is required' });
        }

        const port = await Port.find({ station_id }).sort({ _id: -1 }).exec();
        if (!port) {
            return res.status(401).json({ status: false, message: 'Ports not found' });
        }

        const station = await Station.findOne({ _id: port?.[0]?.station_id });
        if (!station) {
            return res.status(401).json({ status: false, message: 'Station not found' });
        } else {

            const modified_array = port?.map((item, index) => {
                return {
                    ...item.toObject(),
                    unit_price: station?.unit_price
                }
            })

            res.status(200).json({ status: true, data: modified_array, message: 'Ports fetch successfully.' });
        }


    } catch (error) {
        console.log('error', error)
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({ status: false, message: error.message });
    }
});

router.post("/delete_port", upload, async (req, res) => {
    try {

        const { _id } = req.body;

        if (!_id) {
            return res.status(404).json({ status: false, message: 'Port not found' });
        }

        const deletedPort = await Port.findByIdAndDelete(_id);
        res.status(200).json({ status: true, message: 'Port delete successfully.' });

    } catch (error) {
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});



module.exports = router;