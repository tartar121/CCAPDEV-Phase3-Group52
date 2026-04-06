// controllers/roomsCon.js
const Reservation = require('../models/reservation')
const Lab         = require('../models/lab')

// Date Handling uses ISO YYYY-MM-DD
// Converts total minutes since midnight to a 12-hour time label e.g. 510 -> "08:30 AM"
function minutesToTimeLabel (m) {
  let h = Math.floor(m / 60), mm = m % 60
  const period = h >= 12 ? 'PM' : 'AM'
  if (h > 12) h -= 12
  if (h === 0) h = 12
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${period}`
}

// Adds a given number of days to an ISO date string (YYYY-MM-DD) and returns the new ISO string
function addDaysToISO (isoStr, days) {
  const d = new Date(isoStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  // Use local date parts to avoid UTC offset shifting the date
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Converts an ISO date string (YYYY-MM-DD) to a locale-formatted string e.g. "Mar 16, 2026"
function isoToLocaleString (isoStr) {
  const d = new Date(isoStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Converts an array of 30-min slot start labels into a human-readable time range
// e.g. ["08:00 AM", "08:30 AM", "09:00 AM"] -> "08:00 AM - 09:30 AM"
function computeSlotTimeRange (slots) {
  if (!slots || slots.length === 0) return ''
  try {
    // Sort slots chronologically before computing the range
    const sorted = [...slots].sort(
      (a, b) => new Date('1970/01/01 ' + a) - new Date('1970/01/01 ' + b)
    )
    const start    = sorted[0]
    const lastSlot = sorted[sorted.length - 1]
    // Parse the last slot's start time and add 30 minutes to get the end time
    let [time, modifier] = lastSlot.split(' ')
    let [hours, minutes] = time.split(':')
    let h = parseInt(hours, 10)
    if (h === 12) h = 0
    if (modifier === 'PM') h += 12
    const endDate = new Date(1970, 0, 1, h, parseInt(minutes, 10))
    endDate.setMinutes(endDate.getMinutes() + 30)
    const endStr = endDate.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true
    })
    return `${start} - ${endStr}`
  } catch (e) { return slots.join(', ') }
}

/* Renders the room view with:
  - seat grid data (from DB seats array)
  - 7-day time-slot grid (for the schedule table)
  - booked slot map (for highlighting)
*/
exports.getAvailability = async (req, res) => {
  try {
    const labName  = req.query.lab || 'Gokongwei 302'
    // Use local date to avoid UTC offset pushing the date back a day (PH is UTC+8)
    const today    = new Date()
    const localISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const baseISO  = req.query.date || localISO

    // Load lab from DB (match by name or labCode)
    const lab = await Lab.findOne({
      $or: [{ name: labName }, { labCode: labName }]
    }).lean()

    if (!lab) return res.status(404).send('Lab not found.')

    // 7-day window
    const isoDays    = Array.from({ length: 7 }, (_, i) => addDaysToISO(baseISO, i))
    const localeDays = isoDays.map(isoToLocaleString)   // "Mar 16, 2026" format used in DB

    // Fetch reservations for this lab across the week
    const allReservations = await Reservation.find({
      lab:    lab._id,
      date:   { $in: localeDays },
      status: 'Active'
    }).populate('user', 'name email photo role').lean()

    // For today's slots, filter out any whose end time has already passed
    const now         = new Date()
    const currentMins = now.getHours() * 60 + now.getMinutes()
    const todayLocale = isoToLocaleString(localISO)

    const reservations = allReservations.filter(r => {
      if (r.date !== todayLocale) return true   // future/past dates: keep all
      if (!r.slotsArray || !r.slotsArray.length) return true
      return r.slotsArray.some(slot => {
        const [tp, mer] = slot.split(' ')
        let [h, m] = tp.split(':').map(Number)
        if (mer === 'PM' && h !== 12) h += 12
        if (mer === 'AM' && h === 12) h  = 0
        return (h * 60 + m + 30) > currentMins
      })
    })

    // Time-slot grid (used by the schedule table)
    const timeslots = []
    let slotIdx = 0
    for (let t = 480; t < 1020; t += 30, slotIdx++) {   // 8:00 AM – 5:00 PM
      const timeLabel = `${minutesToTimeLabel(t)} - ${minutesToTimeLabel(t + 30)}`
      // The slot label stored in slotsArray is just the start time e.g. "08:00 AM"
      const startLabel = minutesToTimeLabel(t)

      const dayCells = localeDays.map((localeDate, i) => {
        // All reservations that include this slot on this date
        const slotRes = reservations.filter(r =>
          r.date === localeDate &&
          Array.isArray(r.slotsArray) && r.slotsArray.includes(startLabel)
        )

        // Count booked seats at this slot across all reservations
        const bookedSeatCount = slotRes.reduce((total, r) => {
          const seats = Array.isArray(r.seatNumber) ? r.seatNumber.length : 1
          return total + seats
        }, 0)

        const totalSeats     = lab.seats ? lab.seats.length : (lab.capacity || 0)
        const seatsLeft      = totalSeats - bookedSeatCount
        const fullyBooked    = seatsLeft <= 0
        const firstRes       = slotRes[0] || null

        return {
          isoDate:         isoDays[i],
          localeDate,
          prettyDate:      localeDays[i],
          dayIndex:        i,
          slotIndex:       slotIdx,
          startLabel,
          timeLabel,
          reserved:        fullyBooked,
          partiallyBooked: slotRes.length > 0 && !fullyBooked,
          seatsLeft,
          isFaculty:       firstRes?.userRole === 'faculty',
          isTechnician:    firstRes?.userRole === 'technician',
          isAnonymous:     firstRes?.isAnonymous === true,
          reservationId:   firstRes?._id || null,
          reserveeName:    (firstRes && !firstRes.isAnonymous !== true && firstRes.user) ? firstRes.user.name : null,
          seatNumbers:     firstRes ? (Array.isArray(firstRes.seatNumber) ? firstRes.seatNumber.join(', ') : firstRes.seatNumber) : null
        }
      })

      timeslots.push({ timeLabel, startLabel, dayCells })
    }

    res.render('rooms', {
      title:        lab.name || lab.labCode,
      labName:      lab.name || lab.labCode,
      labCode:      lab.labCode,
      labId:        lab._id,
      days:         localeDays,
      isoDays,
      timeslots,
      baseISO,
      scrollToTime: req.query.time || null,   // passed from search form
      seats:        lab.seats || [],
      totalSeats:   (lab.seats || []).length,
      isTechnician: req.session.currentUser?.role === 'technician'
    })
  } catch (err) {
    console.error('roomsCon error:', err)
    res.status(500).send('Error loading room availability.')
  }
}
