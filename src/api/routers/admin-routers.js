const express = require('express');
const multer = require('multer')
const router = express.Router();
const upload = multer().none();
const path = require('path');
const moment = require('moment');
const fs = require('fs');

const {
    MongoClient
} = require('mongodb')
const {
    BASE_URL,
    DATA_BASE
} = require('../../utils/urls')
const Station = require('../models/admin/create-station')
const AdminUsers = require('../models/admin/admin-users')
const StationradiusUsers = require('../models/admin/station-radius')
const Port = require('../models/admin/create-port')
const Rating = require('../models/logged-in/station-rating')
const AuthMiddleware = require('../middlewares/authMiddleware');

// Destination folder
const destinationFolder = './uploads/station_images/';

// Create the destination folder if it doesn't exist
if (!fs.existsSync(destinationFolder)) {
    fs.mkdirSync(destinationFolder, { recursive: true });
}

// Set storage engine
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, destinationFolder);
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload_single = multer({
    storage
}).single('profile_image');

const upload_single_station = multer({
    storage
}).single('station_image');


router.post("/login", upload, async (req, res) => {
    try {
        const {
            email,
            password
        } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: false,
                message: 'All fields are required'
            });
        }

        // Use findOne with a query object specifying both email and password
        const user = await AdminUsers.findOne({
            email,
            password
        });

        console.log('user', user);

        if (!user) {
            return res.status(200).json({
                status: false,
                message: 'Invalid email or password'
            });
        }

        res.status(200).json({
            status: true,
            data: user,
            message: 'Login successful'
        });
    } catch (error) {
        console.error('error', error);
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});


router.post("/create_station", upload_single_station, async (req, res) => {
    try {
        const {
            station_name,
            unit_price,
            latitude,
            longitude,
            location,
            start_time,
            end_time
        } = req.body;

        if (!station_name || !unit_price || !latitude, !longitude, !location) {
            return res.status(200).json({
                status: false,
                message: 'All fields are required'
            });
        }



        await Station.create({
            station_name,
            unit_price,
            latitude,
            longitude,
            location: {
                type: 'Point',
                coordinates: [parseFloat(longitude), parseFloat(latitude)],
                name: location
            },
            station_image: req.file ? req.file.filename : null,
            start_time,
            end_time
        });

        res.status(201).json({
            status: true,
            message: 'Station created successfully'
        });
    } catch (error) {
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({
            status: false,
            message: error.message
        });
    }
});


router.post("/edit_station", upload_single_station, async (req, res) => {
    try {

        const {
            _id,
            station_name,
            unit_price,
            latitude,
            longitude,
            location,
            start_time,
            end_time
        } = req.body;
        if (!_id) {
            return res.status(200).json({
                status: false,
                message: '_id is required'
            });
        }
        const station = await Station.findOne({
            _id
        });
        if (!station) {
            return res.status(200).json({
                status: false,
                message: 'Station not found'
            });
        }

        station.station_name = station_name || station.station_name;
        station.unit_price = unit_price || station.unit_price;
        station.start_time = start_time || station.start_time;
        station.end_time = end_time || station.end_time;
        station.location.coordinates = [parseFloat(longitude), parseFloat(latitude)] || station.location.coordinates;
        station.location.name = location || station.location.name;

        if (req.file) {
            station.station_image = req.file.filename;
        }

        const updatedStation = await station.save();

        res.status(200).json({
            status: true,
            data: updatedStation,
            message: 'Station updated successfully'
        });

    } catch (error) {
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({
            status: false,
            message: error.message
        });
    }
});

router.post("/delete_station", upload, async (req, res) => {
    try {

        const {
            _id
        } = req.body;

        if (!_id) {
            return res.status(404).json({
                status: false,
                message: 'Station not found'
            });
        }

        const deletedStation = await Station.findByIdAndDelete(_id);
        res.status(200).json({
            status: true,
            message: 'Station delete successfully.'
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Internal Server Error'
        });
    }
});

router.post("/station_detail", upload, async (req, res) => {
    try {
        const {
            _id
        } = req.body;
        if (!_id) {
            return res.status(404).json({
                status: false,
                message: '_id is required'
            });
        }
        const station = await Station.findOne({
            _id
        });
        if (!station) {
            return res.status(200).json({
                status: false,
                message: 'Station not found'
            });
        }
        res.status(200).json({
            status: true,
            data: station,
            message: 'Station fetch successfully.'
        });
    } catch (error) {
        console.log('error', error)
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({
            status: false,
            message: error.message
        });
    }
});

