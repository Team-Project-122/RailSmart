/**
 * RailSmart Main Server Entry Point (src/index.js)
 * Node.js / Express Server + Socket.io + Database Bootstrapper
 */

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const config = require('./config');
const { seedDatabase } = require('./db/seed');
const { query } = require('./db');
const { setupSocketHandlers } = require('./socket/socketHandler');
const simulator = require('./services/simulator');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);

// Enable CORS for modern web frontend & dev ports
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// Root health & meta endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'RailSmart Decision Support Backend',
    version: '1.0.0',
    honesty_declaration: 'Signal aspects, dynamic platforms, and block track occupancy are rule-derived simulated subsystems. Real live data ingested from RailRadar and OpenWeatherMap APIs.'
  });
});

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

setupSocketHandlers(io);

// Auto-seed database if empty
const countStations = query('SELECT count(*) as count FROM stations')[0]?.count || 0;
if (countStations === 0) {
  console.log('[Bootstrap] Empty database detected. Auto-seeding Golden Corridor topology...');
  seedDatabase();
}

// Start Simulator with Socket.io reference
simulator.init(io);

// Start HTTP Server
server.listen(config.PORT, () => {
  console.log(`================================================================`);
  console.log(`  RAILSMART TRAIN TRAFFIC DECISION SUPPORT BACKEND RUNNING      `);
  console.log(`  HTTP API:        http://localhost:${config.PORT}/api         `);
  console.log(`  Health Check:    http://localhost:${config.PORT}/health      `);
  console.log(`  Socket.io:       ws://localhost:${config.PORT}              `);
  console.log(`  Rule Engine URL: ${config.RULE_ENGINE_URL}                   `);
  console.log(`================================================================`);
});
