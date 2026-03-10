// model/user.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    bio: { type: String, default: "Loves technology and labs." },
    photo: { type: String }
});
// At the bottom of model/user.js
module.exports = mongoose.model('User', userSchema);