router.get("/station_list", async (req, res) => {
    try {
        const stations = await Station.find({}).sort({ _id: -1 }).exec()
        res.status(200).json({
            status: true,
            data: stations,
            message: 'Stations fetch successfully.'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: 'Internal Server Error'
        });
    }
});

router.post("/create_station_port", upload, async (req, res) => {
    try {
        const {
            station_id,
            port_type,
            slots
        } = req.body;
        if (!station_id || !port_type || !slots) {
            return res.status(200).json({
                status: false,
                message: 'All fields are required'
            });
        } else {
            await Port.create({
                station_id,
                port_type,
                slots
            });
            res.status(201).json({
                status: true,
                message: 'Port created successfully'
            });
        }
    } catch (error) {
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({
            status: false,
            message: error.message
        });
    }
});

router.post("/edit_station_port", upload, async (req, res) => {
    try {

        const {
            _id,
            port_typet,
            slots
        } = req.body;
        if (!_id) {
            return res.status(404).json({
                status: false,
                message: '_id is required'
            });
        }
        const port = await Port.findOne({
            _id
        });
        if (!port) {
            return res.status(404).json({
                status: false,
                message: 'Port not found'
            });
        } else {
            port.port_type = port_type || port.port_type;
            port.slots = slots || port.slots;

            const updatedStation = await port.save();

            res.status(200).json({
                status: true,
                message: 'Station updated successfully'
            });
        }
    } catch (error) {
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({
            status: false,
            message: error.message
        });
    }
});

router.post("/station_port_detail", upload, async (req, res) => {
    try {
        const {
            _id
        } = req.body;
        if (!_id) {
            return res.status(404).json({
                status: false,
                message: '_id is required'
            });
        }

        const port = await Port.findOne({
            _id
        });
        if (!port) {
            return res.status(200).json({
                status: false,
                message: 'Port not found'
            });
        } else {
            const station = await Station.findOne({
                _id: port?.station_id
            });
            if (!station) {
                return res.status(200).json({
                    status: false,
                    message: 'Station not found'
                });
            } else {
                const data = {
                    ...port.toObject(),
                    unit_price: station?.unit_price
                };
                res.status(200).json({
                    status: true,
                    data,
                    message: 'Port fetch successfully.'
                });
            }
        }
    } catch (error) {
        console.log('error', error);
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({
            status: false,
            message: error.message
        });
    }
});


router.post("/station_port_list", upload, async (req, res) => {
    try {
        const {
            station_id
        } = req.body;
        if (!station_id) {
            return res.status(404).json({
                status: false,
                message: 'station_id is required'
            });
        }

        const port = await Port.find({
            station_id
        }).sort({
            _id: -1
        }).exec();
        if (!port) {
            return res.status(200).json({
                status: false,
                message: 'Ports not found'
            });
        }

        const station = await Station.findOne({
            _id: port?.[0]?.station_id
        });
        if (!station) {
            return res.status(200).json({
                status: false,
                message: 'Station not found'
            });
        } else {

            const modified_array = port?.map((item, index) => {
                return {
                    ...item.toObject(),
                    unit_price: station?.unit_price
                }
            })

            res.status(200).json({
                status: true,
                data: modified_array,
                message: 'Ports fetch successfully.'
            });
        }


    } catch (error) {
        console.log('error', error)
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({
            status: false,
            message: error.message
        });
    }
});

router.post("/delete_port", upload, async (req, res) => {
    try {

        const {
            _id
        } = req.body;

        if (!_id) {
            return res.status(404).json({
                status: false,
                message: 'Port not found'
            });
        }

        const deletedPort = await Port.findByIdAndDelete(_id);
        res.status(200).json({
            status: true,
            message: 'Port delete successfully.'
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Internal Server Error'
        });
    }
});

router.post("/register", upload, async (req, res) => {
    try {
        const {
            email,
            password,
            name
        } = req.body;

        if (!email || !password || !name) {
            return res.status(200).json({
                status: false,
                message: 'All fields are required'
            });
        }

        const existingEmailUser = await AdminUsers.findOne({
            email
        });

        if (existingEmailUser) {
            return res.status(200).json({
                status: false,
                message: 'Email already exists'
            });
        }

        const user = await AdminUsers.create({
            email,
            password,
            name
        });
        // const token = jwt.sign({ userId: user._id }, tokenSecretKey, { expiresIn: '1h' });
        res.status(201).json({
            status: true,
            data: user,
            message: 'User registered successfully'
        });
    } catch (error) {
        res.status(200).json({
            status: false,
            message: error.message
        });
    }
});

