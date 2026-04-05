// controllers/authCon.js
const User = require('../models/user');
const bcrypt = require('bcrypt');


// LOGIN
exports.login = async (req, res) => {
    const { email, password, rememberMe } = req.body;

    // Basic validation
    if (!email || !password) {
        return res.render('login', {
            layout: 'login-layout',
            title: "Login",
            error: "All fields are required."
        });
    }

    try {
        const user = await User.findOne({ email }); // ❗ removed .lean()

        // Compare hashed password
        if (user && await bcrypt.compare(password, user.password)) {

            req.session.currentUser = {
                _id:   user._id,
                name:  user.name,
                email: user.email,
                role:  user.role
            };

            // Remember Me logic
            if (rememberMe) {
                req.session.cookie.maxAge = 21 * 24 * 60 * 60 * 1000; // 3 weeks in ms
            } else {
                req.session.cookie.expires = false; //browser session only
            }

            return res.redirect('/');
        } else {
            return res.render('login', {
                layout: 'login-layout',
                title: "Login",
                error: "Invalid email or password."
            });
        }

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
};


// REGISTER
exports.register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.render('login', {
                layout: 'login-layout',
                title: "Login",
                error: "All fields are required."
            });
        }

        // DLSU email restriction
        if (!email.endsWith("@dlsu.edu.ph")) { //gotta make sure its dlsu email only
            return res.render('login', {
                layout: 'login-layout',
                title: "Login",
                error: "Please use a valid DLSU email."
            });
        }

        // Password length check
        if (password.length < 6) {
            return res.render('login', {
                layout: 'login-layout',
                title: "Login",
                error: "Password must be at least 6 characters."
            });
        }

        // Hash the password before saving to the database
        const hashedPassword = await bcrypt.hash(password, 10);

        // Only allow student or faculty self-registration — technician is staff only
        const allowedRoles = ['student', 'faculty'];
        const assignedRole = allowedRoles.includes(role) ? role : 'student';

        await User.create({
            name,
            email,
            password: hashedPassword,
            role: assignedRole
        });

        res.render('login', {
            layout: 'login-layout',
            title: "Login",
            success: "Registration successful! Please log in."
        });

    } catch (err) {
        console.error(err);

        const msg = err.code === 11000
            ? "An account with that email already exists."
            : "Registration failed. Please try again.";

        res.render('login', {
            layout: 'login-layout',
            title: "Login",
            error: msg
        });
    }
};

// LOGOUT
exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
};
