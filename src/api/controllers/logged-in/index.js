// models

const Station = require("../../models/admin/create-station");
const Port = require("../../models/admin/create-port");
const StationradiusUsers = require("../../models/admin/station-radius");
const Rating = require("../../models/logged-in/station-rating");
const Wallet = require("../../models/logged-in/wallet");
const Booking = require("../../models/logged-in/booking");
const Transaction = require("../../models/logged-in/transaction");
const Notification = require("../../models/common/notification");

// object id

const ObjectId = require("mongodb").ObjectId;

// axios
const axios = require("axios");
// moment

const moment = require("moment");
const cron = require("node-cron");

// date formate

const { DATE_FORMATE } = require("../../../utils/urls");
const { sendNotification } = require("../../../utils/helpers");
const EnvironmentVariable = require("../../models/admin/environment-variable");
const { default: mongoose } = require("mongoose");

const dashboardStations = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(200).json({
        status: false,
        message: "latitude and longitude are required",
      });
    } else {
      const radius = await StationradiusUsers.find({}).sort({ _id: -1 }).exec();
      const set_radius =
        radius?.length > 0 ? Number(radius?.[0]?.toObject()?.radius) : 10;

      const result = await Station.aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [Number(longitude), Number(latitude)],
            },
            distanceField: "distance",
            maxDistance: set_radius * 1000, // Convert kilometers to meters
            spherical: true,
          },
        },
        {
          $lookup: {
            from: "station_reviews",
            let: { stationId: { $toString: "$_id" } },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$station_id", "$$stationId"],
                  },
                },
              },
            ],
            as: "rating",
          },
        },
        {
          $lookup: {
            from: "ports",
            let: { stationId: { $toString: "$_id" } },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$station_id", "$$stationId"],
                  },
                },
              },
            ],
            as: "ports",
          },
        },
        {
          $unwind: {
            path: "$rating",
            preserveNullAndEmptyArrays: true, // Include stations without ratings
          },
        },
        {
          $group: {
            _id: "$_id",
            station_name: { $first: "$station_name" },
            location: { $first: "$location" },
            serial_no: { $first: "$serial_no" },
            station_image: { $first: "$station_image" },
            rating: { $avg: { $ifNull: [{ $toDouble: "$rating.rating" }, 0] } },
            distance: {
              $first: { $round: [{ $divide: ["$distance", 1000] }, 2] },
            },
            ports: { $first: { $size: "$ports" } }, // Get the count of ports
          },
        },
      ]);

      res.status(200).json({
        status: true,
        data: result,
        message: "Stations fetch successfully.",
      });
    }
  } catch (error) {
    res.status(200).json({ status: false, message: error.message });
  }
};

const stationDetail = async (req, res) => {
  try {
    const { _id, latitude, longitude } = req.body;

    if (!_id) {
      return res
        .status(200)
        .json({ status: false, message: "_id is required" });
    } else {
      const stationRating = await Rating.aggregate([
        { $match: { station_id: _id } },
        { $sort: { _id: -1 } },
        {
          $group: {
            _id: "$station_id",
            count: { $sum: 1 },
            avg: { $avg: { $toDouble: "$rating" } }, // Convert 'rating' to double for averaging
          },
        },
        {
          $project: {
            _id: 1,
            count: 1,
            avg: { $round: ["$avg", 1] },
          },
        },
      ]).exec();

      await Promise.all([
        Station.findOne({ _id }),
        Port.aggregate([
          {
            $match: {
              station_id: _id,
            },
          },
          {
            $lookup: {
              from: "bookings",
              let: { portId: { $toString: "$_id" } },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ["$port_id", "$$portId"],
                    },
                  },
                },
              ],
              as: "bookings",
            },
          },
        ])
          .sort({ _id: -1 })
          .exec(),
      ])
        .then((resonse) => {
          if (resonse[0]) {
            const startMoment = moment(resonse[0].start_time, "h:mm A");
            const endMoment = moment(resonse[0].end_time, "h:mm A");
            const slots = generateSlots(startMoment, endMoment, false);

            const currentTime = moment(); // Get the current time
            const currentMoment = moment(currentTime, "h:mm A");
            const filteredSlots = slots.filter((slot) =>
              moment(slot.time, "h:mm A").isAfter(currentMoment)
            );

            const myLat = latitude;
            const myLng = longitude;

            const port_detail_modified = resonse[1].map((item, index) => {
              const uniqueSlotsCount = removeDuplicatesAndFilter(
                item.bookings.flatMap((bookingItem) => {
                  const startMoment = moment(bookingItem.start_time, "h:mm A");
                  const endMoment = moment(bookingItem.end_time, "h:mm A");
                  return [
                    ...slots,
                    ...generateSlots(startMoment, endMoment, false),
                  ];
                }),
                currentTime
              ).length;

              return {
                ...item,
                available_slots:
                  uniqueSlotsCount > 0
                    ? uniqueSlotsCount
                    : filteredSlots?.length || 0,
              };
            });

            // Create a new array without modifying the original bookings array
            const new_port_modified = port_detail_modified.map(
              ({ bookings, ...rest }) => ({
                ...rest,
                // If you don't want to include the modified bookings array in the result, omit it
              })
            );

            const lat = resonse[0]?.location?.coordinates[1] || 0;
            const lng = resonse[0]?.location?.coordinates[0] || 0;

            const distanceInKm = calculateDistance(myLat, myLng, lat, lng);

            const data = {
              station_detail: {
                ...resonse[0]?.toObject(),
                rating: stationRating?.length > 0 ? stationRating?.[0]?.avg : 0,
                distance: distanceInKm ? distanceInKm?.toFixed(2) : "0",
              },
              port_list: new_port_modified,
            };
            res.status(200).json({
              status: true,
              data,
              message: "Station detail fetch successfully.",
            });
          } else {
            res
              .status(200)
              .json({ status: false, message: "Station not found!" });
          }
        })
        .catch((e) => {
          console.log("error => ", e.message);
          res
            .status(200)
            .json({ status: false, message: "something went wrong." });
        });
    }
  } catch (error) {
    res.status(200).json({ status: false, message: error.message });
  }
};

