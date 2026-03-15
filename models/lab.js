// models/lab.js
const mongoose = require('mongoose')

const seatSchema = new mongoose.Schema({
  seatNumber: { type: String, required: true }
})

const labSchema = new mongoose.Schema({
  name:     { type: String },          // name e.g. "Gokongwei 302"
  labCode:  { type: String, required: true, unique: true },  // e.g. "GK302"
  building: { type: String, required: true },
  capacity: { type: Number },
  floor:    { type: String },
  seats:    [seatSchema]               // embedded seat docs
})

module.exports = mongoose.model('Lab', labSchema)
