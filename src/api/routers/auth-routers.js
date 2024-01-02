const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const Users = require('../models/auth/users');
const AuthMiddleware = require('../middlewares/authMiddleware');
const tokenSecretKey = process.env.TOKEN_SECRET_KEY || 'defaultSecretKey';


const router = express.Router();
const upload = multer().none();
// Destination folder
const destinationFolder = './uploads/users/';

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

const upload_single = multer({ storage }).single('profile_image');

router.post("/register", upload, async (req, res) => {
    try {
        const { name, phone, email , social_id } = req.body;

        if (!name || !phone) {
            return res.status(200).json({ status: false, message: 'All fields are required' });
        }

        const existingPhoneUser = await Users.findOne({ phone });
        const existingEmailUser = await Users.findOne({ email });

        if (existingPhoneUser) {
            return res.status(200).json({ status: false, message: 'Phone number already exists' });
        } else if (existingEmailUser) {
            return res.status(200).json({ status: false, message: 'Email already exists' });
        }else{
            const user = await Users.create({ name, phone, email });
            // const token = jwt.sign({ userId: user._id }, tokenSecretKey, { expiresIn: '1h' });
            res.status(200).json({ status: true, data: user,  message: 'User registered successfully' });
        }
    } catch (error) {
        console.error(error);
        res.status(200).json({ status: false, message: error.message });
    }
});

router.post("/register_social_account", upload, async (req, res) => {
    try {
        const { social_id , name , phone, email } = req.body;

        if (!social_id) {
            return res.status(200).json({ status: false, message: 'social_id is required' });
        }else{
            const user = await Users.findOne({ social_id });

            if (user) {
                return res.status(200).json({ status: false, message: 'This account already registered.' });
            }else{
                const user = await Users.create({ name , phone, email , social_id });
                return res.status(200).json({ status: true, data : user, message: 'User registered successfully' });
            }
        }
    } catch (error) {
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});

router.post("/social_login", upload, async (req, res) => {
    try {
        const { social_id , name , phone, email } = req.body;

        if (!social_id) {
            return res.status(200).json({ status: false, message: 'social_id is required' });
        }else{
            const user = await Users.findOne({ social_id });
            if (user) {
                return res.status(200).json({ status: true, data : user, message: 'Login successfully.' });
            }else{
                res.status(200).json({ status: false, message: 'User not found!' });
            }
        }
    } catch (error) {
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});

router.post("/login", upload, async (req, res) => {
    try {
        const { phone } = req.body;
        const randomFourDigitNumber = Math.floor(Math.random() * 9000) + 1000;
        const user = await Users.findOne({ phone });

        if (!user) {
            return res.status(200).json({ status: false, message: 'User not found' });
        }else{
            if(user?.status == 'active'){
                res.status(200).json({ status: true, data: user, OTP: randomFourDigitNumber, message: 'Login successfully.' });
            }else{
                res.status(200).json({ status: false, message: 'Your account has been suspended' });
            }
        }
    } catch (error) {
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});

router.post("/fetch_profile", upload, async (req, res) => {
    try {
        const { _id } = req.body;
        if (!_id) {
            return res.status(404).json({ status: false, message: '_id is required' });
        }else{
            const user = await Users.findOne({ _id });
            if (!user) {
                return res.status(200).json({ status: false, message: 'User not found' });
            }else{
                res.status(200).json({ status: true, data: user, message: 'Profile fetch successfully.' });
            }
        }
        
    } catch (error) {
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
});

router.post("/registration_otp_verfication", upload, async (req, res) => {
    try {
        const randomFourDigitNumber = Math.floor(Math.random() * 9000) + 1000;
        const { phone } = req.body;
        if (!phone) {
            return res.status(200).json({ status: false, message: 'Phone number is required' });
        } else if (await Users.findOne({ phone })) {
            return res.status(200).json({ status: false, message: 'Phone number already exists' });
        } else {
            return res.status(200).json({ status: true, data: { OTP: randomFourDigitNumber }, message: 'We have sent an OTP to your number.' });
        }
    } catch (error) {
        res.status(200).json({ status: false, message: error.message });
    }
});

router.post("/edit_profile", AuthMiddleware, upload_single, async (req, res) => {
    try {

        const { _id, name, bike_mode, profile_image, phone } = req.body;
        if (!_id) {
            return res.status(200).json({ status: false, message: '_id is required' });
        }
        const user = await Users.findOne({ _id });
        if (!user) {
            return res.status(200).json({ status: false, message: 'User not found' });
        }else{

            user.name = name || user.name;
            user.bike_mode = bike_mode || user.bike_mode;
            user.phone = phone || user.phone;
    
            if (req.file) {
                user.profile_image = req.file.filename;
            }
    
            const updatedUser = await user.save();
    
            res.status(200).json({ status: true, data: updatedUser, message: 'Profile updated successfully' });
        }


    } catch (error) {
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(200).json({ status: false, message: error.message });
    }
});




module.exports = router;
