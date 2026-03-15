// models/reservation.js
const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    lab: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lab',
      required: true
    },
    labCode: { type: String },

    // seatNumber stored as array e.g. [3, 4] or single [5]
    seatNumber: { type: mongoose.Schema.Types.Mixed, required: true },

    // date stored as locale string e.g. "Mar 16, 2026"
    date: { type: String, required: true },

    // timeSlot is JSON-stringified array e.g. '["08:00 AM","08:30 AM"]'
    timeSlot: { type: String },

    // Readable range e.g. "08:00 AM - 09:30 AM"
    timeRange: { type: String },

    // Raw array of 30-min slot labels
    slotsArray: { type: [String] },

    isAnonymous: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ['Active', 'Cancelled', 'Completed'],
      default: 'Active'
    },

    userRole: { type: String }
  },
  { timestamps: true }
)

module.exports = mongoose.model('Reservation', reservationSchema);
