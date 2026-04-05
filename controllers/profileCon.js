// controllers/profileCon.js
const User        = require('../models/user')
const Reservation = require('../models/reservation')

// GET profile — own or another user's
exports.getProfile = async (req, res) => {
  try {
    const targetEmail = req.params.email || req.session.currentUser.email
    const profileUser = await User.findOne({ email: targetEmail }).lean()
    if (!profileUser) return res.status(404).send('User not found.')

    const photoUrl = profileUser.photo ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(profileUser.name)}&background=2e8b57&color=fff`

    const isSelf = targetEmail === req.session.currentUser.email
    const isTech = req.session.currentUser.role === 'technician'

    // Hide anonymous reservations from other regular users — technicians can see all
    const query = { user: profileUser._id, status: 'Active' }
    if (!isSelf && !isTech) query.isAnonymous = false

    const reservations = await Reservation.find(query)
      .populate('lab', 'name labCode')
      .sort({ date: 1, createdAt: 1 })
      .lean()

    // Add isoDate for the edit link — DB stores locale string "Mar 16, 2026" but rooms needs YYYY-MM-DD
    const toISO = str => {
      const d = new Date(str)
      if (isNaN(d.getTime())) return str
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    }
    const enriched = reservations.map(r => ({ ...r, isoDate: toISO(r.date) }))

    res.render('profile', {
      title:       `${profileUser.name}'s Profile`,
      profileUser: { ...profileUser, photoUrl },
      reservations: enriched,
      isSelf,
      isTech
    })
  } catch (err) {
    console.error(err)
    res.status(500).send('Error loading profile.')
  }
}


exports.updateBio = async (req, res) => {
  try {
    const { bio } = req.body;

    // Validate lang
    if (!bio) {
      return res.status(400).json({ error: "Bio cannot be empty." });
    }

    if (bio.length > 200) {
      return res.status(400).json({ error: "Bio must not exceed 200 characters." });
    }

    await User.updateOne(
      { email: req.session.currentUser.email },
      { bio }
    );

    res.status(200).json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating bio.' });
  }
};




// POST /profile/update-photo — file upload via multer
exports.updatePhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })
    const photoPath = '/uploads/' + req.file.filename
    await User.updateOne({ email: req.session.currentUser.email }, { photo: photoPath })
    res.status(200).json({ success: true, photo: photoPath })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error updating photo.' })
  }
}

// POST /profile/delete
exports.deleteAccount = async (req, res) => {
  try {
    const { _id: userId, email } = req.session.currentUser
    await Reservation.updateMany({ user: userId, status: 'Active' }, { status: 'Cancelled' })
    await User.deleteOne({ email })
    req.session.destroy(() => res.redirect('/login'))
  } catch (err) {
    console.error(err)
    res.status(500).send('Error deleting account.')
  }
}
