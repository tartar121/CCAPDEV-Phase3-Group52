// controllers/labCon.js
const User = require('../models/user');

exports.getDashboard = async (req, res) => {
    try {
        // Fetch all users except admin
        let users = await User.find({ email: { $ne: 'admin@dlsu.edu.ph' } }).lean();
        
        // Add roles based on email format
        const usersWithRoles = users.map(u => ({
            ...u,
            role: u.email.includes('_') ? 'STUDENT' : 'FACULTY'
        }));

        // Define your labs
        const labs = [
            { name: "Gokongwei 302" }, { name: "Gokongwei 306" },
            { name: "Velasco 211" }, { name: "Henry Sy 4th Floor" },
            { name: "Andrew 1401" }
        ];
        
        // Render the index page
        res.render('index', { 
            title: "Dashboard", 
            users: usersWithRoles, 
            laboratories: labs
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading dashboard");
    }
};
