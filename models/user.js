// models/user.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role:     { type: String, enum: ['student', 'faculty', 'technician'], default: 'student' },
    bio:      { type: String, default: "Loves technology and labs." },
    photo:    { type: String }
});

module.exports = mongoose.model('User', userSchema);
