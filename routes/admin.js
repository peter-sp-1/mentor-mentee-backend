const express = require('express');
const pool = require('../config/db');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const router = express.Router();

// Get all users
router.get('/users', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, profile_picture, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role
router.put('/users/:userId/role', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['admin', 'mentor', 'mentee'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Delete user
router.delete('/users/:userId', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get system statistics
router.get('/stats', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const mentorsCount = await pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['mentor']);
    const menteesCount = await pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['mentee']);
    const connectionsCount = await pool.query('SELECT COUNT(*) FROM mentor_mentee_connections');
    const postsCount = await pool.query('SELECT COUNT(*) FROM posts');

    res.json({
      mentors: parseInt(mentorsCount.rows[0].count),
      mentees: parseInt(menteesCount.rows[0].count),
      connections: parseInt(connectionsCount.rows[0].count),
      posts: parseInt(postsCount.rows[0].count)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;