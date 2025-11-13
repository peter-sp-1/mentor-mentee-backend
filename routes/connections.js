const express = require('express');
const pool = require('../config/db');
const { isAuthenticated, isMentor } = require('../middleware/auth');
const router = express.Router();

// Search for mentees (for mentors to connect)
router.get('/search-mentees', isAuthenticated, isMentor, async (req, res) => {
  try {
    const { query } = req.query;
    const mentorId = req.user.id;

    let result;
    if (query) {
      // Search by name or email
      result = await pool.query(
        `SELECT u.id, u.name, u.email, u.profile_picture,
                EXISTS(SELECT 1 FROM mentor_mentee_connections 
                       WHERE mentor_id = $1 AND mentee_id = u.id) as is_connected
         FROM users u
         WHERE u.role = 'mentee' 
         AND (LOWER(u.name) LIKE LOWER($2) OR LOWER(u.email) LIKE LOWER($2))
         ORDER BY u.name`,
        [mentorId, `%${query}%`]
      );
    } else {
      // Get all mentees
      result = await pool.query(
        `SELECT u.id, u.name, u.email, u.profile_picture,
                EXISTS(SELECT 1 FROM mentor_mentee_connections 
                       WHERE mentor_id = $1 AND mentee_id = u.id) as is_connected
         FROM users u
         WHERE u.role = 'mentee'
         ORDER BY u.name`,
        [mentorId]
      );
    }

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to search mentees' });
  }
});

// Get mentor's connected mentees
router.get('/my-mentees', isAuthenticated, isMentor, async (req, res) => {
  try {
    const mentorId = req.user.id;

    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.profile_picture, mmc.connected_at
       FROM users u
       JOIN mentor_mentee_connections mmc ON u.id = mmc.mentee_id
       WHERE mmc.mentor_id = $1
       ORDER BY mmc.connected_at DESC`,
      [mentorId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch mentees' });
  }
});

// Connect with a mentee
router.post('/connect/:menteeId', isAuthenticated, isMentor, async (req, res) => {
  try {
    const { menteeId } = req.params;
    const mentorId = req.user.id;

    await pool.query(
      'INSERT INTO mentor_mentee_connections (mentor_id, mentee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [mentorId, menteeId]
    );

    res.json({ message: 'Connected successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to connect' });
  }
});

// Disconnect from a mentee
router.delete('/disconnect/:menteeId', isAuthenticated, isMentor, async (req, res) => {
  try {
    const { menteeId } = req.params;
    const mentorId = req.user.id;

    await pool.query(
      'DELETE FROM mentor_mentee_connections WHERE mentor_id = $1 AND mentee_id = $2',
      [mentorId, menteeId]
    );

    res.json({ message: 'Disconnected successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// Get mentee's mentors (for mentee dashboard)
router.get('/my-mentors', isAuthenticated, async (req, res) => {
  try {
    const menteeId = req.user.id;

    if (req.user.role !== 'mentee') {
      return res.status(403).json({ error: 'Only mentees can access this' });
    }

    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.profile_picture, mmc.connected_at
       FROM users u
       JOIN mentor_mentee_connections mmc ON u.id = mmc.mentor_id
       WHERE mmc.mentee_id = $1
       ORDER BY mmc.connected_at DESC`,
      [menteeId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch mentors' });
  }
});

module.exports = router;