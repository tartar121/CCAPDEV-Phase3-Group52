// models/reservation.js
const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
    room: String,
    date: String,
    slotIndex: Number,
    slotTime: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isAnonymous: { type: Boolean, default: false },
    checkedIn: { type: Boolean, default: false },
    userRole: String
});

module.exports = mongoose.model('Reservation', reservationSchema);
