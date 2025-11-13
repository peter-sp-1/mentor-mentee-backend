const express = require('express');
const pool = require('../config/db');
const { isAuthenticated, isMentor } = require('../middleware/auth');
const router = express.Router();

// Create daily post (Mentor only)
router.post('/', isAuthenticated, isMentor, async (req, res) => {
  try {
    const { title, content } = req.body;
    const mentorId = req.user.id;
    
    const result = await pool.query(
      'INSERT INTO posts (mentor_id, title, content, post_date) VALUES ($1, $2, $3, CURRENT_DATE) RETURNING *',
      [mentorId, title, content]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Post already created for today' });
    } else {
      res.status(500).json({ error: 'Failed to create post' });
    }
  }
});

// Get today's post for mentee
router.get('/today', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    let mentorId;
    
    if (req.user.role === 'mentee') {
      const menteeResult = await pool.query('SELECT mentor_id FROM users WHERE id = $1', [userId]);
      mentorId = menteeResult.rows[0].mentor_id;
    } else {
      mentorId = userId;
    }
    
    const result = await pool.query(
      `SELECT p.*, 
              EXISTS(SELECT 1 FROM post_reads WHERE post_id = p.id AND mentee_id = $1) as is_read
       FROM posts p 
       WHERE p.mentor_id = $2 AND p.post_date = CURRENT_DATE`,
      [userId, mentorId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No post for today' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Mark post as read
router.post('/:postId/read', isAuthenticated, async (req, res) => {
  try {
    const { postId } = req.params;
    const menteeId = req.user.id;
    
    await pool.query(
      'INSERT INTO post_reads (post_id, mentee_id) VALUES ($1, $2) ON CONFLICT (post_id, mentee_id) DO NOTHING',
      [postId, menteeId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Get mentees who read today's post
router.get('/:postId/readers', isAuthenticated, isMentor, async (req, res) => {
  try {
    const { postId } = req.params;
    
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, pr.read_at
       FROM post_reads pr
       JOIN users u ON pr.mentee_id = u.id
       WHERE pr.post_id = $1
       ORDER BY pr.read_at DESC`,
      [postId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch readers' });
  }
});

// Get mentees who haven't read today's post
router.get('/:postId/non-readers', isAuthenticated, isMentor, async (req, res) => {
  try {
    const { postId } = req.params;
    const mentorId = req.user.id;
    
    const result = await pool.query(
      `SELECT u.id, u.name, u.email
       FROM users u
       WHERE u.mentor_id = $1 
       AND u.role = 'mentee'
       AND NOT EXISTS (
         SELECT 1 FROM post_reads pr 
         WHERE pr.post_id = $2 AND pr.mentee_id = u.id
       )`,
      [mentorId, postId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch non-readers' });
  }
});

// Add question to post
router.post('/:postId/questions', isAuthenticated, async (req, res) => {
  try {
    const { postId } = req.params;
    const { question } = req.body;
    const menteeId = req.user.id;
    
    const result = await pool.query(
      'INSERT INTO questions (post_id, mentee_id, question) VALUES ($1, $2, $3) RETURNING *',
      [postId, menteeId, question]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add question' });
  }
});

// Get questions for a post
router.get('/:postId/questions', isAuthenticated, async (req, res) => {
  try {
    const { postId } = req.params;
    
    const result = await pool.query(
      `SELECT q.*, u.name as mentee_name
       FROM questions q
       JOIN users u ON q.mentee_id = u.id
       WHERE q.post_id = $1
       ORDER BY q.created_at DESC`,
      [postId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

module.exports = router;