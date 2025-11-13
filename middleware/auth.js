// Check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated' });
};

// Check if user is a mentor
const isMentor = (req, res, next) => {
  if (req.user && req.user.role === 'mentor') {
    return next();
  }
  res.status(403).json({ error: 'Access denied. Mentors only.' });
};

// ✅ Add this new function
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ error: 'Access denied. Admins only.' });
};

module.exports = { isAuthenticated, isMentor, isAdmin };
