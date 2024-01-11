const Users = require('../../models/auth/users');

// object id

const ObjectId = require('mongodb').ObjectId;

// moment

const moment = require('moment')

// helper function 

const { delete_file } = require('../../../utils/helpers');


const register = async (req, res) => {
    try {
        const { name, phone, email, country_code_id } = req.body;

        if (!name || !phone) {
            return res.status(200).json({ status: false, message: 'All fields are required' });
        }

        const existingPhoneUser = await Users.findOne({ phone });
        const existingEmailUser = await Users.findOne({ email });

        if (existingPhoneUser) {
            return res.status(200).json({ status: false, message: 'Phone number already exists' });
        } else if (existingEmailUser) {
            return res.status(200).json({ status: false, message: 'Email already exists' });
        } else {
            const user = await Users.create({ name, country_code_id, phone, email });
            // const token = jwt.sign({ userId: user._id }, tokenSecretKey, { expiresIn: '1h' });
            res.status(200).json({ status: true, data: user, message: 'User registered successfully' });
        }
    } catch (error) {
        console.error(error);
        res.status(200).json({ status: false, message: error.message });
    }
}

const registerSocialAccount = async (req, res) => {
    try {
        const { social_id, name, phone, email } = req.body;

        if (!social_id) {
            return res.status(200).json({ status: false, message: 'social_id is required' });
        } else {
            const user = await Users.findOne({ social_id });

            if (user) {
                return res.status(200).json({ status: false, message: 'This account already registered.' });
            } else {
                const user = await Users.create({ name, phone, email, social_id });
                return res.status(200).json({ status: true, data: user, message: 'User registered successfully' });
            }
        }
    } catch (error) {
        res.status(200).json({ status: false, message: 'Internal Server Error' });
    }
}

const socialLogin = async (req, res) => {
    try {
        const { social_id, name, phone, email } = req.body;

        if (!social_id) {
            return res.status(200).json({ status: false, message: 'social_id is required' });
        } else {
            const user = await Users.findOne({ social_id });
            if (user) {
                return res.status(200).json({ status: true, data: user, message: 'Login successfully.' });
            } else {
                res.status(200).json({ status: false, message: 'User not found!' });
            }
        }
    } catch (error) {
        res.status(200).json({ status: false, message: 'Internal Server Error' });
    }
}

const login = async (req, res) => {
    try {
        const { country_code_id , phone } = req.body;
        const randomFourDigitNumber = Math.floor(Math.random() * 9000) + 1000;

        if(!country_code_id|| !phone){
            res.status(200).json({ status: false, message: 'country_code_id and phone is required' });
        }else{   
            const user = await Users.findOne({ country_code_id , phone });
            
            if (!user) {
                return res.status(200).json({ status: false, message: 'User not found' });
            } else {
                if (user?.status == 'active') {
                    res.status(200).json({ status: true, data: user, OTP: randomFourDigitNumber, message: 'Login successfully.' });
                } else {
                    res.status(200).json({ status: false, message: 'Your account has been suspended' });
                }
            }
        }
    } catch (error) {
        res.status(200).json({ status: false, message: 'Internal Server Error' });
    }
}

const fetchProfile = async (req, res) => {
    try {
        const { _id } = req.body;
        if (!_id) {
            return res.status(200).json({ status: false, message: '_id is required' });
        } else {
            const user = await Users.findOne({ _id });
            if (!user) {
                return res.status(200).json({ status: false, message: 'User not found' });
            } else {
                res.status(200).json({ status: true, data: user, message: 'Profile fetch successfully.' });
            }
        }

    } catch (error) {
        res.status(200).json({ status: false, message: 'Internal Server Error' });
    }
}

const registrationOtpVerfication = async (req, res) => {
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
}

const editProfile = async (req, res) => {
    try {

        const { _id, name, bike_mode, phone , country_code_id } = req.body;
        if (!_id) {
            return res.status(200).json({ status: false, message: '_id is required' });
        }
        const user = await Users.findOne({ _id });
        if (!user) {
            return res.status(200).json({ status: false, message: 'User not found' });
        } else {

            const existingUsers = await Users.findOne({
                $and: [
                    { _id: { $ne: _id } }, // Exclude the current record
                    { $or: [{ phone }] }
                ]
            });

            if (existingUsers) {
                return res.status(200).json({
                    status: false,
                    message: 'email or phone no is already exist'
                });
            } else {
                user.name = name || user.name;
                user.bike_mode = bike_mode || user.bike_mode;
                user.phone = phone || user.phone;
                user.country_code_id = country_code_id || user.country_code_id;

                if (req.file) {
                    delete_file('/uploads/users/' , user.profile_image)
                    user.profile_image = req.file.filename;
                }

                const updatedUser = await user.save();
                if (updatedUser) {
                    res.status(200).json({ status: true, data: updatedUser, message: 'Profile updated successfully' });
                } else {
                    res.status(200).json({ status: false, message: 'Something went wrong!' });
                }

            }
        }


    } catch (error) {
        res.status(200).json({ status: false, message: error.message });
    }
}

module.exports = {
    register,
    registerSocialAccount,
    socialLogin,
    login,
    fetchProfile,
    registrationOtpVerfication,
    editProfile
};