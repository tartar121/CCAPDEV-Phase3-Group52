// app.js
require('dotenv').config();

const express  = require('express')
const exphbs   = require('express-handlebars')
const mongoose = require('mongoose')
const session  = require('express-session')
const multer   = require('multer')
const path     = require('path')

// Multer storage — saves uploads to public/uploads/
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'public/uploads')),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${req.session.currentUser._id}${ext}`)
  }
})
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },   // 2MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()))
  }
})

const app = express()

// Controllers
const authController = require('./controllers/authCon')
const profileController = require('./controllers/profileCon')
const reservationController = require('./controllers/reservationCon')
const roomsController = require('./controllers/roomsCon')
const labController = require('./controllers/labCon')

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('Connection error:', err))

// Body parsers
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// Setup Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'labOMineSecretKey',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true
    }
}))

// Make currentUser available in every template
app.use((req, res, next) => {
    res.locals.currentUser = req.session.currentUser || null;
    next();
})

// Authentication and Technician guard
function checkAuth(req, res, next) {
    if (req.session?.currentUser) return next() // User is logged in, proceed to the route
    res.redirect('/login') // Redirect to login page
}
function checkTech(req, res, next) {
    if (req.session?.currentUser?.role === 'technician') return next()
    res.status(403).send('Technicians only.')
}

// Handlebars
app.engine('hbs', exphbs.engine({
    extname:       'hbs',
    defaultLayout: 'main',
    layoutsDir:    __dirname + '/views/layouts',
    partialsDir:   __dirname + '/views/partials',
    helpers: {
        formatDate (date) {
            if (!date) return ''
            // Handle both "Mar 16, 2026" locale strings and ISO strings
            const d = /^\d{4}-/.test(date)
                ? new Date(date + 'T00:00:00')
                : new Date(date)
            return d.toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
            }) },
            section (name, options) {
                if (!this._sections) this._sections = {}
                this._sections[name] = options.fn(this)
                return null },
            block (name)      { return this._sections?.[name] || '' },
            capital (text)    { return text ? text.toString().toUpperCase() : '' },
            eq (a, b)         { return a === b },
            json (ctx)        { return JSON.stringify(ctx) },
            isTechnician (r)  { return r === 'technician' }
    }
}))
app.set('view engine', 'hbs')
app.set('views', './views')
app.use(express.static(__dirname + '/public'))

// ─── ROUTES ──────────────────────────────────────────────────────────────────────────────────
// Authentication
app.get('/login', (req, res) => res.render('login', { layout: 'login-layout', title: 'Login' }))
app.post('/login', authController.login)
app.post('/register', authController.register)
app.get('/logout', authController.logout)

// Dashboard
app.get('/', checkAuth, labController.getDashboard)

// Labs / Rooms
app.get('/rooms', checkAuth, roomsController.getAvailability)
app.get('/search', checkAuth, (req, res) => res.render('search', { title: 'Search Labs' }))

// Reservations API (JSON)
// These are called by the seat-grid JS via fetch()
app.get ('/api/reservations/me', checkAuth, reservationController.getMyReservations)
app.get ('/api/reservations/booked', checkAuth, reservationController.getBookedSlots)
app.post('/api/reservations', checkAuth, reservationController.createReservation)
app.put ('/api/reservations/:id', checkAuth, reservationController.updateReservation)
app.delete('/api/reservations/:id', checkAuth, reservationController.cancelReservation)

// Form-based cancel from profile page
app.post('/cancel-reservation', checkAuth, reservationController.cancelFromProfile)

// Technician walk-in (form POST from rooms page)
app.post('/tech/reserve', checkAuth, checkTech, reservationController.techReserve)

// Profile
app.get ('/profile', checkAuth, profileController.getProfile)
app.get ('/profile/:email', checkAuth, profileController.getProfile)
app.post('/profile/update-bio', checkAuth, profileController.updateBio)
app.post('/profile/update-photo', checkAuth, upload.single('photo'), profileController.updatePhoto)
app.post('/profile/delete', checkAuth, profileController.deleteAccount)

// Labs API (for seat grid to know total seats per lab)
app.get('/api/labs', checkAuth, async (req, res) => {
  try {
    const Lab  = require('./models/lab')
    const labs = await Lab.find().lean()
    res.json(labs)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch labs' })
  }
})

// Start server at port 3000
const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))

//For the About page 
app.get('/about', (req, res) => {
  res.render('about');
});