const searchStation = async (req, res) => {
  try {
    const { search, latitude, longitude } = req.body;
    if (!search) {
      return res.status(200).json({
        status: true,
        data: [],
        message: "Stations fetched successfully.",
      });
    } else {
      const regex = new RegExp(search, "i");
      const stations = await Station.aggregate([
        {
          $match: {
            station_name: { $regex: regex },
          },
        },
        {
          $lookup: {
            from: "station_reviews",
            let: { stationId: { $toString: "$_id" } },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$station_id", "$$stationId"],
                  },
                },
              },
            ],
            as: "station_reviews",
          },
        },
        {
          $unwind: {
            path: "$station_reviews",
            preserveNullAndEmptyArrays: true, // Include stations without reviews
          },
        },
        {
          $lookup: {
            from: "ports",
            let: { stationId: { $toString: "$_id" } },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$station_id", "$$stationId"],
                  },
                },
              },
            ],
            as: "ports",
          },
        },
        {
          $group: {
            _id: "$_id", // Group by station id
            rating: {
              $avg: { $ifNull: [{ $toDouble: "$station_reviews.rating" }, 0] },
            },
            stationData: { $first: "$$ROOT" }, // Retain the entire station document
            ports: { $first: { $size: "$ports" } }, // Get the count of ports
          },
        },
        {
          $addFields: {
            "stationData.rating": "$rating", // Add averageRating to stationData
            "stationData.ports": "$ports", // Add averageRating to stationData
          },
        },
        {
          $replaceRoot: { newRoot: "$stationData" }, // Replace the root document with stationData
        },
        {
          $project: {
            station_reviews: 0, // Exclude the station_reviews array from the result
          },
        },
      ])
        .sort({ _id: -1 })
        .exec();

      const modified_stations = stations.map((item, index) => {
        const lat = item.location?.coordinates[1] || 0;
        const lng = item.location?.coordinates[0] || 0;
        return {
          ...item,
          distance: calculateDistance(latitude, longitude, lat, lng),
        };
      });

      if (modified_stations.length > 0) {
        return res.status(200).json({
          status: true,
          data: modified_stations,
          message: "Stations fetched successfully.",
        });
      } else {
        return res
          .status(200)
          .json({ status: false, message: "Stations not found!" });
      }
    }
  } catch (error) {
    console.error(error);
    return res
      .status(200)
      .json({ status: false, message: "Internal Server Error" });
  }
};

const sendStationReview = async (req, res) => {
  try {
    const { rating, description, station_id, booking_id } = req.body;
    if (!station_id) {
      return res
        .status(200)
        .json({ status: false, data: [], message: "station_id is required" });
    } else if (!rating) {
      return res
        .status(200)
        .json({ status: false, data: [], message: "rating is required" });
    } else {
      const ratingSend = await Rating.create({
        station_id,
        rating,
        description,
        booking_id,
      });
      if (ratingSend) {
        return res
          .status(200)
          .json({ status: true, message: "Send review successfully." });
      } else {
        return res
          .status(200)
          .json({ status: false, message: "Something went wrong!" });
      }
    }
  } catch (error) {
    console.error(error);
    return res
      .status(200)
      .json({ status: false, message: "Internal Server Error" });
  }
};

