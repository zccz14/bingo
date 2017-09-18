const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Order = mongoose.model('Order', {
    memberId: Schema.Types.ObjectId,
    details: [{
        name: String,
        price: Number,
        amount: Number
    }],
    total: Number,
    status: String,
    note: String
});

module.exports = Order;