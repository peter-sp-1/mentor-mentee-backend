const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('../config/db');
const router = express.Router();

// Configure Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      const googleId = profile.id;
      const name = profile.displayName;
      const profilePicture = profile.photos[0]?.value;

      // Check if user exists
      let result = await pool.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
      
      if (result.rows.length === 0) {
        // New user - store in session temporarily for role selection
        return done(null, { 
          isNewUser: true, 
          googleId, 
          name, 
          email, 
          profilePicture 
        });
      }

      // Existing user
      const user = result.rows[0];
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }
));

// Serialize user (store entire user object in session)
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user
passport.deserializeUser(async (sessionUser, done) => {
  // If it's a new user in registration flow, return as is
  if (sessionUser.isNewUser) {
    return done(null, sessionUser);
  }
  
  // For existing users, fetch fresh data from database
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [sessionUser.id]);
    if (result.rows.length > 0) {
      done(null, result.rows[0]);
    } else {
      done(null, sessionUser);
    }
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth routes
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}/login` }),
  (req, res) => {
    // Check if new user needs role selection
    if (req.user.isNewUser) {
      return res.redirect(`${process.env.FRONTEND_URL}/select-role`);
    }
    
    // Existing user - redirect to appropriate dashboard
    if (req.user.role === 'admin') {
      res.redirect(`${process.env.FRONTEND_URL}/admin`);
    } else if (req.user.role === 'mentor') {
      res.redirect(`${process.env.FRONTEND_URL}/mentor`);
    } else {
      res.redirect(`${process.env.FRONTEND_URL}/mentee`);
    }
  }
);

// Complete registration with role selection
router.post('/complete-registration', async (req, res) => {
  try {
    if (!req.user || !req.user.isNewUser) {
      return res.status(400).json({ error: 'Invalid registration state' });
    }

    const { role } = req.body;
    if (!['mentor', 'mentee'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const { googleId, name, email, profilePicture } = req.user;

    // Create user in database
    const result = await pool.query(
      'INSERT INTO users (google_id, name, email, profile_picture, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [googleId, name, email, profilePicture, role]
    );

    // Update session with complete user data
    req.login(result.rows[0], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Session error' });
      }
      res.json({ success: true, user: result.rows[0] });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get current user
router.get('/current-user', (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.isNewUser) {
      return res.json({ isNewUser: true, name: req.user.name });
    }
    
    res.json({
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      profilePicture: req.user.profile_picture
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
  });
});

module.exports = router;