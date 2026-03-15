// controllers/profileCon.js
const User = require('../models/user');
const Reservation = require('../models/reservation');

// Get profile details for the logged-in user or another user
exports.getProfile = async (req, res) => {
    try {
        const targetEmail = req.params.email || req.session.currentUser.email;
        const profileUser = await User.findOne({ email: targetEmail }).lean();
        
        if (!profileUser) return res.status(404).send("User not found");

        // Logic: Use custom photo if it exists, otherwise fallback to UI Avatars
        const photoUrl = profileUser.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileUser.name)}&background=2e8b57&color=fff`;

        const reservations = await Reservation.find({ user: profileUser._id }).lean();
        const isSelf = (targetEmail === req.session.currentUser.email);

        res.render('profile', { 
            title: `${profileUser.name}'s Profile`, 
            // Send the calculated photoUrl to the view
            profileUser: { ...profileUser, photoUrl }, 
            reservations, 
            isSelf 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading profile");
    }
};

// Handle updating the bio
exports.updateBio = async (req, res) => {
    try {
        const { bio } = req.body;
        await User.updateOne({ email: req.session.currentUser.email }, { bio });
        res.status(200).send("Bio updated");
    } catch (err) {
        res.status(500).send("Error updating bio");
    }
};

// Handle updating the photo via url
exports.updatePhoto = async (req, res) => {
    try {
        const { photo } = req.body;
        await User.updateOne({ email: req.session.currentUser.email }, { photo });
        res.status(200).send("Photo updated");
    } catch (err) {
        res.status(500).send("Error updating photo");
    }
};

// Handle account deletion
exports.deleteAccount = async (req, res) => {
    try {
        const userId = req.session.currentUser._id;
        const email = req.session.currentUser.email;
        await Reservation.deleteMany({ user: userId });
        await User.deleteOne({ email });
        req.session.destroy(() => res.redirect('/login'));
    } catch (err) {
        console.error(err);
        res.status(500).send("Error deleting account");
    }
};
