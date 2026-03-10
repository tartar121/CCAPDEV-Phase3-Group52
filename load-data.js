const mongoose = require('mongoose');
const User = require('./models/user');
const Reservation = require('./models/reservation');

// Connect to your local MongoDB
mongoose.connect('mongodb://localhost:27017/labOMine')
    .then(() => console.log('Connected to MongoDB for seeding...'))
    .catch(err => console.error('Connection error:', err));

async function seed() {
    try {
        // Clear existing data
        await User.deleteMany({});
        await Reservation.deleteMany({});

        // 1. Insert Users
        const users = await User.insertMany([
            { name: 'Oliver Berris', email: 'oliver.berris@dlsu.edu.ph', password: '123', bio: "Computer Science Faculty member who loves teaching." },
            { name: 'Tara Uy', email: 'tara_uy@dlsu.edu.ph', password: '456', bio: "Avid Gamer and Persona Series Lover." },
            { name: 'Ram Liwanag', email: 'ram_liwanag@dlsu.edu.ph', password: '789', bio: "Loves technology, programming, and playing Honkai: Star Rail." },
            { name: 'Dale Balila', email: 'dale_balila@dlsu.edu.ph', password: 'abc', bio: "CCS Student and part-time sleeper." },
            { name: 'John Teoxon', email: 'john_teoxon@dlsu.edu.ph', password: 'def', bio: "Enjoys watching movies and exploring new cafes around the city." },
            { name: 'Admin Account', email: 'admin@dlsu.edu.ph', password: 'admin', bio: "System Administrator" }
        ]);

        // 2. Helper to find user ID by email
        const findUserId = (email) => users.find(u => u.email === email)._id;

        // 3. Insert Reservations
        await Reservation.insertMany([
            { room: "Gokongwei 302", date: new Date(), slotIndex: 2, slotTime: "08:30 AM - 09:00 AM", user: findUserId('oliver.berris@dlsu.edu.ph'), userRole: "teacher", isAnonymous: false },
            { room: "Gokongwei 302", date: new Date(), slotIndex: 3, slotTime: "09:00 AM - 09:30 AM", user: findUserId('oliver.berris@dlsu.edu.ph'), userRole: "teacher", isAnonymous: false },
            { room: "Velasco 211", date: new Date(), slotIndex: 5, slotTime: "10:00 AM - 10:30 AM", user: findUserId('tara_uy@dlsu.edu.ph'), userRole: "student", isAnonymous: true },
            { room: "Velasco 211", date: new Date(), slotIndex: 6, slotTime: "10:30 AM - 11:00 AM", user: findUserId('tara_uy@dlsu.edu.ph'), userRole: "student", isAnonymous: true },
            { room: "Andrew 1401", date: new Date(), slotIndex: 10, slotTime: "12:30 PM - 01:00 PM", user: findUserId('ram_liwanag@dlsu.edu.ph'), userRole: "student", isAnonymous: false },
            { room: "Andrew 1401", date: new Date(), slotIndex: 11, slotTime: "01:00 PM - 01:30 PM", user: findUserId('ram_liwanag@dlsu.edu.ph'), userRole: "student", isAnonymous: false },
            { room: "Gokongwei 306", date: new Date(), slotIndex: 4, slotTime: "09:30 AM - 10:00 AM", user: findUserId('dale_balila@dlsu.edu.ph'), userRole: "student", isAnonymous: false },
            { room: "Gokongwei 306", date: new Date(), slotIndex: 5, slotTime: "10:00 AM - 10:30 AM", user: findUserId('dale_balila@dlsu.edu.ph'), userRole: "student", isAnonymous: false },
            { room: "Henry Sy 4th Floor", date: new Date(), slotIndex: 1, slotTime: "08:00 AM - 08:30 AM", user: findUserId('john_teoxon@dlsu.edu.ph'), userRole: "student", isAnonymous: false },
            { room: "Henry Sy 4th Floor", date: new Date(), slotIndex: 2, slotTime: "08:30 AM - 09:00 AM", user: findUserId('john_teoxon@dlsu.edu.ph'), userRole: "student", isAnonymous: false }
        ]);

        console.log("Database seeded successfully!");
    } catch (err) {
        console.error("Seeding error:", err);
    } finally {
        mongoose.connection.close();
        process.exit();
    }
}

seed();