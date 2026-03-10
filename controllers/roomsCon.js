// controllers/roomsCon.js
const Reservation = require('../models/reservation');

// Helper: Formats time (e.g., 450 -> 7:30 AM)
function formatTime(m) {
    let h = Math.floor(m / 60), mm = m % 60;
    return `${h > 12 ? h - 12 : h}:${String(mm).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

exports.getAvailability = async (req, res) => {
    try {
        const labName = req.query.lab || "Gokongwei 302";
        const startDate = new Date(req.query.date || new Date());
        
        // Generate 7 days for the schedule grid
        let days = [];
        for (let i = 0; i <= 7; i++) {
            let d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            days.push(d.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' }));
        }
        const reservations = await Reservation.find({ room: labName }).lean();

        // Timeslot grid
        let timeslots = [];
        for (let t = 450, sIdx = 0; t < 1050; t += 30, sIdx++) {
            let timeLabel = `${formatTime(t)} - ${formatTime(t + 30)}`;
            let dayCells = days.map(d => {
                const res = reservations.find(r => r.date === d && r.slotTime === timeLabel);
                return {
                    date: d,
                    slotIndex: sIdx,
                    reserved: !!res,
                    isFaculty: res?.userRole === 'teacher',
                    isCheckedIn: res?.checkedIn
                };
            });
            timeslots.push({ timeLabel, dayCells });
        }
        res.render('rooms', { title: "Reservation", labName, days, timeslots });
    } catch (err) { res.status(500).send("Error loading room availability."); }
};
