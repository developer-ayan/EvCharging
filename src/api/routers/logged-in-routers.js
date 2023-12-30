const express = require('express');
const multer = require('multer')
const router = express.Router();
const upload = multer().none();
const { MongoClient } = require('mongodb')
const Station = require('../models/admin/create-station')
const Port = require('../models/admin/create-port')
const StationradiusUsers = require('../models/admin/station-radius')
const Rating = require('../models/logged-in/station-rating')
const ObjectId = require('mongodb').ObjectId;

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers

    return distance;
}

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

// router.post("/dashboard_stations", upload, async (req, res) => {
//     try {
//         const { latitude, longitude } = req.body;

//         if (!latitude || !longitude) {
//             return res.status(200).json({ status: false, message: 'latitude and longitude are required' });
//         } else {
//             const radius = await StationradiusUsers.find({}).sort({ _id: -1 }).exec()
//             const set_radius = radius?.length > 0 ? parseFloat(radius?.[0]?.toObject()?.radius) : 10
//             const nearbyStations = await Station.find({
//                 latitude: {
//                     $gt: parseFloat(latitude) - (set_radius / 111), // Latitude range
//                     $lt: parseFloat(latitude) + (set_radius / 111),
//                 },
//                 longitude: {
//                     $gt: parseFloat(longitude) - (set_radius / (111 * Math.cos(parseFloat(latitude) * Math.PI / 180))), // Longitude range
//                     $lt: parseFloat(longitude) + (set_radius / (111 * Math.cos(parseFloat(latitude) * Math.PI / 180))),
//                 },
//             }).sort({ _id: -1 }).exec()

//             res.status(200).json({ status: true, data: nearbyStations, message: 'Stations fetch successfully.' });
//         }
//     } catch (error) {
//         const status = error.name === 'ValidationError' ? 400 : 1;
//         res.status(200).json({ status: false, message: error.message });
//     }
// });



router.post("/dashboard_stations", upload, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(200).json({ status: false, message: 'latitude and longitude are required' });
        } else {
            const radius = await StationradiusUsers.find({}).sort({ _id: -1 }).exec()
            const set_radius = radius?.length > 0 ? parseFloat(radius?.[0]?.toObject()?.radius) : 10

            const result = await Station.aggregate([
                {
                    $geoNear: {
                        near: {
                            type: 'Point',
                            coordinates: [parseFloat(longitude), parseFloat(latitude)]
                        },
                        distanceField: 'distance',
                        maxDistance: set_radius * 1000, // Convert kilometers to meters
                        spherical: true
                    }
                },
                {
                    $lookup: {
                        from: "station_reviews",
                        let: { stationId: { $toString: "$_id" } },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: ["$station_id", "$$stationId"]
                                    }
                                }
                            }
                        ],
                        as: "rating"
                    }
                },
                {
                    $unwind: {
                        path: "$rating",
                        preserveNullAndEmptyArrays: true // Include stations without ratings
                    }
                },
                {
                    $group: {
                        _id: "$_id",
                        station_name: { $first: "$station_name" },
                        unit_price: { $first: "$unit_price" },
                        location: { $first: "$location" },
                        serial_no: { $first: "$serial_no" },
                        averageRating: { $avg: { $ifNull: [{ $toDouble: "$rating.rating" }, 0] } }, // Calculate average rating, consider 0 if rating is null
                        distance: { $first: { $round: [{ $divide: ["$distance", 1000] }, 2] } } // Convert meters to kilometers and round to 2 decimal places
                    }
                }
            ]);

            console.log(result);

            res.status(200).json({ status: true, data: result, message: 'Stations fetch successfully.' });
        }
    } catch (error) {
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({ status: false, message: error.message });
    }
});





router.post("/station_detail", upload, async (req, res) => {
    try {
        const { _id, latitude, longitude } = req.body;

        if (!_id) {
            return res.status(200).json({ status: false, message: '_id is required' });
        } else {

            const stationRating = await Rating.aggregate([
                { $match: { station_id: _id } },
                { $sort: { _id: -1 } },
                {
                    $group: {
                        _id: '$station_id',
                        count: { $sum: 1 },
                        avg: { $avg: { $toInt: '$rating' } } // Convert 'rating' to integer for averaging
                    }
                },
                {
                    $project: {
                        _id: 1,
                        count: 1,
                        avg: { $round: ['$avg', 1] }
                    }
                }
            ]).exec();


            await Promise.all([
                Station.findOne({ _id }),
                Port.find({ station_id: _id }).sort({ _id: -1 }).exec()
            ]).then((resonse) => {
                if (resonse[0]) {
                    console.log(resonse[0]?.location?.coordinates)

                    const myLat = latitude
                    const myLng = longitude

                    const lat = resonse[0]?.location?.coordinates[1]
                    const lng = resonse[0]?.location?.coordinates[0]

                    const distanceInKm = calculateDistance(myLat, myLng, lat, lng);

                    const data = {
                        station_detail: {
                            ...resonse[0]?.toObject(),
                            rating: stationRating?.length > 0 ? stationRating?.[0]?.avg : 0,
                            distance: distanceInKm ? distanceInKm?.toFixed(2) : '0'
                        },
                        port_list: resonse[1]
                    }
                    res.status(200).json({ status: true, data, message: 'Station detail fetch successfully.' });
                } else {
                    res.status(200).json({ status: false, message: 'Station not found!' });
                }
            }).catch(() => {
                res.status(200).json({ status: false, data: {}, message: 'something went wrong.' });
            })
        }
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
        } else {
            const regex = new RegExp(search, 'i');
            const stations = await Station.find({ station_name: { $regex: regex } }).sort({ _id: -1 }).exec();
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

router.post("/send_station_review", upload, async (req, res) => {
    try {
        const { rating, description, station_id } = req.body;
        if (!station_id) {
            return res.status(200).json({ status: true, data: [], message: 'station_id is required' });
        } else if (!rating) {
            return res.status(200).json({ status: true, data: [], message: 'rating is required' });
        } else {
            const ratingSend = await Rating.create({ station_id, rating, description });
            if (ratingSend) {
                return res.status(200).json({ status: true, message: 'Send review successfully.' });
            } else {
                return res.status(200).json({ status: false, data: [], message: 'Something went wrong!' });
            }
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, data: [], message: 'Internal Server Error' });
    }
});


module.exports = router;