const portSlots = async (req, res) => {
  try {
    const { station_id, port_id, latitude, longitude } = req.body;

    if (!station_id || !port_id) {
      return res
        .status(200)
        .json({ error: "Both station id and port id are required." });
    }

    const fetchBookingEntries = await Booking.find({
      station_id,
      port_id,
      date: moment(new Date()).format(DATE_FORMATE),
    });

    if (fetchBookingEntries.length > 0) {
      const fetch_start_and_end_time = fetchBookingEntries?.map(
        (item, index) => {
          return { start_time: item.start_time, end_time: item.end_time };
        }
      );

      const stationRating = await Rating.aggregate([
        { $match: { station_id: station_id } },
        { $sort: { _id: -1 } },
        {
          $group: {
            _id: "$station_id",
            count: { $sum: 1 },
            avg: { $avg: { $toDouble: "$rating" } }, // Convert 'rating' to double for averaging
          },
        },
        {
          $project: {
            _id: 1,
            count: 1,
            avg: { $round: ["$avg", 1] },
          },
        },
      ]).exec();

      const resonse = await Station.findOne({ _id: station_id });

      if (resonse) {
        const { location } = resonse;
        const myLat = latitude;
        const myLng = longitude;
        const port_detail = await Port.findOne({ _id: port_id });

        const lat = location?.coordinates[1] || 0;
        const lng = location?.coordinates[0] || 0;

        const distanceInKm = calculateDistance(myLat, myLng, lat, lng);

        const startMoment = moment(resonse?.start_time, "h:mm A");
        const endMoment = moment(resonse?.end_time, "h:mm A");

        if (!startMoment.isValid() || !endMoment.isValid()) {
          return res
            .status(200)
            .json({ error: "Invalid time format. Please use h:mm A format." });
        } else {
          const slots = generateSlots(startMoment, endMoment, false);

          // const fetch_start_and_end_time = [{start_time : '2:00 PM' , end_time : "5:00 PM"}]
          const currentTime = moment(); // Get the current time
          const currentMoment = moment(currentTime, "h:mm A");

          fetch_start_and_end_time.forEach(({ start_time, end_time }) => {
            // Convert start_time and end_time to moment objects for easier comparison
            const startTime = moment(start_time, "h:mm A");
            const endTime = moment(end_time, "h:mm A");

            // Check if the current time is before the station's end time
            if (currentTime.isBefore(endTime)) {
              // Iterate through each slot and check for overlap
              slots.forEach((slot) => {
                const slotTime = moment(slot.time, "h:mm A");

                // Check if slotTime is between startTime and endTime and is after the current time
                if (
                  slotTime.isBetween(startTime, endTime, null, "[]") &&
                  slotTime.isAfter(currentTime)
                ) {
                  slot.isBooked = true;
                }
              });
            }
          });

          // Filter the slots based on the current time
          const filteredSlots = slots.filter((slot) =>
            moment(slot.time, "h:mm A").isAfter(currentMoment)
          );
          const data = {
            station_detail: {
              ...resonse?.toObject(),
              rating: stationRating?.length > 0 ? stationRating[0]?.avg : 0,
              distance: distanceInKm ? distanceInKm.toFixed(2) : "0",
            },
            port_detail: port_detail,
            slots: filteredSlots,
          };

          res.status(200).json({
            status: true,
            data,
            message: "Station detail fetch successfully.",
          });
        }
      } else {
        res.status(200).json({ status: false, message: "Station not found!" });
      }
    } else {
      const stationRating = await Rating.aggregate([
        { $match: { station_id: station_id } },
        { $sort: { _id: -1 } },
        {
          $group: {
            _id: "$station_id",
            count: { $sum: 1 },
            avg: { $avg: { $toDouble: "$rating" } }, // Convert 'rating' to double for averaging
          },
        },
        {
          $project: {
            _id: 1,
            count: 1,
            avg: { $round: ["$avg", 1] },
          },
        },
      ]).exec();

      const resonse = await Station.findOne({ _id: station_id });

      if (resonse) {
        const port_detail = await Port.findOne({ _id: port_id });
        const { location } = resonse;
        const myLat = latitude;
        const myLng = longitude;

        const lat = location?.coordinates[1] || 0;
        const lng = location?.coordinates[0] || 0;

        const distanceInKm = calculateDistance(myLat, myLng, lat, lng);

        const startMoment = moment(resonse?.start_time, "h:mm A");
        const endMoment = moment(resonse?.end_time, "h:mm A");

        if (!startMoment.isValid() || !endMoment.isValid()) {
          return res
            .status(200)
            .json({ error: "Invalid time format. Please use h:mm A format." });
        } else {
          const slots = generateSlots(startMoment, endMoment, false);

          const currentTime = moment(); // Get the current time

          const currentMoment = moment(currentTime, "h:mm A");

          // Filter the slots based on the current time
          const filteredSlots = slots.filter((slot) =>
            moment(slot.time, "h:mm A").isAfter(currentMoment)
          );
          console.log("filteredSlots", filteredSlots);
          const data = {
            station_detail: {
              ...resonse?.toObject(),
              rating: stationRating?.length > 0 ? stationRating[0]?.avg : 0,
              distance: distanceInKm ? distanceInKm.toFixed(2) : "0",
            },
            port_detail: port_detail,
            slots: filteredSlots,
          };

          res.status(200).json({
            status: true,
            data,
            message: "Station detail fetch successfully.",
          });
        }
      } else {
        res.status(200).json({ status: false, message: "Station not found!" });
      }
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(200).json({ status: false, message: error.message });
  }
};

const portSlotReservation = async (req, res) => {
  try {
    const { start_time, end_time, station_id, port_id } = req.body;

    if (!start_time || !end_time || !station_id || !port_id) {
      return res
        .status(200)
        .json({ status: false, message: "All fields are required." });
    }

    // Fetch booking entries and station information in parallel
    const [fetchBookingEntries, response, port] = await Promise.all([
      Booking.find({
        station_id,
        port_id,
        date: moment(new Date()).format(DATE_FORMATE),
      }),
      Station.findOne({ _id: station_id }),
      Port.findOne({ _id: port_id }),
    ]);

    if (response) {
      if (fetchBookingEntries.length > 0) {
        const fetch_start_and_end_time = fetchBookingEntries.map((item) => ({
          start_time: item.start_time,
          end_time: item.end_time,
        }));

        if (response) {
          const startMoment = moment(response.start_time, "h:mm A");
          const endMoment = moment(response.end_time, "h:mm A");

          if (!startMoment.isValid() || !endMoment.isValid()) {
            return res.status(200).json({
              status: false,
              message: "Invalid time format. Please use h:mm A format.",
            });
          }

          const slots = generateSlots(startMoment, endMoment, false);

          // Use Promise.all to parallelize the slot booking check
          await Promise.all(
            fetch_start_and_end_time.map(({ start_time, end_time }) => {
              const startTime = moment(start_time, "h:mm A");
              const endTime = moment(end_time, "h:mm A");

              slots.forEach((slot) => {
                const slotTime = moment(slot.time, "h:mm A");

                if (slotTime.isBetween(startTime, endTime, null, "[]")) {
                  slot.isBooked = true;
                }
              });
            })
          );

          const isAnySlotBooked = slots.some((slot) => {
            const slotTime = moment(slot.time, "h:mm A");

            // Iterate through each minute within the specified time range
            for (
              let currentTime = moment(start_time, "h:mm A");
              currentTime.isBefore(moment(end_time, "h:mm A"));
              currentTime.add(1, "minutes")
            ) {
              // Check if the slot is booked at the current minute
              if (slotTime.isSame(currentTime, "minute") && slot.isBooked) {
                return true; // Booked slot found at the current minute
              }
            }

            return false; // No booked slots found within the specified time range
          });
          const data = {
            total_amount: hourConvertIntoMinute(
              port?.unit_price || "0.00",
              start_time,
              end_time
            ),
          };

          const statusMessage = isAnySlotBooked
            ? "There are booked slots between the specified start and end times"
            : "Reservation successfully.";

          res
            .status(200)
            .json({ status: !isAnySlotBooked, data, message: statusMessage });
        } else {
          const startMoment = moment(response.start_time, "h:mm A");
          const endMoment = moment(response.end_time, "h:mm A");

          if (!startMoment.isValid() || !endMoment.isValid()) {
            return res.status(200).json({
              status: false,
              message: "Invalid time format. Please use h:mm A format.",
            });
          }

          const slots = generateSlots(startMoment, endMoment, false);

          // Use Promise.all to parallelize the slot booking check
          await Promise.all(
            fetch_start_and_end_time.map(({ start_time, end_time }) => {
              const startTime = moment(start_time, "h:mm A");
              const endTime = moment(end_time, "h:mm A");

              slots.forEach((slot) => {
                const slotTime = moment(slot.time, "h:mm A");

                if (slotTime.isBetween(startTime, endTime, null, "[]")) {
                  slot.isBooked = true;
                }
              });
            })
          );

          const isAnySlotBooked = slots.some((slot) => {
            const slotTime = moment(slot.time, "h:mm A");

            // Iterate through each minute within the specified time range
            for (
              let currentTime = moment(start_time, "h:mm A");
              currentTime.isBefore(moment(end_time, "h:mm A"));
              currentTime.add(1, "minutes")
            ) {
              // Check if the slot is booked at the current minute
              if (slotTime.isSame(currentTime, "minute") && slot.isBooked) {
                return true; // Booked slot found at the current minute
              }
            }

            return false; // No booked slots found within the specified time range
          });

          const data = {
            total_amount: hourConvertIntoMinute(
              port?.unit_price,
              start_time,
              end_time
            ),
          };

          const statusMessage = isAnySlotBooked
            ? "There are booked slots between the specified start and end times"
            : "Reservation successfully.";

          res
            .status(200)
            .json({ status: !isAnySlotBooked, data, message: statusMessage });
        }
      } else {
        const data = {
          total_amount: hourConvertIntoMinute(
            port.unit_price || "0.00",
            start_time,
            end_time
          ),
        };
        res
          .status(200)
          .json({ status: true, data, message: "Reservation successfully." });
      }
    } else {
      res.status(200).json({ status: false, message: "Station not found!" });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(200).json({ status: false, message: error.message });
  }
};

const bookingPort = async (req, res) => {
  try {
    const {
      user_id,
      station_id,
      port_id,
      amount,
      start_time,
      end_time,
      transaction_id,
      account_type,
    } = req.body;
    if (!station_id || !port_id || !amount || !start_time || !end_time) {
      return res
        .status(200)
        .json({ status: false, message: "All fields are required." });
    } else {
      if (account_type == "WL") {
        const findWallet = await Wallet.findOne({ user_id });
        if (findWallet) {
          const wallet_balance = findWallet?.amount
            ? Number(findWallet?.amount)
            : 0.0;
          if (wallet_balance >= Number(amount)) {
            const wallet_balance = Number(findWallet?.amount) - Number(amount);
            const updatedWallet = await Wallet.updateOne(
              { user_id },
              { $set: { amount: wallet_balance } }
            );
            if (updatedWallet) {
              const transaction = await Transaction.create({
                user_id,
                station_id,
                amount,
                credit_or_debit: "DB",
              });
              if (transaction) {
                const bookingSubmit = await Booking.create({
                  user_id,
                  station_id,
                  transaction_id: transaction?.transaction_id,
                  port_id,
                  amount,
                  start_time,
                  end_time,
                  account_type,
                  status: "pending",
                });
                return res.status(200).json({
                  status: true,
                  data: bookingSubmit,
                  message: "Booking submit successfully.",
                });
              } else {
                return res.status(200).json({
                  status: false,
                  message: "Something issue from transaction",
                });
              }
            } else {
              return res
                .status(200)
                .json({ status: false, message: "Wallet transaction issue!" });
            }
          } else {
            return res.status(200).json({
              status: false,
              message: `You have account balance is ${wallet_balance}`,
            });
          }
        } else {
          return res.status(200).json({
            status: false,
            message: `You have account balance is 0.00`,
          });
        }
      } else {
        const findWallet = await Wallet.findOne({ user_id });
        if (findWallet) {
          const creditAmount = Number(findWallet.amount) + Number(amount);
          const updateResult = await Wallet.updateOne(
            { user_id },
            { $set: { amount: creditAmount } }
          );
          if (updateResult) {
            const transaction = await Transaction.create({
              user_id,
              station_id,
              transaction_id,
              amount,
              credit_or_debit: "CR",
            });
            if (transaction) {
              const findWallet = await Wallet.findOne({ user_id });
              const debitAmount = Number(findWallet.amount) - Number(amount);
              const updateResult = await Wallet.updateOne(
                { user_id },
                { $set: { amount: debitAmount } }
              );
              if (updateResult) {
                const transactionDebit = await Transaction.create({
                  user_id,
                  station_id,
                  transaction_id,
                  amount,
                  credit_or_debit: "DB",
                });
                if (transactionDebit) {
                  const bookingSubmit = await Booking.create({
                    user_id,
                    station_id,
                    port_id,
                    amount,
                    start_time,
                    end_time,
                    transaction_id,
                    account_type,
                    status: "pending",
                  });
                  if (bookingSubmit) {
                    return res.status(200).json({
                      status: true,
                      data: bookingSubmit,
                      transaction_id: transactionDebit?.transaction_id,
                      message: "Booking submit successfully.",
                    });
                  } else {
                    return res.status(200).json({
                      status: false,
                      message: "Something issue from booking",
                    });
                  }
                } else {
                  return res.status(200).json({
                    status: false,
                    message: "Something issue in your booking transaction",
                  });
                }
              } else {
                return res.status(200).json({
                  status: false,
                  message: "Something issue from wallet debit for booking",
                });
              }
            } else {
              return res.status(200).json({
                status: false,
                message: "Something issue from transaction",
              });
            }
          } else {
            return res.status(200).json({
              status: false,
              message: "Something issue from wallet credit!",
            });
          }
        } else {
          const credit = await Wallet.create({
            user_id,
            account_type,
            transaction_id,
            amount,
          });
          if (credit) {
            const transaction = await Transaction.create({
              user_id,
              station_id,
              transaction_id,
              station_id,
              amount,
              credit_or_debit: "CR",
            });
            if (transaction) {
              const debitAmount = Number(credit.amount) - Number(amount);
              const updateResult = await Wallet.updateOne(
                { user_id },
                { $set: { amount: debitAmount } }
              );
              if (updateResult) {
                const transactionDebit = await Transaction.create({
                  user_id,
                  station_id,
                  transaction_id,
                  amount,
                  credit_or_debit: "DB",
                });
                if (transactionDebit) {
                  const bookingSubmit = await Booking.create({
                    user_id,
                    station_id,
                    port_id,
                    amount,
                    start_time,
                    end_time,
                    transaction_id,
                    account_type,
                    status: "pending",
                  });
                  if (bookingSubmit) {
                    return res.status(200).json({
                      status: true,
                      data: bookingSubmit,
                      transaction_id: transactionDebit?.transaction_id,
                      message: "Booking submit successfully.",
                    });
                  } else {
                    return res.status(200).json({
                      status: false,
                      message: "Something issue from booking",
                    });
                  }
                } else {
                  return res.status(200).json({
                    status: false,
                    message: "Something issue in your booking transaction",
                  });
                }
              } else {
                return res.status(200).json({
                  status: false,
                  message: "Something issue from wallet debit for booking",
                });
              }
            } else {
              return res.status(200).json({
                status: false,
                message: "Something issue from transaction",
              });
            }
          } else {
            return res
              .status(200)
              .json({ status: true, message: "Something went wrong!" });
          }
        }
      }
    }
  } catch (error) {
    res.status(200).json({ status: false, message: error.message });
  }
};

const wallet = async (req, res) => {
  try {
    const { user_id, account_type, transaction_id, amount } = req.body;

    // Check if all required fields are provided
    if (!user_id || !account_type || !amount) {
      return res.status(400).json({ status: false, message: "All fields are required." });
    }

    // Find if the wallet exists for the user
    let findWallet = await Wallet.findOne({ user_id });

    // If wallet exists, update the amount
    if (findWallet) {
      findWallet.amount = Number(findWallet.amount) + Number(amount);
    } else {
      // If wallet doesn't exist, create a new one
      findWallet = await Wallet.create({
        user_id,
        account_type,
        transaction_id,
        amount,
      });
    }

    // Save the wallet changes
    const updatedWallet = await findWallet.save();

    // Create a transaction record
    const transaction = await Transaction.create({
      user_id,
      transaction_id,
      amount,
      credit_or_debit: "CR",
    });

    // Check if transaction and wallet update were successful
    if (updatedWallet && transaction) {
      return res.status(200).json({
        status: true,
        message: "Credit amount in your wallet successfully.",
      });
    } else {
      return res.status(500).json({
        status: false,
        message: "Something went wrong!",
      });
    }
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};




const transaction = async (req, res) => {
  try {
    const { user_id } = req.body;
    const findWallet = await Wallet.findOne({ user_id });
    const findTransaction = await Transaction.aggregate([
      {
        $match: {
          user_id: user_id,
        },
      },
      {
        $lookup: {
          from: "stations",
          let: { stationId: "$station_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", { $toObjectId: "$$stationId" }],
                },
              },
            },
          ],
          as: "station_detail",
        },
      },
      {
        $unwind: {
          path: "$station_detail",
          preserveNullAndEmptyArrays: true, // Include stations without ratings
        },
      },
    ])
      .sort({ _id: -1 })
      .exec();

    console.log;
    if (findTransaction.length > 0 && findWallet) {
      const data = {
        balance: findWallet?.amount || "0.00",
        transaction: findTransaction,
      };
      res.status(200).json({
        status: true,
        data: data,
        message: "Transaction fetch successfully.",
      });
    } else {
      res
        .status(200)
        .json({ status: false, message: "Transaction not found!" });
    }
  } catch (error) {
    res.status(200).json({ status: false, message: error.message });
  }
};

