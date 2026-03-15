// controllers/labCon.js
const Lab  = require('../models/lab');

exports.getDashboard = async (req, res) => {
    try {
        // Load labs from database
        const laboratories = await Lab.find().lean();

        // Build today's local ISO date to pass to rooms links
        const now      = new Date()
        const todayISO = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

        res.render('index', {
            title: "Dashboard",
            laboratories,
            todayISO
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading dashboard");
    }
};
