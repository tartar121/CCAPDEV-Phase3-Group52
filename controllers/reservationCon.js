// controllers/reservationCon.js
const Reservation = require('../models/reservation')
const Lab = require('../models/lab')

// Convert 30-min slot labels to string e.g. "09:00 AM - 10:30 AM"
function slotsToDisplayRange (slotLabels) {
  if (!slotLabels || slotLabels.length === 0) return ''

  try {
    // Convert each label to total minutes for reliable sorting
    const toTotalMins = label => {
      const [timePart, meridiem] = label.split(' ')
      let [h, m] = timePart.split(':').map(Number)
      if (meridiem === 'PM' && h !== 12) h += 12
      if (meridiem === 'AM' && h === 12) h  = 0
      return h * 60 + m
    }

    const sorted    = [...slotLabels].sort((a, b) => toTotalMins(a) - toTotalMins(b))
    const startLabel = sorted[0]
    const lastLabel  = sorted[sorted.length - 1]

    // End time = last slot start + 30 minutes
    let totalEndMins = toTotalMins(lastLabel) + 30
    const endH       = Math.floor(totalEndMins / 60)
    const endM       = totalEndMins % 60
    const endMeridiem = endH >= 12 ? 'PM' : 'AM'
    const endDisplay  = endH > 12 ? endH - 12 : endH === 0 ? 12 : endH
    const endLabel    = `${String(endDisplay).padStart(2, '0')}:${String(endM).padStart(2, '0')} ${endMeridiem}`

    return `${startLabel} - ${endLabel}`
  } catch {
    return slotLabels.join(', ')
  }
}

// Resolve Lab from labId or labCode; Helps lookup for lab
async function resolveLabDoc (labId, labCode) {
  if (labId) return Lab.findById(labId)
  if (labCode) return Lab.findOne({ labCode }) || Lab.findOne({ labCode: labCode.replace(/^[A-Za-z]+/, '') })
  return null
}

// Get user's reservations
exports.getMyReservations = async (req, res) => {
  if (!req.session.currentUser) return res.status(401).json({ error: 'Not logged in.' })

  try {
    const docs = await Reservation
      .find({ user: req.session.currentUser._id, status: 'Active' })
      .populate('lab')
      .sort({ createdAt: -1 })
      .lean()

    res.json(docs)
  } catch (err) {
    console.error('getMyReservations:', err)
    res.status(500).json({ error: 'Could not load reservations.' })
  }
}