const transactionSuccessfully = async (req, res) => {
  try {
    const { station_id, port_id, booking_id, start_time, end_time } = req.body;

    if (!station_id || !port_id || !start_time || !end_time) {
      return res
        .status(200)
        .json({ status: false, message: "All fields are required." });
    } else {
      const startMoment = moment(start_time, "h:mm A");
      const endMoment = moment(end_time, "h:mm A");

      if (!startMoment.isValid() || !endMoment.isValid()) {
        return res.status(200).json({
          status: false,
          message: "Invalid time format. Please use h:mm A format.",
        });
      }

      const slots = generateSlots(startMoment, endMoment, false);
      try {
        const [station_detail, port_detail, booking_detail] = await Promise.all(
          [
            Station.findOne({ _id: station_id }),
            Port.findOne({ _id: port_id }),
            Booking.findOne({ _id: booking_id }),
          ]
        );

        if (station_detail && port_detail && booking_detail) {
          const data = {
            station_detail,
            port_detail,
            unit_price: hourConvertIntoMinute(
              port_detail.unit_price,
              start_time,
              end_time
            ),
            transaction_id: booking_detail?.transaction_id,
            unit_allocated: slots?.length - 1,
          };

          return res.status(200).json({
            status: true,
            data,
            message: "Transaction detail fetch successfully.",
          });
        } else {
          return res.status(200).json({
            status: false,
            message: "Station, Port, Booking not found.",
          });
        }
      } catch (error) {
        return res
          .status(200)
          .json({ status: false, message: "Something went wrong!" });
      }
    }
  } catch (error) {
    return res.status(200).json({ status: false, message: error.message });
  }
};

