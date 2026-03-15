// load-data.js
const mongoose = require('mongoose');
const User = require('./models/user');
const Reservation = require('./models/reservation');
const Lab = require('./models/lab');

// Connect to your local MongoDB
mongoose.connect('mongodb://localhost:27017/labOMine')
    .then(() => console.log('Connected to MongoDB for seeding...'))
    .catch(err => console.error('Connection error:', err));

// Helper: returns today's date as YYYY-MM-DD
function todayISO() {
    return new Date().toISOString().split('T')[0];
}

// Put the sample data
async function seed() {
    try {
        // Clear existing data
        await User.deleteMany({});
        await Reservation.deleteMany({});

        // 1. Insert Labs
        await Lab.insertMany([
            { name: "Gokongwei 302",    building: "Gokongwei",  capacity: 40, floor: "3rd Floor" },
            { name: "Gokongwei 306",    building: "Gokongwei",  capacity: 40, floor: "3rd Floor" },
            { name: "Velasco 211",      building: "Velasco",    capacity: 35, floor: "2nd Floor" },
            { name: "Henry Sy 4th Floor", building: "Henry Sy", capacity: 50, floor: "4th Floor" },
            { name: "Andrew 1401",      building: "Andrew",     capacity: 30, floor: "14th Floor" }
        ]);
        console.log("Labs seeded.");

        // 2. Insert Users (role stored explicitly - no email-checking)
        const users = await User.insertMany([
            { name: 'Oliver Berris', email: 'oliver.berris@dlsu.edu.ph', password: '123',   role: 'faculty',     bio: "Computer Science Faculty member who loves teaching." },
            { name: 'Tara Uy',       email: 'tara_uy@dlsu.edu.ph',       password: '456',   role: 'student',     bio: "Avid Gamer and Persona Series Lover." },
            { name: 'Ram Liwanag',   email: 'ram_liwanag@dlsu.edu.ph',   password: '789',   role: 'student',     bio: "Loves technology, programming, and playing Honkai: Star Rail." },
            { name: 'Dale Balila',   email: 'dale_balila@dlsu.edu.ph',   password: 'abc',   role: 'student',     bio: "CCS Student and part-time sleeper." },
            { name: 'John Teoxon',   email: 'john_teoxon@dlsu.edu.ph',   password: 'def',   role: 'student',     bio: "Enjoys watching movies and exploring new cafes around the city." },
            { name: 'Admin Account', email: 'admin@dlsu.edu.ph',         password: 'admin', role: 'technician',  bio: "System Administrator / Lab Technician" }
        ]);
        console.log("Users seeded.");

        const findUserId = (email) => users.find(u => u.email === email)._id;
        const today = todayISO();

        // 3. Insert Reservations (date as YYYY-MM-DD)
        await Reservation.insertMany([
            { room: "Gokongwei 302",    date: today, slotIndex: 2,  slotTime: "8:30 AM - 9:00 AM",    user: findUserId('oliver.berris@dlsu.edu.ph'), userRole: 'faculty',  isAnonymous: false },
            { room: "Gokongwei 302",    date: today, slotIndex: 3,  slotTime: "9:00 AM - 9:30 AM",    user: findUserId('oliver.berris@dlsu.edu.ph'), userRole: 'faculty',  isAnonymous: false },
            { room: "Velasco 211",      date: today, slotIndex: 5,  slotTime: "10:00 AM - 10:30 AM",  user: findUserId('tara_uy@dlsu.edu.ph'),       userRole: 'student',  isAnonymous: true  },
            { room: "Velasco 211",      date: today, slotIndex: 6,  slotTime: "10:30 AM - 11:00 AM",  user: findUserId('tara_uy@dlsu.edu.ph'),       userRole: 'student',  isAnonymous: true  },
            { room: "Andrew 1401",      date: today, slotIndex: 10, slotTime: "12:30 PM - 1:00 PM",   user: findUserId('ram_liwanag@dlsu.edu.ph'),   userRole: 'student',  isAnonymous: false },
            { room: "Andrew 1401",      date: today, slotIndex: 11, slotTime: "1:00 PM - 1:30 PM",    user: findUserId('ram_liwanag@dlsu.edu.ph'),   userRole: 'student',  isAnonymous: false },
            { room: "Gokongwei 306",    date: today, slotIndex: 4,  slotTime: "9:30 AM - 10:00 AM",   user: findUserId('dale_balila@dlsu.edu.ph'),   userRole: 'student',  isAnonymous: false },
            { room: "Gokongwei 306",    date: today, slotIndex: 5,  slotTime: "10:00 AM - 10:30 AM",  user: findUserId('dale_balila@dlsu.edu.ph'),   userRole: 'student',  isAnonymous: false },
            { room: "Henry Sy 4th Floor", date: today, slotIndex: 1, slotTime: "8:00 AM - 8:30 AM",  user: findUserId('john_teoxon@dlsu.edu.ph'),   userRole: 'student',  isAnonymous: false },
            { room: "Henry Sy 4th Floor", date: today, slotIndex: 2, slotTime: "8:30 AM - 9:00 AM",  user: findUserId('john_teoxon@dlsu.edu.ph'),   userRole: 'student',  isAnonymous: false }
        ]);
        console.log("Reservations seeded.");
        
        console.log("\n Database seeded successfully!");
        console.log("Demo credentials:");
        console.log("  Technician : admin@dlsu.edu.ph        / admin");
        console.log("  Faculty    : oliver.berris@dlsu.edu.ph / 123");
        console.log("  Student    : tara_uy@dlsu.edu.ph       / 456");
    } catch (err) {
        console.error("Seeding error:", err);
    } finally {
        mongoose.connection.close();
        process.exit();
    }
}

seed();
