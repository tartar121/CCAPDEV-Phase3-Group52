// controllers/authCon.js
const User = require('../models/user');

exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (user && user.password === password) {
            req.session.currentUser = {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.email.includes('.') && !user.email.includes('_') ? 'FACULTY' : 'STUDENT'
            };
            res.redirect('/');
        } else {
            res.render('login', { title: "Login", error: "Invalid email or password" });
        }
    } catch (err) {
        res.status(500).send("Server error");
    }
};

exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        await User.create({ name, email, password });
        res.render('login', { title: "Login", error: "Registration successful!" });
    } catch (err) {
        res.render('login', { title: "Login", error: "Registration failed." });
    }
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
};
