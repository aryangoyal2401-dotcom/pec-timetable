require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { initDb, getDb } = require('./db/database');
const { seedDatabase } = require('./db/seed');
const path = require('path');
const fs = require('fs');

const app = express();

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled server rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught server exception:', err);
});

// Configure CORS for credentials
app.use(cors({
  origin: function(origin, callback) {
    // Allow all in dev, but for cookies credentials must be true and origin must be explicit
    // In production, the built frontend is served from same domain, so CORS isn't strictly needed
    callback(null, true); 
  },
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// ─── Public API Routes ───
app.use('/api/auth', require('./routes/auth'));

// ─── Protected API Middleware ───
app.use('/api', requireAuth);

// ─── Admin Write-Protection Middleware ───
app.use('/api', (req, res, next) => {
  // Allow GET requests for everyone (viewers and admins)
  if (req.method === 'GET') {
    return next();
  }
  
  // For POST/PUT/DELETE, require admin role
  if (req.user && req.user.role === 'admin') {
    return next();
  } else {
    return res.status(403).json({ error: 'Forbidden: You have view-only access' });
  }
});

// ─── Protected Routes ───
app.use('/api/admin',          require('./routes/admin'));
app.use('/api/academic-terms', require('./routes/academicTerms'));
app.use('/api/departments',    require('./routes/departments'));
app.use('/api/teachers',       require('./routes/teachers'));
app.use('/api/scholars',       require('./routes/scholars'));
app.use('/api/rooms',          require('./routes/rooms'));
app.use('/api/classes',        require('./routes/classes'));
app.use('/api/courses',        require('./routes/courses'));
app.use('/api/assignments',    require('./routes/assignments'));
app.use('/api/timetable',      require('./routes/timetable'));
app.use('/api/bookings',       require('./routes/bookings'));
app.use('/api/holidays',       require('./routes/holidays'));
app.use('/api/backup',         require('./routes/backup'));

app.get('/api/timeslots', async (req, res) => {
  const db = await getDb();
  res.json(await db.all('SELECT * FROM time_slots ORDER BY day, period'));
});

// ─── Serve robots.txt & sitemap.xml explicitly (required for Google)
app.get('/robots.txt', (req, res) => {
  const filePath = path.join(__dirname, '../../client/public/robots.txt');
  res.type('text/plain');
  res.sendFile(filePath);
});
app.get('/sitemap.xml', (req, res) => {
  const filePath = path.join(__dirname, '../../client/public/sitemap.xml');
  res.type('application/xml');
  res.sendFile(filePath);
});

// ─── Serve Built Frontend in Production / Standalone Mode ───
const clientDistPath = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// ─── Global Error Handler ───
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await initDb();
    await seedDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 Timetable API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();
