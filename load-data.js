// load-data.js
require('dotenv').config()
const mongoose    = require('mongoose')
const bcrypt      = require('bcrypt')  
const User        = require('./models/user')
const Reservation = require('./models/reservation')
const Lab         = require('./models/lab')

// Connect to your local MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB for seeding...'))
  .catch(err => console.error('Connection error:', err))

/* Seat helper
   - Builds an array of seat objects up to the given count.
   - Seat numbers start at 1 and are stored as strings.
*/
function makeSeatList (total) {
  return Array.from({ length: total }, (_, i) => ({ seatNumber: String(i + 1) }))
}

// Time helpers
// All slots are 30-min blocks stored as "HH:MM AM/PM"
function numToSlotLabel (h, m) {
  const suffix  = h >= 12 ? 'PM' : 'AM'
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${String(display).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`
}

// Returns an array of consecutive 30-min slot labels starting at [startH:startM]
function makeSlots (startH, startM, count) {
  const result = []
  let h = startH, m = startM

  for (let i = 0; i < count; i++) {
    result.push(numToSlotLabel(h, m))
    m += 30
    if (m >= 60) { m -= 60; h += 1 }
    if (h >= 24)   h  = 0
  }

  return result
}

// Converts a slot array into "HH:MM AM - HH:MM AM"
function slotRangeStr (slots) {
  if (!slots || !slots.length) return ''

  const toMins = label => {
    const [tp, mer] = label.split(' ')
    let [h, m] = tp.split(':').map(Number)
    if (mer === 'PM' && h !== 12) h += 12
    if (mer === 'AM' && h === 12) h  = 0
    return h * 60 + m
  }

  const sorted  = [...slots].sort((a, b) => toMins(a) - toMins(b))
  const endMins = toMins(sorted[sorted.length - 1]) + 30
  const eH      = Math.floor(endMins / 60)
  const eM      = endMins % 60
  return `${sorted[0]} - ${numToSlotLabel(eH, eM)}`
}

// Formats a Date as "Mar 16, 2026"
function shortDate (d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Reservation doc builder
function resDoc ({ userId, labId, labCode, seats, date, slots, isAnonymous = false, userRole = 'student', status = 'Active' }) {
  return {
    user:        userId,
    lab:         labId,
    labCode,
    seatNumber:  seats,
    date,
    slotsArray:  slots,
    timeSlot:    JSON.stringify(slots),
    timeRange:   slotRangeStr(slots),
    isAnonymous,
    userRole,
    status
  }
}

// MAIN seed function
async function seed() {
  try {
    // Clear existing data
    await User.deleteMany({})
    await Reservation.deleteMany({})
    await Lab.deleteMany({})

    // 1. Labs
    const labs = await Lab.insertMany([
      { name: 'Gokongwei 302', labCode: 'GK302',  building: 'Gokongwei Hall',       floor: '3rd Floor',  capacity: 40, seats: makeSeatList(40) },
      { name: 'Gokongwei 306', labCode: 'GK306',  building: 'Gokongwei Hall',       floor: '3rd Floor',  capacity: 30, seats: makeSeatList(30) },
      { name: 'Velasco 211',   labCode: 'VL211',  building: 'Velasco Hall',         floor: '2nd Floor',  capacity: 35, seats: makeSeatList(35) },
      { name: 'Andrew 1904',   labCode: 'AG1904', building: 'Andrew Gonzales Hall', floor: '19th Floor', capacity: 45, seats: makeSeatList(45) },
      { name: 'Andrew 1401',   labCode: 'AG1401', building: 'Andrew Gonzales Hall', floor: '14th Floor', capacity: 30, seats: makeSeatList(30) }
    ])
    const lm = Object.fromEntries(labs.map(l => [l.labCode, l]))
    console.log('Labs seeded:', Object.keys(lm).join(', '))

    // 2. Users (WITH HASHING)
    const usersData = [
      { name: 'Oliver Berris', email: 'oliver.berris@dlsu.edu.ph', password: '123456', role: 'faculty', bio: "Computer Science Faculty member who loves teaching." },
      { name: 'Tara Uy', email: 'tara_uy@dlsu.edu.ph', password: '456789', role: 'student', bio: "Avid Gamer and Persona Series Lover." },
      { name: 'Ram Liwanag', email: 'ram_liwanag@dlsu.edu.ph', password: '789012', role: 'student', bio: "Loves technology, programming, and playing Honkai: Star Rail." },
      { name: 'Dale Balila', email: 'dale_vernard_r_balila@dlsu.edu.ph', password: 'BigDawg', role: 'student', bio: "CCS Student and part-time sleeper." },
      { name: 'John Teoxon', email: 'john_teoxon@dlsu.edu.ph', password: 'abcdef', role: 'student', bio: "Enjoys watching movies and exploring new cafes around the city." },
      { name: 'Admin Account', email: 'admin@dlsu.edu.ph', password: 'adminPowa', role: 'technician', bio: "Lab Technician" }
    ]

    // Hash passwords
    for (let user of usersData) {
      user.password = await bcrypt.hash(user.password, 10)
    }

    const users = await User.insertMany(usersData)
    const um = Object.fromEntries(users.map(u => [u.email, u]))
    console.log("Users seeded.")

    // 3. Reservations
    const day1 = shortDate(new Date(Date.now() + 86400000))
    const day2 = shortDate(new Date(Date.now() + 86400000 * 2))
    const day3 = shortDate(new Date(Date.now() + 86400000 * 3))

    await Reservation.insertMany([
      resDoc({ userId: um['oliver.berris@dlsu.edu.ph']._id, labId: lm.GK302._id, labCode: 'GK302', seats: [5], date: day1, slots: makeSlots(8, 30, 2), userRole: 'faculty' }),
      resDoc({ userId: um['tara_uy@dlsu.edu.ph']._id, labId: lm.VL211._id, labCode: 'VL211', seats: [12], date: day1, slots: makeSlots(10, 0, 2), isAnonymous: true })
    ])

    console.log("Reservations seeded.")

    console.log("\nDatabase seeded successfully!")
    console.log("Demo credentials:")
    console.log("Technician : admin@dlsu.edu.ph / adminPowa")
    console.log("Faculty    : oliver.berris@dlsu.edu.ph / 123456")
    console.log("Student    : tara_uy@dlsu.edu.ph / 456789")

  } catch (err) {
    console.error("Seeding error:", err)
  } finally {
    mongoose.connection.close()
    process.exit()
  }
}

seed()