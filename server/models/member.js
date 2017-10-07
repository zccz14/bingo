const mongoose = require('mongoose');

const Member = mongoose.model('Member', {
    name: String,
    abbr: String,
    gender: String,
    birthday: Date,
    tel: String,
    number: String,
    balance: Number,
    isStaff: Boolean
});

module.exports = Member;