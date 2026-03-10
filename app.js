const express = require('express');
const exphbs = require('express-handlebars');
const mongoose = require('mongoose');
const session = require('express-session');

const app = express();

// Require Controllers
const authController = require('./controllers/authCon');
const profileController = require('./controllers/profileCon');
const reservationController = require('./controllers/reservationCon');
const roomsController = require('./controllers/roomsCon');
const labController = require('./controllers/labCon');

// Database Connection
mongoose.connect('mongodb://localhost:27017/labOMine')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Connection error:', err));

// Required: Middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Setup Session
app.use(session({
    secret: 'labOMineSecretKey', // Use a secure secret in production
    resave: false,
    saveUninitialized: false
}));

// Middleware before ROUTES
app.use((req, res, next) => {
    res.locals.currentUser = req.session.currentUser;
    next();
});

// Authentication Middleware
function checkAuth(req, res, next) {
    if (req.session && req.session.currentUser) {
        next(); // User is logged in, proceed to the route
    } else {
        res.redirect('/login'); // Redirect to login page
    }
}

// Handlebars Configuration
app.engine("hbs", exphbs.engine({
    extname: 'hbs',
    defaultLayout: 'main',
    layoutsDir: __dirname + '/views/layouts',
    partialsDir: __dirname + '/views/partials',
    helpers: {
        formatDate: function(date) {
            const d = new Date(date);
            return d.toLocaleDateString('en-US', { 
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
            });
        },
        section: function(name, options) {
            if (!this._sections) this._sections = {};
            this._sections[name] = options.fn(this);
            return null;
        },
        isBooked: function(slotId, reservations) {
            return reservations.some(res => res.slotIndex === slotId); 
        },
        block: function(name) { return this._sections ? this._sections[name] : ''; },
        capital: function(text) { 
        return text ? text.toString().toUpperCase() : ""; }
    }
}));
app.set("view engine", "hbs");
app.set("views", "./views");

app.use(express.static(__dirname + "/public"));

// ROUTES
// Dashboard
app.get('/', checkAuth, labController.getDashboard); 

// Authentication
app.get('/login', (req, res) => res.render('login', { layout: 'login-layout' }));
app.post('/login', authController.login);
app.post('/register', authController.register);
app.get('/logout', authController.logout);

// Labs & Reservations
app.get('/rooms', checkAuth, roomsController.getAvailability);
app.post('/reserve', checkAuth, reservationController.reserve);
app.post('/reserve-multiple', checkAuth, reservationController.reserveMultiple);
app.post('/cancel-reservation', checkAuth, reservationController.cancel);

// Profile
app.get('/profile', checkAuth, profileController.getProfile); 
app.get('/profile/:email', checkAuth, profileController.getProfile);
app.post('/profile/update-bio', checkAuth, profileController.updateBio);
app.post('/profile/update-photo', checkAuth, profileController.updatePhoto);
app.post('/profile/delete', checkAuth, profileController.deleteAccount);

// Search
app.get('/search', checkAuth, (req, res) => res.render('search', { title: "Search Labs" }));

app.listen(3000, () => console.log("Server running on port 3000"));