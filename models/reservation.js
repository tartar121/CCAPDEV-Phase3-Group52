// models/reservation.js
const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
    room:        { type: String, required: true },
    date:        { type: String, required: true },   // stored as YYYY-MM-DD
    slotIndex:   { type: Number, required: true },
    slotTime:    { type: String, required: true },
    user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isAnonymous: { type: Boolean, default: false },
    checkedIn:   { type: Boolean, default: false },
    userRole:    { type: String }                    // 'student' | 'faculty' | 'technician'
});

module.exports = mongoose.model('Reservation', reservationSchema);