const bookingHistory = async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res
        .status(200)
        .json({ status: false, message: "user_id is required." });
    } else {
      // const bookinghistory = await Booking.find({user_id}).sort({ _id: -1 }).exec()

      const bookinghistory = await Booking.aggregate([
        {
          $match: {
            user_id: user_id,
          },
        },
        {
          $lookup: {
            from: "stations",
            let: { stationId: "$station_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", { $toObjectId: "$$stationId" }],
                  },
                },
              },
            ],
            as: "station_detail",
          },
        },
        {
          $unwind: "$station_detail",
        },
      ]);

      res.status(200).json({
        status: true,
        data: bookinghistory,
        message: "Booking history fetch successfully.",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(200).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

const checkBookings = async () => {
  try {
    const currentDateTime = moment(); // Current date and time
    const startTimeRange = {
      $gte: moment(currentDateTime).format("hh:mm A"), // Start time should be on or after current time
      $lte: moment(currentDateTime).add(30, "minutes").format("hh:mm A") // Start time should be within 30 minutes from current time
    };

    const bookings = await Booking.aggregate([
      {
        $match: {
          start_time: startTimeRange,
          date: moment(new Date()).format(DATE_FORMATE),
        },
      },
      {
        $lookup: {
          from: "stations",
          let: { stationId: "$station_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", { $toObjectId: "$$stationId" }],
                },
              },
            },
          ],
          as: "station_detail",
        },
      },
      {
        $unwind: "$station_detail",
      },
    ]).exec();

    if (bookings.length > 0) {
      bookings.forEach((booking) => {
        if (booking.status === "pending") {
          sendNotification(
            booking?.user_id,
            "Booking alert",
            `You have a booking at ${booking?.station_detail?.station_name} from ${booking.start_time} to ${booking.end_time}.`
          );
        } else {
          console.log(`No notification needed for booking with status: ${booking.status}`);
        }
      });
    } else {
      console.log("No upcoming bookings found for notifications.");
    }
  } catch (error) {
    console.error("Error checking bookings:", error.message);
  }
};