// Get booked slots for a lab on a given date
// Returns { slotLabel: { ..., seatsLeft, fullyBooked } }
// A slot is only marked fullyBooked when ALL seats in the lab are taken
exports.getBookedSlots = async (req, res) => {
  try {
    const lab = await resolveLabDoc(req.query.labId, req.query.labCode)
    if (!lab) return res.json({})

    const active = await Reservation
      .find({ lab: lab._id, date: req.query.date, status: 'Active' })
      .populate('user', 'name email photo')
      .lean()

    // Filter out reservations whose time has already passed today
    const now        = new Date()
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    const isToday    = req.query.date === todayLocal ||
      // also handle locale string format e.g. "Mar 15, 2026"
      new Date(req.query.date + (req.query.date.includes('-') ? 'T00:00:00' : '')).toDateString() === now.toDateString()

    const currentMins = now.getHours() * 60 + now.getMinutes()

    const stillActive = isToday
      ? active.filter(doc => {
          if (!doc.slotsArray || !doc.slotsArray.length) return true
          // Keep if ANY slot in the reservation hasn't ended yet
          return doc.slotsArray.some(slot => {
            const [tp, mer] = slot.split(' ')
            let [h, m] = tp.split(':').map(Number)
            if (mer === 'PM' && h !== 12) h += 12
            if (mer === 'AM' && h === 12) h  = 0
            const slotEndMins = h * 60 + m + 30
            return slotEndMins > currentMins
          })
        })
      : active   // for future/past dates, show all active reservations as-is

    const totalSeats = lab.seats ? lab.seats.length : (lab.capacity || 0)

    // First pass: group by slot using only stillActive (past slots filtered out for today)
    const slotBookings = {}   // slotLabel -> array of reservation docs

    stillActive.forEach(doc => {
      if (!doc.timeSlot) return
      let parsedSlots
      try { parsedSlots = JSON.parse(doc.timeSlot) }
      catch { return }

      parsedSlots.forEach(slotLabel => {
        if (!slotBookings[slotLabel]) slotBookings[slotLabel] = []
        slotBookings[slotLabel].push(doc)
      })
    })

    // Second pass: build occupancy map with seat counts
    const occupancy = {}

    Object.entries(slotBookings).forEach(([slotLabel, docs]) => {
      const bookedCount = docs.reduce((total, doc) => {
        return total + (Array.isArray(doc.seatNumber) ? doc.seatNumber.length : 1)
      }, 0)

      const seatsLeft  = Math.max(0, totalSeats - bookedCount)
      const fullyBooked = seatsLeft <= 0

      // Use first reservation for display info
      const first    = docs[0]
      const seatStr  = docs.map(d =>
        Array.isArray(d.seatNumber) ? d.seatNumber.join(', ') : String(d.seatNumber)
      ).join(', ')

      occupancy[slotLabel] = {
        fullyBooked,
        seatsLeft,
        bookedCount,
        totalSeats,
        seatNumbers:  seatStr,
        resId:        first._id,
        isAnonymous:  first.isAnonymous,
        userRole:     first.userRole || 'student',
        name:         first.isAnonymous ? 'Anonymous' : (first.user?.name || 'Unknown'),
        userId:       first.isAnonymous ? null : (first.user?._id || null),
        userEmail:    first.isAnonymous ? null : (first.user?.email || null),
        avatar:       first.isAnonymous
          ? 'https://ui-avatars.com/api/?name=Anon&background=555&color=fff'
          : (first.user?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(first.user?.name || 'User')}&background=2e8b57&color=fff`)
      }
    })

    res.json(occupancy)
  } catch (err) {
    console.error('getBookedSlots:', err)
    res.status(500).json({ error: 'Could not load booked slots.' })
  }
}

// Create/Make reservation
exports.createReservation = async (req, res) => {
  if (!req.session.currentUser) return res.status(401).json({ error: 'Not logged in.' })

  try {
    const { labId, labCode, seats, date, timeRange, slotsArray, isAnonymous } = req.body

    if (!date || !slotsArray || slotsArray.length === 0) { 
      return res.status(400).json({ error: "Invalid reservation data." }); 
    }

    if (!seats || (Array.isArray(seats) && seats.length === 0)) {
      return res.status(400).json({ error: "Please select at least one seat." });
    }


    const lab = await resolveLabDoc(labId, labCode)
    if (!lab) return res.status(404).json({ error: 'Lab not found.' })

    // Enforce 1-hour minimum (2 slots) and 2-hour maximum (4 slots)
    if (!Array.isArray(slotsArray) || slotsArray.length < 2)
      return res.status(400).json({ error: 'Minimum reservation is 1 hour (2 slots).' })
    if (slotsArray.length > 4)
      return res.status(400).json({ error: 'Maximum reservation is 2 hours (4 slots).' })

    // Check for seat+time conflicts — a specific seat cannot be double-booked
    // at the same time slot on the same date
    const requestedSeats = Array.isArray(seats) ? seats.map(Number) : [Number(seats)]

    const isFaculty = req.session.currentUser.role === 'faculty'

    // Faculty can bump students — only block faculty if another faculty/tech has the seat
    const conflictQuery = {
      lab:        lab._id,
      date,
      status:     'Active',
      seatNumber: { $in: requestedSeats },
      slotsArray: { $in: slotsArray }
    }
    if (isFaculty) conflictQuery.userRole = { $in: ['faculty', 'technician'] }

    const conflicting = await Reservation.findOne(conflictQuery)

    if (conflicting) {
      const takenSeats = Array.isArray(conflicting.seatNumber)
        ? conflicting.seatNumber.filter(s => requestedSeats.includes(Number(s))).join(', ')
        : conflicting.seatNumber
      return res.status(409).json({
        error: `Seat(s) ${takenSeats} are already reserved at one or more of your selected time slots. Please choose different seats or a different time.`
      })
    }

    // Priority system: faculty can bump students from conflicting seats
    let bumpedStudents = 0
    if (isFaculty) {
      const studentConflicts = await Reservation.find({
        lab:        lab._id,
        date,
        status:     'Active',
        userRole:   'student',
        seatNumber: { $in: requestedSeats },
        slotsArray: { $in: slotsArray }
      })
      if (studentConflicts.length > 0) {
        bumpedStudents = studentConflicts.length
        await Reservation.updateMany(
          { _id: { $in: studentConflicts.map(r => r._id) } },
          { status: 'Cancelled' }
        )
      }
    }

    const doc = await Reservation.create({
      user:        req.session.currentUser._id,
      lab:         lab._id,
      labCode:     lab.labCode,
      seatNumber:  seats,
      date,
      slotsArray,
      timeSlot:    JSON.stringify(slotsArray),
      timeRange:   timeRange || slotsToDisplayRange(slotsArray),
      isAnonymous: !!isAnonymous,
      userRole:    req.session.currentUser.role,
      status:      'Active'
    })

    res.status(201).json({ ...doc.toObject(), bumpedCount: bumpedStudents })
  } catch (err) {
    console.error('createReservation:', err)
    res.status(500).json({ error: 'Could not create reservation.' })
  }
}



// Edit existing reservation
exports.updateReservation = async (req, res) => {
  if (!req.session.currentUser) return res.status(401).json({ error: 'Not logged in.' })

  try {
    const existing = await Reservation.findById(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Reservation not found.' })

    const ownerMatch = String(existing.user) === String(req.session.currentUser._id)
    const isTech     = req.session.currentUser.role === 'technician'
    if (!ownerMatch && !isTech) return res.status(403).json({ error: 'Access denied.' })

    const { labId, labCode, seats, date, timeRange, slotsArray, isAnonymous } = req.body
    const lab = await resolveLabDoc(labId, labCode)
    if (!lab) return res.status(404).json({ error: 'Lab not found.' })

    // Check for conflicts, excluding the reservation being edited
    const editSeats = Array.isArray(seats) ? seats.map(Number) : [Number(seats)]
    const editConflict = await Reservation.findOne({
      _id:        { $ne: req.params.id },
      lab:        lab._id,
      date,
      status:     'Active',
      seatNumber: { $in: editSeats },
      slotsArray: { $in: slotsArray }
    })

    if (editConflict) {
      const takenSeats = Array.isArray(editConflict.seatNumber)
        ? editConflict.seatNumber.filter(s => editSeats.includes(Number(s))).join(', ')
        : editConflict.seatNumber
      return res.status(409).json({
        error: `Seat(s) ${takenSeats} are already reserved at one or more of your selected time slots.`
      })
    }

    const updated = await Reservation.findByIdAndUpdate(
      req.params.id,
      {
        lab:        lab._id,
        labCode:    lab.labCode,
        seatNumber: seats,
        date,
        slotsArray,
        timeSlot:   JSON.stringify(slotsArray),
        timeRange:  timeRange || slotsToDisplayRange(slotsArray),
        isAnonymous: !!isAnonymous
      },
      { returnDocument: 'after' }
    )

    res.json(updated)
  } catch (err) {
    console.error('updateReservation:', err)
    res.status(500).json({ error: 'Could not update reservation.' })
  }
}

// Cancel reservation
exports.cancelReservation = async (req, res) => {
  if (!req.session.currentUser) return res.status(401).json({ error: 'Not logged in.' })

  try {
    const doc = await Reservation.findById(req.params.id)
    if (!doc) return res.status(404).json({ error: 'Not found.' })

    const ownerMatch = String(doc.user) === String(req.session.currentUser._id)
    const isTech     = req.session.currentUser.role === 'technician'
    if (!ownerMatch && !isTech) return res.status(403).json({ error: 'Access denied.' })

    await Reservation.findByIdAndUpdate(req.params.id, { status: 'Cancelled' })
    res.json({ success: true })
  } catch (err) {
    console.error('cancelReservation:', err)
    res.status(500).json({ error: 'Could not cancel reservation.' })
  }
}

// Cancel from profile page
exports.cancelFromProfile = async (req, res) => {
  try {
    const doc = await Reservation.findById(req.body.resId)
    if (!doc) return res.status(404).send('Reservation not found.')

    const ownerMatch = String(doc.user) === String(req.session.currentUser._id)
    const isTech     = req.session.currentUser.role === 'technician'
    if (!ownerMatch && !isTech) return res.status(403).send('Access denied.')

    await Reservation.findByIdAndUpdate(req.body.resId, { status: 'Cancelled' })
    res.redirect('/profile')
  } catch (err) {
    console.error('cancelFromProfile:', err)
    res.status(500).send('Could not cancel reservation.')
  }
}

// For Technician: walk-in booking
exports.techReserve = async (req, res) => {
  if (req.session.currentUser?.role !== 'technician') {
    return res.status(403).send('Technicians only.')
  }

  try {
    const { room, date, slotTime, seatNumber } = req.body
    const lab = await Lab.findOne({ $or: [{ labCode: room }, { name: room }] })
    if (!lab) return res.status(404).send('Lab not found.')

    // Prevent Past-Time Booking (Validation)
    const now = new Date();
    const selectedDateTime = new Date(date + 'T' + slotTime); 
    if (selectedDateTime < now) {
      return res.status(400).send('Error: You cannot create a walk-in for a time that has already passed.');
    }

    // Make 2 slots (1-hour duration)
    // Assuming slotTime is the start time (e.g., "08:00"), calculate the second slot (e.g., "08:30")
    const slots = [slotTime];
    const [hours, minutes] = slotTime.split(':').map(Number);
    let nextMinutes = minutes + 30;
    let nextHours = hours;
    if (nextMinutes >= 60) {
      nextMinutes = 0;
      nextHours += 1;
    }
    const secondSlot = `${nextHours.toString().padStart(2, '0')}:${nextMinutes.toString().padStart(2, '0')}`;
    slots.push(secondSlot);
    
    // Convert ISO date from form (YYYY-MM-DD) to locale string used in DB (e.g., "Mar 16, 2026")
    const localeDate = new Date(date + 'T00:00:00')
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    const slots = [slotTime]
    await Reservation.create({
      user:        req.session.currentUser._id,
      lab:         lab._id,
      labCode:     lab.labCode,
      seatNumber:  [parseInt(seatNumber) || 1],
      date:        localeDate,
      slotsArray:  slots,
      timeSlot:    JSON.stringify(slots),
      timeRange:   slotsToDisplayRange(slots),
      userRole:    'technician',
      isAnonymous: false,
      status:      'Active'
    })

    res.redirect(`/rooms?lab=${encodeURIComponent(lab.name || lab.labCode)}&date=${date}`)
  } catch (err) {
    console.error('techReserve:', err)
    res.status(500).send('Could not create walk-in reservation.')
  }
}
