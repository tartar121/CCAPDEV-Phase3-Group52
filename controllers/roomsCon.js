// controllers/roomsCon.js
const Reservation = require('../models/reservation');

// Date Handling now uses ISO YYYY-MM-DD
// Formats minutes-since-midnight -> "7:30 AM"
function formatTime(m) {
    let h = Math.floor(m / 60), mm = m % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${String(mm).padStart(2, '0')} ${period}`;
}

// Offset a YYYY-MM-DD string by N days
function offsetDate(isoStr, days) {
    const d = new Date(isoStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

// For example: "2025-03-16" → "Sun, Mar 16"
function prettyDate(isoStr) {
    const d = new Date(isoStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// 
exports.getAvailability = async (req, res) => {
    try {
        const labName = req.query.lab || "Gokongwei 302";

        // Base date: use query param if provided, otherwise today — always as YYYY-MM-DD
        let baseISO = req.query.date || new Date().toISOString().split('T')[0];

        // Build 7-day window as ISO strings (consistent with what's stored in DB)
        const isoDays = [];
        for (let i = 0; i < 7; i++) {
            isoDays.push(offsetDate(baseISO, i));
        }

        // Fetch reservations for this lab across the whole week, populate user name
        const reservations = await Reservation.find({
            room: labName,
            date: { $in: isoDays }
        }).populate('user', 'name email role').lean();

        // Build timeslot grid  (7:30 AM – 5:00 PM in 30-min blocks)
        const timeslots = [];
        let slotIdx = 0;
        for (let t = 450; t < 1050; t += 30, slotIdx++) {
            const timeLabel = `${formatTime(t)} - ${formatTime(t + 30)}`;

            const dayCells = isoDays.map((iso, i) => {
                const res = reservations.find(
                    r => r.date === iso && r.slotTime === timeLabel
                );
                return {
                    isoDate:    iso,
                    prettyDate: prettyDate(iso),
                    dayIndex:   i,
                    slotIndex:  slotIdx,
                    reserved:   !!res,
                    isFaculty:  res?.userRole === 'faculty',
                    isCheckedIn: res?.checkedIn || false,
                    reservationId: res?._id || null,
                    // Only expose the reservee name if the reservation is not anonymous
                    reserveeName: (res && !res.isAnonymous && res.user) ? res.user.name : null
                };
            });

            timeslots.push({ timeLabel, dayCells });
        }

        // Labels for the header row
        const prettyDays = isoDays.map(prettyDate);

        res.render('rooms', {
            title:   "Reservation",
            labName,
            days:    prettyDays,
            isoDays,
            timeslots,
            baseISO,
            isTechnician: req.session.currentUser?.role === 'technician'
        });
    } catch(err) { 
        console.error("roomsCon error:", err);
        res.status(500).send("Error loading room availability."); 
    }
};