router.post("/registration_otp_verfication", upload, async (req, res) => {
    try {
        const randomFourDigitNumber = Math.floor(Math.random() * 9000) + 1000;
        const {
            email
        } = req.body;
        if (!email) {
            return res.status(200).json({
                status: false,
                message: 'Email is required'
            });
        } else if (await AdminUsers.findOne({
            email
        })) {
            return res.status(200).json({
                status: false,
                message: 'Email already exists'
            });
        } else {
            return res.status(200).json({
                status: true,
                data: {
                    OTP: randomFourDigitNumber
                },
                message: 'We have sent an OTP to your number.'
            });
        }
    } catch (error) {
        res.status(200).json({
            status: false,
            message: error.message
        });
    }
});

router.post("/edit_profile", AuthMiddleware, upload_single, async (req, res) => {
    try {

        const {
            _id,
            email,
            password,
            name
        } = req.body;
        if (!_id) {
            return res.status(200).json({
                status: false,
                message: '_id is required'
            });
        }
        const user = await AdminUsers.findOne({
            _id
        });
        if (!user) {
            return res.status(200).json({
                status: false,
                message: 'User not found'
            });
        }

        user.email = email || user.email;
        user.password = password || user.password;
        user.name = name || user.name;

        if (req.file) {
            user.profile_image = req.file.filename;
        }

        const updatedUser = await user.save();

        res.status(200).json({
            status: true,
            data: updatedUser,
            message: 'Profile updated successfully'
        });

    } catch (error) {
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({
            status: false,
            message: error.message
        });
    }
});

router.post("/fetch_profile", upload, async (req, res) => {
    try {
        const {
            _id
        } = req.body;
        if (!_id) {
            return res.status(404).json({
                status: false,
                message: '_id is required'
            });
        }
        const user = await AdminUsers.findOne({
            _id
        });
        if (!user) {
            return res.status(200).json({
                status: false,
                message: 'User not found'
            });
        }
        res.status(200).json({
            status: true,
            data: user,
            message: 'Profile fetch successfully.'
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Internal Server Error'
        });
    }
});

router.post("/create_station_radius", upload, async (req, res) => {
    try {
        const {
            radius
        } = req.body;

        if (!radius) {
            return res.status(200).json({
                status: false,
                message: 'Radius are required'
            });
        }

        const stationRadius = await StationradiusUsers.find({}).sort({ _id: -1 }).exec()

        if (stationRadius.length > 0) {
            return res.status(200).json({
                status: false,
                message: 'radius already exists'
            });
        }

        const data = await StationradiusUsers.create({
            radius
        });
        // const token = jwt.sign({ userId: user._id }, tokenSecretKey, { expiresIn: '1h' });
        res.status(201).json({
            status: true,
            message: 'Radius add successfully'
        });
    } catch (error) {
        res.status(200).json({
            status: false,
            message: error.message
        });
    }
});

router.post("/edit_station_radius", AuthMiddleware, upload_single, async (req, res) => {
    try {

        const {
            _id,
            radius
        } = req.body;
        if (!_id) {
            return res.status(200).json({
                status: false,
                message: '_id is required'
            });
        }
        const fetchRadius = await StationradiusUsers.findOne({
            _id
        });
        if (!fetchRadius) {
            return res.status(200).json({
                status: false,
                message: 'User not found'
            });
        }

        fetchRadius.radius = radius || fetchRadius.radius;

        const updatedRadius = await fetchRadius.save();

        res.status(200).json({
            status: true,
            message: 'Radius updated successfully'
        });

    } catch (error) {
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({
            status: false,
            message: error.message
        });
    }
});

router.post("/fetch_radius", upload, async (req, res) => {
    try {

        const radius = await StationradiusUsers.find({}).sort({ _id: -1 }).exec()
        if (!radius) {
            return res.status(200).json({
                status: false,
                message: 'User not found'
            });
        }
        res.status(200).json({
            status: true,
            data: radius,
            message: 'Radius fetch successfully.'
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Internal Server Error'
        });
    }
});

router.post("/station_reviews", upload, async (req, res) => {
    try {
        const { station_id } = req.body;
        if (!station_id) {
            return res.status(200).json({ status: true, data: [], message: 'station_id is required' });
        } else {
            const stationRating = await Rating.find({ station_id }).sort({ _id: -1 }).exec()
            if (stationRating) {
                return res.status(200).json({ status: true, data: stationRating, message: 'Reviews fetch successfully.' });
            } else {
                return res.status(200).json({ status: false, data: [], message: 'Reviews not found!' });
            }
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, data: [], message: 'Internal Server Error' });
    }
});


module.exports = router;