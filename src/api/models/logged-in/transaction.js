const mongoose = require('mongoose');
const moment = require('moment');
const { DATE_FORMATE } = require('../../../utils/urls');

const transactionSchema = new mongoose.Schema({
    user_id: {
        type: String,
        trim: true,
    },
    credit_or_debit: {
        type: String,
        trim: true,
        default: null,
    },
    transaction_id: {
        type: String,
        trim: true,
        default: null,
    },
    amount: {
        type: String,
        trim: true,
        default: null,
    },
    date: {
        type: String,
        trim: true,
        default: moment(new Date()).format(DATE_FORMATE) + ' ' + moment(new Date()).format('hh:mm A') ,
    },
});

const Transaction = mongoose.model('transaction', transactionSchema);

module.exports = Transaction;