// Schedule the cron job to run every 14 minutes
cron.schedule("*/14 * * * *", () => {
  checkBookings();
});


const stationQrCode = async (req, res) => {
  try {
    const { serial_no } = req.body;
    if (!serial_no) {
      return res
        .status(200)
        .json({ status: false, message: "serial_no is required." });
    } else {
      const station_detail = await Station.findOne({ serial_no });
      if (station_detail) {
        res.status(200).json({
          status: true,
          data: station_detail,
          message: "Station detail fetch successfully.",
        });
      } else {
        res.status(200).json({
          status: false,
          message: "Station not found!",
        });
      }
    }
  } catch (error) {
    console.error(error);
    res.status(200).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

const chargingStart = async (req, res) => {
  try {
    const { user_id, charger_id, connector_id, station_id, port_id } = req.body;
    if (!user_id || !charger_id || !connector_id || !station_id || !port_id) {
      return res
        .status(400)
        .json({ status: false, message: "All fields are required." });
    } else {
      const check_charging_port_status = await Booking.findOne({
        in_progress: true,
        charger_id,
        connector_id,
      });

      if (check_charging_port_status) {
        return res.status(200).json({
          status: false,
          message: "Is the charger already in the process of charging",
        });
      } else {
        const environmentVariables = await EnvironmentVariable.findOne({});
        if (!environmentVariables) {
          return res.status(200).json({
            status: false,
            message:
              "Please set the minimum amount variable and inform the admin.",
          });
        }

        const minimumAmount = parseFloat(
          environmentVariables.minimun_amount_for_charging
        );
        const findWallet = await Wallet.findOne({ user_id });

        if (!findWallet || parseFloat(findWallet.amount) < minimumAmount) {
          return res.status(400).json({
            status: false,
            message: `Insufficient balance. Minimum amount required: ${minimumAmount}`,
          });
        }

        const checkCurrentStatus = await axios.get(
          `http://steve.scriptbees.com/ocpp-server/current-status-of-charger/?chargerID=${charger_id}&connectorID=${connector_id}`
        );



        switch (checkCurrentStatus.data.status) {
          case "Available":
            // Proceed with charging
            // Making Axios request

            const response = await axios.get(
              `http://steve.scriptbees.com/ocpp-server/remote-start/?chargerID=${charger_id}&connectorID=${connector_id}`
            );
            if (response.status === 200) {
              await Booking.create({
                user_id,
                station_id,
                port_id,
                account_type: "WL",
                status: "success",
                in_progress: true,
                charger_id,
                connector_id,
                start_time: moment(new Date()).format('hh:mm A')
              });
              // Success
              res.status(200).json({
                status: true,
                message: "You have started charging.",
              });
            } else {
              // Handle unsuccessful response
              res.status(200).json({
                status: false,
                message: "Failed to fetch wallet data.",
              });
            }
            break;
          case "Preparing":
            res.status(200).json({
              status: false,
              message: "Preparing for charging.",
            });
            break;
          case "Charging":
            res.status(200).json({
              status: false,
              message: "Charging in progress.",
            });
            break;
          case "Finishing":
            res.status(200).json({
              status: false,
              message: "Charging finished.",
            });
            break;
          default:
            res.status(200).json({
              status: false,
              message: "Unknown status.",
              checkCurrentStatus
            });
            break;
        }
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

const chargingStartFromBooking = async (req, res) => {
  try {
    const { user_id, charger_id, connector_id, station_id, port_id, booking_id } = req.body;
    if (!user_id || !charger_id || !connector_id || !station_id || !port_id || !booking_id) {
      return res
        .status(400)
        .json({ status: false, message: "All fields are required." });
    } else {
      const check_charging_port_status = await Booking.findOne({
        in_progress: true,
        charger_id,
        connector_id,
      });

      if (check_charging_port_status) {
        return res.status(200).json({
          status: false,
          message: "Is the charger already in the process of charging",
        });
      } else {
        const booking_check = await Booking.findOne({
          _id: booking_id,
        });
        const environmentVariables = await EnvironmentVariable.findOne({});
        if (!environmentVariables) {
          return res.status(200).json({
            status: false,
            message:
              "Please set the minimum amount variable and inform the admin.",
          });
        }

        const minimumAmount = parseFloat(
          environmentVariables.minimun_amount_for_charging
        );
        const findWallet = await Wallet.findOne({ user_id });

        if (!findWallet || parseFloat(findWallet.amount) < minimumAmount) {
          return res.status(200).json({
            status: false,
            message: `Insufficient balance. Minimum amount required: ${minimumAmount}`,
          });
        }

        // temportry start 
        // await Booking.findOneAndUpdate(
        //   { _id: booking_id },
        //   {
        //     $set: {
        //       in_progress: true,
        //       status: "booking",
        //       charger_id,
        //       connector_id
        //     },
        //   },
        //   { new: true }
        // );

        //   return res.status(200).json({
        //     status: false,
        //     message:
        //       "Please set the minimum amount variable and inform the admin.",
        //   });

        // temprarty start

        const checkCurrentStatus = await axios.get(
          `http://steve.scriptbees.com/ocpp-server/current-status-of-charger/?chargerID=${charger_id}&connectorID=${connector_id}`
        );



        switch (checkCurrentStatus.data.status) {
          case "Available":
            // Proceed with charging
            // Making Axios request

            const response = await axios.get(
              `http://steve.scriptbees.com/ocpp-server/remote-start/?chargerID=${charger_id}&connectorID=${connector_id}`
            );
            if (response.status === 200) {


              await Booking.findOneAndUpdate(
                { _id: booking_id },
                {
                  $set: {
                    in_progress: true,
                    status: "booking",
                    charger_id,
                    connector_id,
                    start_time: moment(new Date()).format('hh:mm A')
                  },
                },
                { new: true }
              );

              res.status(200).json({
                status: true,
                message: "You have started charging.",
              });
            } else {
              // Handle unsuccessful response
              res.status(200).json({
                status: false,
                message: "Failed to fetch wallet data.",
              });
            }
            break;
          case "Preparing":
            res.status(200).json({
              status: false,
              message: "Preparing for charging.",
            });
            break;
          case "Charging":
            res.status(200).json({
              status: false,
              message: "Charging in progress.",
            });
            break;
          case "Finishing":
            res.status(200).json({
              status: false,
              message: "Charging finished.",
            });
            break;
          default:
            res.status(200).json({
              status: false,
              message: "Unknown status.",
              checkCurrentStatus
            });
            break;
        }
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

const chargingStop = async (req, res) => {
  try {
    const { charger_id, connector_id } = req.body;
    if (!charger_id || !connector_id) {
      return res.status(200).json({
        status: false,
        message: "charger_id and connector_id are required.",
      });
    }

    const check_charging_status = await Booking.findOne({
      charger_id,
      connector_id,
      in_progress: true,
    });

    if (!check_charging_status) {
      return res.status(200).json({
        status: false,
        message: "Charger and connector aren't being used for charging, so you can't stop it.",
      });
    }

    const port_data = await Port.findOne({
      _id: check_charging_status?.port_id,
    });

    let currentValues;
    let chargingStop;
    try {
      currentValues = await axios.get(
        `http://steve.scriptbees.com/ocpp-server/charging-values/?chargerID=${'charz-test-1'}&connectorID=${connector_id}`
      );
      chargingStop = await axios.get(
        `http://steve.scriptbees.com/ocpp-server/remote-stop/?chargerID=${'charz-test-1'}&transactionID=${currentValues?.data.payload?.transactionId}`
      );
    } catch (axiosError) {
      return res.status(200).json({
        status: false,
        message: "Error stopping the charging process.",
      });
    }


    if (check_charging_status?.status == 'booking') {
      const end_time = moment(new Date());
      const findWallet = await Wallet.findOne({ user_id: check_charging_status?.user_id });
      let walletBalance = parseFloat(findWallet?.amount)
      const advanceDebit = parseFloat(check_charging_status?.amount);  // Assuming advance debit amount
      const sumAmount = advanceDebit + walletBalance
      const currentAmountCharging = hourConvertIntoMinute(
        port_data?.unit_price,
        check_charging_status?.start_time,
        end_time.format('hh:mm A')
      );



      if (advanceDebit > currentAmountCharging) {
        walletBalance = walletBalance + (advanceDebit - currentAmountCharging);
        console.log(`The shopkeeper will return ${advanceDebit - currentAmountCharging} rupees to you.`);
        await Wallet.updateOne(
          { user_id: check_charging_status?.user_id },
          { $set: { amount: walletBalance } }
        );
        await Transaction.create({
          user_id: check_charging_status?.user_id,
          station_id: check_charging_status?.station_id,
          amount: advanceDebit - currentAmountCharging,
          credit_or_debit: "CR",
        });
      } else if (advanceDebit < currentAmountCharging) {
        walletBalance = walletBalance - (currentAmountCharging - advanceDebit);
        await Wallet.updateOne(
          { user_id: check_charging_status?.user_id },
          { $set: { amount: walletBalance } }
        );
        await Transaction.findOneAndUpdate(
          { transaction_id: check_charging_status?.transaction_id || '' },
          {
            $set: {
              amount: currentAmountCharging - advanceDebit
            },
          },
          { new: true }
        );

        console.log(`You need to pay an additional ${currentAmountCharging - advanceDebit} rupee(s) to the shopkeeper.`);
      } else {
        console.log("No refund or extra payment needed.");
      }

      const updatedBooking = await Booking.findOneAndUpdate(
        { charger_id, connector_id, in_progress: true },
        {
          $set: {
            in_progress: false,
            status: "completed",
            end_time: end_time.format('hh:mm A'),
            transaction_id: currentValues?.data.payload?.transactionId || '',
            amount: hourConvertIntoMinute(
              port_data?.unit_price,
              check_charging_status?.start_time,
              end_time.format('hh:mm A')
            ),
          },
        },
        { new: true }
      );

      sendNotification(
        check_charging_status?.user_id,
        "Charging stopped",
        `I have stopped your charging at ${port_data?.port_name}. Your total cost is ${hourConvertIntoMinute(
          port_data?.unit_price,
          check_charging_status?.start_time,
          end_time.format('hh:mm A')
        )} INR including GST.`
      );

      if (updatedBooking) {
        res.status(200).json({
          status: true,
          message: "We have stopped your charging.",
        });
      } else {
        res.status(200).json({
          status: false,
          message: "We can't update your status. There's an issue with this record.",
        });
      }
    } else {
      const findWallet = await Wallet.findOne({ user_id: check_charging_status?.user_id });
      const end_time = moment(new Date());
      const amount = hourConvertIntoMinute(
        port_data?.unit_price,
        check_charging_status?.start_time,
        end_time.format('hh:mm A')
      );

      const wallet_balance = Number(findWallet?.amount) - amount;

      await Wallet.updateOne(
        { user_id: check_charging_status?.user_id },
        { $set: { amount: wallet_balance } }
      );

      await Transaction.create({
        user_id: check_charging_status?.user_id,
        station_id: check_charging_status?.station_id,
        amount: hourConvertIntoMinute(
          port_data?.unit_price,
          check_charging_status?.start_time,
          end_time.format('hh:mm A')
        ),
        credit_or_debit: "DB",
      });

      const updatedBooking = await Booking.findOneAndUpdate(
        { charger_id, connector_id, in_progress: true },
        {
          $set: {
            in_progress: false,
            status: "completed",
            end_time: end_time.format('hh:mm A'),
            transaction_id: currentValues?.data.payload?.transactionId || '',
            amount: hourConvertIntoMinute(
              port_data?.unit_price,
              check_charging_status?.start_time,
              end_time.format('hh:mm A')
            ),
          },
        },
        { new: true }
      );

      sendNotification(
        check_charging_status?.user_id,
        "Charging stopped",
        `I have stopped your charging at ${port_data?.port_name}. Your total cost is ${hourConvertIntoMinute(
          port_data?.unit_price,
          check_charging_status?.start_time,
          end_time.format('hh:mm A')
        )} INR including GST.`
      );

      if (updatedBooking) {
        res.status(200).json({
          status: true,
          message: "We have stopped your charging.",
        });
      } else {
        res.status(200).json({
          status: false,
          message: "We can't update your status. There's an issue with this record.",
        });
      }
    }


  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};


const chargingValues = async (req, res) => {
  try {
    const { charger_id, connector_id } = req.body;

    // Validate input
    if (!charger_id || !connector_id) {
      return res.status(200).json({
        status: false,
        message: "All fields are required",
      });
    }

    // Check charging status
    const check_charging_status = await Booking.findOne({
      charger_id,
      connector_id,
      in_progress: true,
    });

    if (!check_charging_status) {
      return res.status(200).json({
        status: false,
        message: "Charging status not found",
      });
    } else {
      // Find port details
      const find_port = await Port.findOne({
        _id: check_charging_status?.port_id,
      });

      if (!find_port) {
        return res.status(200).json({
          status: false,
          message: "Port not found",
        });
      }

      // Fetch charging values from external server
      const response = await axios.get(
        `http://steve.scriptbees.com/ocpp-server/charging-values/?chargerID=charz-test-1&connectorID=${connector_id}`
      );
      if (response?.data?.payload) {
        console.log('response', response)

        const meterValue = response?.data?.payload?.meterValue;

        // Extract necessary values
        const units = meterValue?.[0]?.sampledValue?.[0] || {};
        const percentage = meterValue?.[0]?.sampledValue?.[3] || {};
        const total_cost = hourConvertIntoMinute(
          find_port.unit_price,
          check_charging_status?.start_time,
          moment(new Date()).format("hh:mm A")
        );

        // Prepare data
        const data = { units, percentage, total_cost };

        // Respond with the data
        return res.status(200).json({
          status: true,
          response: data,
          message: "Charging values retrieved successfully",
        });
      } else {
        return res.status(200).json({
          status: false,
          message: response?.data?.message,
        });
      }

    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};


const fetchNotification = async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res
        .status(200)
        .json({ status: false, message: "user_id is required." });
    } else {
      const notification_detail = await Notification.find({ user_id })
        .sort({ _id: -1 })
        .exec();
      res.status(200).json({
        status: true,
        data: notification_detail,
        message: "Notification fetch successfully.",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(200).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

const readNotification = async (req, res) => {
  try {
    const { _id, user_id, read_all } = req.body;
    if (read_all) {
      const updateManyResult = await Notification.updateMany(
        { user_id },
        { $set: { read: true } }
      );
      if (updateManyResult) {
        res
          .status(200)
          .json({ status: true, message: "Notification read successfully." });
      } else {
        res
          .status(200)
          .json({ status: false, message: "Something went wrong!" });
      }
    } else {
      const readOne = await Notification.updateOne(
        { _id },
        { $set: { read: true } }
      );
      if (readOne) {
        res
          .status(200)
          .json({ status: true, message: "Notification read successfully." });
      } else {
        res
          .status(200)
          .json({ status: false, message: "Something went wrong!" });
      }
    }
  } catch (error) {
    console.error(error);
    res.status(200).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};

function removeDuplicatesAndFilter(array, currentTime) {
  const timeOccurrences = new Map();

  // Count occurrences of each time
  array.forEach((obj) => {
    const { time } = obj;
    const key = time;
    const count = timeOccurrences.get(key) || 0;
    timeOccurrences.set(key, count + 1);
  });

  // Filter objects based on occurrences and greater than current time
  const uniqueObjects = array.filter((obj) => {
    const { time } = obj;
    const key = time;
    return (
      timeOccurrences.get(key) === 1 &&
      moment(time, "h:mm A").isAfter(moment(currentTime, "h:mm A"))
    );
  });

  return uniqueObjects;
}

function generateSlots(startMoment, endMoment, isBooked) {
  const slots = [];
  let currentSlot = startMoment.clone();

  while (currentSlot.isSameOrBefore(endMoment)) {
    slots.push({ time: currentSlot.format("h:mm A"), isBooked: isBooked });
    currentSlot.add(0.5, "hours");
  }

  return slots;
}

function hourConvertIntoMinute(per_min_unit, start_time, end_time) {
  // Convert start_time and end_time to moment objects
  const startTime = moment(start_time, "h:mm A");
  const endTime = moment(end_time, "h:mm A");

  // Calculate the time difference in minutes
  const timeDifferenceInMinutes = endTime.diff(startTime, "minutes");

  // Ensure the time difference is non-negative
  const validTimeDifference = Math.max(timeDifferenceInMinutes, 0);

  // Calculate the cost
  const cost = (validTimeDifference / 60) * per_min_unit; // Convert minutes to hours

  return cost;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers

  return distance;
}

module.exports = {
  dashboardStations,
  stationDetail,
  searchStation,
  sendStationReview,
  portSlots,
  portSlotReservation,
  bookingPort,
  wallet,
  transaction,
  transactionSuccessfully,
  bookingHistory,
  stationQrCode,
  chargingStart,
  chargingStop,
  chargingStartFromBooking,
  chargingValues,
  fetchNotification,
  readNotification,
};
