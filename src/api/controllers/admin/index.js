// models
const AdminUsers = require('../../models/admin/admin-users')
const Station = require('../../models/admin/create-station')
const Port = require('../../models/admin/create-port')
const StationradiusUsers = require('../../models/admin/station-radius')
const Rating = require('../../models/logged-in/station-rating')
const Users = require('../../models/auth/users');

// object id

const ObjectId = require('mongodb').ObjectId;

// moment

const moment = require('moment')


 const login = async (req, res) => {
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
}

 const createStation = async (req, res) => {
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



        await Stations.create({
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
}

const editStation = async (req, res) => {
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
}

const deleteStation = async (req, res) => {
    try {

        const {
            _id
        } = req.body;

        if (!_id) {
            return res.status(200).json({
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
}

const stationDetail = async (req, res) => {
    try {
        const {
            _id
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
}

const stationList = async (req, res) => {
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
}

const createStationPort = async (req, res) => {
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
}

const editStationPort = async (req, res) => {
    try {

        const {
            _id,
            port_typet,
            slots
        } = req.body;
        if (!_id) {
            return res.status(200).json({
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
}

const stationPortDetail = async (req, res) => {
    try {
        const {
            _id
        } = req.body;
        if (!_id) {
            return res.status(200).json({
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
}

const stationPortList= async (req, res) => {
    try {
        const {
            station_id
        } = req.body;
        if (!station_id) {
            return res.status(200).json({
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
}

const deletePort = async (req, res) => {
    try {

        const {
            _id
        } = req.body;

        if (!_id) {
            return res.status(200).json({
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
}

const register = async (req, res) => {
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
}

const registerationOtpVerification =  async (req, res) => {
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
}

const editProfile = async (req, res) => {
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
}

const fetchProfile = async (req, res) => {
    try {
        const {
            _id
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
}

const createStationRadius = async (req, res) => {
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
}

const editStationRadius = async (req, res) => {
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
}

const fetchRadius = async (req, res) => {
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
}

const stationReviews = async (req, res) => {
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
}

const users = async (req, res) => {
    try {
        const users = await Users.find({}).sort({ _id: -1 }).exec()
        res.status(200).json({
            status: true,
            data: users,
            message: 'Users fetch successfully.'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: 'Internal Server Error'
        });
    }
}

const userFetchDetail = async (req, res) => {
    try {
        const {
            _id
        } = req.body;
        if (!_id) {
            return res.status(200).json({
                status: false,
                message: '_id is required'
            });
        }
        const user = await Users.findOne({
            _id
        });
        if (!user) {
            return res.status(200).json({
                status: false,
                message: 'User not found'
            });
        }else{
            res.status(200).json({
                status: true,
                data: user,
                message: 'Profile fetch successfully.'
            });
        }
       
    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Internal Server Error'
        });
    }
}

const userEditDetail = async (req, res) => {
    try {
        const {
            _id,
            email,
            name,
            phone,
            bike_mode,
            status
        } = req.body;
        if (!_id) {
            return res.status(200).json({
                status: false,
                message: '_id is required'
            });
        }
        const user = await Users.findOne({_id});
        if (!user) {
            return res.status(200).json({
                status: false,
                message: 'User not found'
            });
        }

        user.email = email || user.email;
        user.phone = phone || user.phone;
        user.name = name || user.name;
        user.bike_mode = bike_mode || user.bike_mode;
        user.status = status || user.status;

        if (req.file) {
            user.profile_image = req.file.filename;
        }

        const updatedUser = await user.save();

        res.status(200).json({
            status: true,
            message: 'Profile updated successfully'
        });

    } catch (error) {
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({
            status: false,
            message: error.message
        });
    }
}

module.exports = {
    login,
    createStation,
    editStation,
    deleteStation,
    stationDetail,
    stationList,
createStationPort,
editStationPort,
stationPortDetail,
stationPortList,
deletePort,
register,
registerationOtpVerification,
editProfile,
fetchProfile,
createStationRadius,
editStationRadius,
fetchRadius,
stationReviews,
users,
userFetchDetail,
userEditDetail
  };