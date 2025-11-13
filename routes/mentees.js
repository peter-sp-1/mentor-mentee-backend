const express = require('express');
const nodemailer = require('nodemailer');
const pool = require('../config/db');
const { isAuthenticated, isMentor } = require('../middleware/auth');
const router = express.Router();

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send reminder emails to non-readers
router.post('/remind/:postId', isAuthenticated, isMentor, async (req, res) => {
  try {
    const { postId } = req.params;
    const mentorId = req.user.id;
    
    // Get non-readers
    const nonReaders = await pool.query(
      `SELECT u.email, u.name
       FROM users u
       WHERE u.mentor_id = $1 
       AND u.role = 'mentee'
       AND NOT EXISTS (
         SELECT 1 FROM post_reads pr 
         WHERE pr.post_id = $2 AND pr.mentee_id = u.id
       )`,
      [mentorId, postId]
    );
    
    if (nonReaders.rows.length === 0) {
      return res.json({ message: 'All mentees have read the post!' });
    }
    
    // Send emails
    const emailPromises = nonReaders.rows.map(mentee => {
      return transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: mentee.email,
        subject: 'Reminder: Read Today\'s Post',
        html: `
          Hi ${mentee.name},
          This is a friendly reminder to read today's post from your mentor.
          Please log in to the platform to read and engage with the content.
          
          Best regards,Mentor-Mentee System
        `
      });
    });
    
    await Promise.all(emailPromises);
    
    res.json({ 
      success: true, 
      message: `Reminder sent to ${nonReaders.rows.length} mentee(s)` 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send reminders' });
  }
});

module.exports = router;
