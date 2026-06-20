// Auth service - JWT + team password validation
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

function getTeamEmails() {
  const env = process.env.TEAM_EMAILS || '';
  return env.split(',').map(e => e.trim()).filter(e => e);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function generateJWT(payload, expiresIn = '24h') {
  return jwt.sign(payload, process.env.TEAM_JWT_SECRET, { expiresIn, algorithm: 'HS256' });
}

function verifyJWT(token) {
  return jwt.verify(token, process.env.TEAM_JWT_SECRET, { algorithms: ['HS256'] });
}

module.exports = { getTeamEmails, verifyPassword, generateJWT, verifyJWT };