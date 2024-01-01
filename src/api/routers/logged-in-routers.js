const express = require('express');
const multer = require('multer')
const moment = require('moment')
const router = express.Router();
const upload = multer().none();
const { MongoClient } = require('mongodb')
const Station = require('../models/admin/create-station')
const Port = require('../models/admin/create-port')
const StationradiusUsers = require('../models/admin/station-radius')
const Rating = require('../models/logged-in/station-rating')
const Wallet = require('../models/logged-in/wallet')
const Booking = require('../models/logged-in/booking')
const Transaction = require('../models/logged-in/transaction')
const { DATE_FORMATE } = require('../../utils/urls')
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
                    },
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
                        rating: { $avg: { $ifNull: [{ $toDouble: "$rating.rating" }, 0] } },
                        distance: { $first: { $round: [{ $divide: ["$distance", 1000] }, 2] } }
                    }
                }
            ]);

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
                        avg: { $round: ['$avg' , 1] }
                    }
                }
            ]).exec();


            await Promise.all([
                Station.findOne({ _id }),
                Port.find({ station_id: _id }).sort({ _id: -1 }).exec()
            ]).then((resonse) => {
                if (resonse[0]) {
                    const myLat = latitude
                    const myLng = longitude

                    const lat = resonse[0]?.location?.coordinates[1] || 0
                    const lng = resonse[0]?.location?.coordinates[0] || 0

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
                res.status(200).json({ status: false, message: 'something went wrong.' });
            })
        }
    } catch (error) {
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
                return res.status(200).json({ status: false, message: 'Stations not found!' });
            }
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, message: 'Internal Server Error' });
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
                return res.status(200).json({ status: false, message: 'Something went wrong!' });
            }
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});

// router.post('/get_port_slots', upload, async (req, res) => {
//     const { station_id, port_id } = req.body;

//     if (!station_id || !port_id) {
//         return res.status(200).json({ error: 'Both station id and port id are required.' });
//     } else {
//         const fetchBookingEntries = await Booking.find({ station_id, port_id })
//         if (fetchBookingEntries.length > 0) {
//             console.log('fetchBookingEntries', fetchBookingEntries)
//         } else {
//             const stationFound = await Station.findOne({_id : station_id})  
//             // const response = {
//             //     slots
//             // }

//             res.status(200).json({ status: true, data : stationFound, message: 'Station fetch successfully.' });
//         }
//         // const startMoment = moment(startTime, 'h:mm A');
//         // const endMoment = moment(endTime, 'h:mm A');

//         // if (!startMoment.isValid() || !endMoment.isValid()) {
//         //     return res.status(400).json({ error: 'Invalid time format. Please use h:mm A format.' });
//         // }

//         // const slots = generateSlots(startMoment, endMoment);

//         // res.json({ slots });
//     }


// });

