const express = require('express');
const multer = require('multer');
const router = express.Router();
const upload = multer().none();

// controllers
const { 
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
    fetchNotification,
    readNotification
 } = require('../controllers/logged-in');

// Stations 
router.post("/dashboard_stations", upload, dashboardStations);
router.post("/station_detail", upload, stationDetail);
router.post("/search_station", upload, searchStation);
router.post("/station_qr_code", upload,  stationQrCode);
router.post("/send_station_review", upload, sendStationReview);

// Port slots
router.post("/port_slots", upload, portSlots);
router.post("/port_slot_reservation", upload, portSlotReservation);
router.post("/booking_port", upload, bookingPort);

// Wallet
router.post("/wallet", upload, wallet);
router.post("/transaction", upload, transaction)
router.post("/transaction_successfully", upload, transactionSuccessfully);

// booking history
router.post("/booking_history", upload,  bookingHistory);

// notification
router.post("/fetch_notification", upload,  fetchNotification);
router.post("/read_notification", upload,  readNotification);

module.exports = router;