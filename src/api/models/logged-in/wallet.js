const mongoose = require('mongoose');
const moment = require('moment');
const { DATE_FORMATE } = require('../../../utils/urls');

const creditWalletSchema = new mongoose.Schema({
    user_id: {
        type: String,
        trim: true,
    },
    account_type: {
        type: String,
        trim: true,
        default: null,
    },
    amount: {
        type: String,
        trim: true,
        default: null,
    },
});

const Wallet = mongoose.model('wallets', creditWalletSchema);

module.exports = Wallet;