router.post("/port_slots", upload, async (req, res) => {
    try {
        const { station_id, port_id, latitude, longitude } = req.body;

        if (!station_id || !port_id) {
            return res.status(200).json({ error: 'Both station id and port id are required.' });
        }

        const fetchBookingEntries = await Booking.find({ station_id, port_id, date: moment(new Date()).format(DATE_FORMATE) });

        if (fetchBookingEntries.length > 0) {
            const fetch_start_and_end_time = fetchBookingEntries?.map((item, index) => {
                return { start_time: item.start_time, end_time: item.end_time, }
            })

            const stationRating = await Rating.aggregate([
                { $match: { station_id: station_id } },
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

            const resonse = await Station.findOne({ _id: station_id });

            if (resonse) {
                const { location } = resonse;
                const myLat = latitude;
                const myLng = longitude;
                const port_detail = await Port.findOne({  _id: port_id });

                const lat = location?.coordinates[1] || 0;
                const lng = location?.coordinates[0] || 0;

                const distanceInKm = calculateDistance(myLat, myLng, lat, lng);


                const startMoment = moment(resonse?.start_time, 'h:mm A');
                const endMoment = moment(resonse?.end_time, 'h:mm A');

                if (!startMoment.isValid() || !endMoment.isValid()) {
                    return res.status(200).json({ error: 'Invalid time format. Please use h:mm A format.' });
                } else {

                    const slots = generateSlots(startMoment, endMoment, false);


                    // const fetch_start_and_end_time = [{start_time : '2:00 PM' , end_time : "5:00 PM"}]
                    const currentTime = moment(); // Get the current time

                    fetch_start_and_end_time.forEach(({ start_time, end_time }) => {
                        // Convert start_time and end_time to moment objects for easier comparison
                        const startTime = moment(start_time, 'h:mm A');
                        const endTime = moment(end_time, 'h:mm A');

                        // Check if the current time is before the station's end time
                        if (currentTime.isBefore(endTime)) {
                            // Iterate through each slot and check for overlap
                            slots.forEach(slot => {
                                const slotTime = moment(slot.time, 'h:mm A');

                                // Check if slotTime is between startTime and endTime and is after the current time
                                if (slotTime.isBetween(startTime, endTime, null, '[]') && slotTime.isAfter(currentTime)) {
                                    slot.isBooked = true;
                                }
                            });
                        }
                    });

                    const currentMoment = moment(currentTime, 'h:mm A');

                    // Filter the slots based on the current time
                    const filteredSlots = slots.filter(slot => moment(slot.time, 'h:mm A').isAfter(currentMoment));

                    const data = {
                        station_detail: {
                            ...resonse?.toObject(),
                            rating: stationRating?.length > 0 ? stationRating[0]?.avg : 0,
                            distance: distanceInKm ? distanceInKm.toFixed(2) : '0'
                        },
                        port_detail : port_detail,
                        slots: filteredSlots
                    };

                    res.status(200).json({ status: true, data, message: 'Station detail fetch successfully.' });
                }


            } else {
                res.status(200).json({ status: false, message: 'Station not found!' });
            }
        } else {
            const stationRating = await Rating.aggregate([
                { $match: { station_id: station_id } },
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

            const resonse = await Station.findOne({ _id: station_id });
            
            if (resonse) {
                const port_detail = await Port.findOne({  _id: port_id });
                const { location } = resonse;
                const myLat = latitude;
                const myLng = longitude;

                const lat = location?.coordinates[1] || 0;
                const lng = location?.coordinates[0] || 0;

                const distanceInKm = calculateDistance(myLat, myLng, lat, lng);


                const startMoment = moment(resonse?.start_time, 'h:mm A');
                const endMoment = moment(resonse?.end_time, 'h:mm A');

                if (!startMoment.isValid() || !endMoment.isValid()) {
                    return res.status(400).json({ error: 'Invalid time format. Please use h:mm A format.' });
                } else {
                    const slots = generateSlots(startMoment, endMoment, false);

                    const data = {
                        station_detail: {
                            ...resonse?.toObject(),
                            rating: stationRating?.length > 0 ? stationRating[0]?.avg : 0,
                            distance: distanceInKm ? distanceInKm.toFixed(2) : '0'
                        },
                        port_detail : port_detail,
                        slots: slots
                    };

                    res.status(200).json({ status: true, data, message: 'Station detail fetch successfully.' });
                }


            } else {
                res.status(200).json({ status: false, message: 'Station not found!' });
            }
        }
    } catch (error) {
        console.error('Error:', error);
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({ status: false, message: error.message });
    }
});

router.post("/port_slot_reservation", upload, async (req, res) => {
    try {
        const { start_time, end_time, station_id, port_id } = req.body;

        if (!start_time || !end_time || !station_id || !port_id) {
            return res.status(200).json({ status: false, message: 'All fields are required.' });
        }

        // Fetch booking entries and station information in parallel
        const [fetchBookingEntries, response] = await Promise.all([
            Booking.find({ station_id, port_id, date: moment(new Date()).format(DATE_FORMATE) }),
            Station.findOne({ _id: station_id })
        ]);

        if (response) {
            if (fetchBookingEntries.length > 0) {
                const fetch_start_and_end_time = fetchBookingEntries.map(item => ({
                    start_time: item.start_time,
                    end_time: item.end_time,
                }));

                if (response) {
                    const startMoment = moment(response.start_time, 'h:mm A');
                    const endMoment = moment(response.end_time, 'h:mm A');

                    if (!startMoment.isValid() || !endMoment.isValid()) {
                        return res.status(200).json({ status: false, message: 'Invalid time format. Please use h:mm A format.' });
                    }

                    const slots = generateSlots(startMoment, endMoment, false);

                    // Use Promise.all to parallelize the slot booking check
                    await Promise.all(fetch_start_and_end_time.map(({ start_time, end_time }) => {
                        const startTime = moment(start_time, 'h:mm A');
                        const endTime = moment(end_time, 'h:mm A');

                        slots.forEach(slot => {
                            const slotTime = moment(slot.time, 'h:mm A');

                            if (slotTime.isBetween(startTime, endTime, null, '[]')) {
                                slot.isBooked = true;
                            }
                        });
                    }));

                    const isAnySlotBooked = slots.some(slot => {
                        const slotTime = moment(slot.time, 'h:mm A');
                        const startTime = moment(start_time, 'h:mm A');
                        const endTime = moment(end_time, 'h:mm A');

                        return slotTime.isBetween(startTime, endTime, null, '[]') && slot.isBooked;
                    });

                    const data = {
                        total_amount: hourConvertIntoMinute(response.unit_price, start_time, end_time),
                    };

                    const statusMessage = isAnySlotBooked
                        ? 'There are booked slots between the specified start and end times'
                        : 'Reservation successfully.';

                    res.status(200).json({ status: !isAnySlotBooked, data, message: statusMessage });
                } else {
                    const startMoment = moment(response.start_time, 'h:mm A');
                    const endMoment = moment(response.end_time, 'h:mm A');

                    if (!startMoment.isValid() || !endMoment.isValid()) {
                        return res.status(200).json({ status: false, message: 'Invalid time format. Please use h:mm A format.' });
                    }

                    const slots = generateSlots(startMoment, endMoment, false);

                    // Use Promise.all to parallelize the slot booking check
                    await Promise.all(fetch_start_and_end_time.map(({ start_time, end_time }) => {
                        const startTime = moment(start_time, 'h:mm A');
                        const endTime = moment(end_time, 'h:mm A');

                        slots.forEach(slot => {
                            const slotTime = moment(slot.time, 'h:mm A');

                            if (slotTime.isBetween(startTime, endTime, null, '[]')) {
                                slot.isBooked = true;
                            }
                        });
                    }));

                    const isAnySlotBooked = slots.some(slot => {
                        const slotTime = moment(slot.time, 'h:mm A');
                        const startTime = moment(start_time, 'h:mm A');
                        const endTime = moment(end_time, 'h:mm A');

                        return slotTime.isBetween(startTime, endTime, null, '[]') && slot.isBooked;
                    });

                    const data = {
                        total_amount: hourConvertIntoMinute(response.unit_price, start_time, end_time),
                    };

                    const statusMessage = isAnySlotBooked
                        ? 'There are booked slots between the specified start and end times'
                        : 'Reservation successfully.';

                    res.status(200).json({ status: !isAnySlotBooked, data, message: statusMessage });
                }
            } else {
                const data = {
                    total_amount: hourConvertIntoMinute(response.unit_price, start_time, end_time),
                };
                res.status(200).json({ status: true, data, message: 'Reservation successfully.' });
            }
        } else {
            res.status(200).json({ status: false, message: 'Station not found!' });
        }


    } catch (error) {
        console.error('Error:', error);
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({ status: false, message: error.message });
    }
});

router.post("/booking_port", upload, async (req, res) => {
    try {
        const { user_id, station_id, port_id, amount, start_time, end_time, transaction_id, account_type } = req.body
        if (!station_id || !port_id || !amount || !start_time || !end_time || !transaction_id) {
            return res.status(200).json({ status: false, message: 'All fields are required.' });
        } else {
            const findWallet = await Wallet.findOne({ user_id })
            if(findWallet){
                const wallet_balance = findWallet?.amount ?  parseFloat(findWallet?.amount) : 0.00
                 if( wallet_balance  >= parseFloat(amount)){
                    const bookingSubmit = await Booking.create({ user_id, station_id, port_id, amount, start_time, end_time, transaction_id, account_type })
                    if (bookingSubmit) {
                        const wallet_balance =  parseFloat(findWallet?.amount) - parseFloat(amount)
                        const amountAdd = parseFloat(findWallet.amount) + parseFloat(amount)   
                        findWallet.amount = wallet_balance || findWallet.amount;
                        const updatedWallet = await findWallet.save();
                        if(updatedWallet){
                            const transaction = await Transaction.create({ user_id, transaction_id : '' , amount ,credit_or_debit : 'DB' , })
                            if(transaction){
                                return res.status(200).json({ status: true, message: 'Booking submit successfully.' });
                            }else{
                                return res.status(200).json({ status: false, message: 'Something issue from transaction' });
                            }
                        }else{
                            return res.status(200).json({ status: false, message: 'Wallet transaction issue!' }); 
                        }
                    } else {
                        return res.status(200).json({ status: false, message: 'Something went wrong!' });
                    }
                 }else{
                    return res.status(200).json({ status: false, message: `You have account balance is ${wallet_balance}`});  
                 }
            }else{
                return res.status(200).json({ status: false, message: `You have account balance is 0.00`});
            }
        }
    } catch (error) {
        console.error('Error:', error);
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({ status: false, message: error.message });
    }
});


router.post("/wallet", upload, async (req, res) => {
    try {
        const { user_id, account_type,transaction_id , amount   } = req.body
        if (!user_id || !account_type || !transaction_id || !amount ) {
            return res.status(200).json({ status: false, message: 'All fields are required.' });
        } else {
            const findWallet = await Wallet.findOne({ user_id })
            if(findWallet){
                const amountAdd = parseFloat(findWallet.amount) + parseFloat(amount)   
                findWallet.amount = amountAdd || findWallet.amount;
                const updatedWallet = await findWallet.save();
                if (updatedWallet) {
                    const transaction = await Transaction.create({ user_id, transaction_id , amount ,credit_or_debit : 'CR' , })
                    if(transaction){
                        return res.status(200).json({ status: true, message: 'Credit amount in your wallet successfully.' });
                    }else{
                        return res.status(200).json({ status: false, message: 'Something issue from transaction' });
                    }
                } else {
                    return res.status(200).json({ status: true, message: 'Something went wrong!' });
                }
            }else{
                const credit = await Wallet.create({ user_id, account_type,transaction_id , amount })
                if (credit) {
                    const transaction = await Transaction.create({ user_id, transaction_id , amount ,credit_or_debit : 'CR' , })
                    if(transaction){
                        return res.status(200).json({ status: true, message: 'Credit amount in your wallet successfully.' });
                    }else{
                        return res.status(200).json({ status: false, message: 'Something issue from transaction' });
                    }
                } else {
                    return res.status(200).json({ status: true, message: 'Something went wrong!' });
                }
            }
        }
    } catch (error) {
        res.status(200).json({ status: false, message: error.message });
    }
});

router.post("/transaction", upload, async (req, res) => {
 try {
    const {user_id} = req.body
    const findWallet = await Wallet.findOne({ user_id })
    const findTransaction = await Transaction.find({ user_id }).sort({ _id: -1 }).exec()
    if(findTransaction.length > 0 && findWallet){
        const data = {
            balance :  findWallet?.amount || '0.00',
            transaction : findTransaction
        }
        res.status(200).json({ status: true, data : data, message: 'Transaction fetch successfully.' });
    }else{
        res.status(200).json({ status: false,  message: 'Transaction not found!' });
    }
 } catch (error) {
    res.status(200).json({ status: false, message: error.message });
}
})


function generateSlots(startMoment, endMoment, isBooked) {
    const slots = [];
    let currentSlot = startMoment.clone();

    while (currentSlot.isSameOrBefore(endMoment)) {
        slots.push({ time: currentSlot.format('h:mm A'), isBooked: isBooked });
        currentSlot.add(1, 'hours');
    }

    return slots;
}

function hourConvertIntoMinute(per_min_unit, start_time, end_time) {
    // Convert start_time and end_time to moment objects
    const startTime = moment(start_time, 'h:mm A');
    const endTime = moment(end_time, 'h:mm A');

    // Calculate the time difference in minutes
    const timeDifferenceInMinutes = endTime.diff(startTime, 'minutes');

    // Ensure the time difference is non-negative
    const validTimeDifference = Math.max(timeDifferenceInMinutes, 0);

    // Calculate the cost
    const cost = validTimeDifference * per_min_unit;

    console.log(`Total cost: $${cost}`);
    return cost;
}



module.exports = router;