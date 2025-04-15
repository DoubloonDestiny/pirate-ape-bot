// db.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./pirate_bot.db');

// Initialize the database
function initDatabase() {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    userId TEXT PRIMARY KEY,
    gold INTEGER DEFAULT 0,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1
  )`);
}

// Get or create user profile
function getUserProfile(userId, callback) {
  db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, row) => {
    if (err) return callback(err);

    if (row) {
      callback(null, row);
    } else {
      db.run('INSERT INTO users (userId, gold, xp, level) VALUES (?, ?, ?, ?)', [userId, 0, 0, 1], (err) => {
        if (err) return callback(err);
        callback(null, { userId, gold: 0, xp: 0, level: 1 });
      });
    }
  });
}

// Add or remove gold
function addGold(userId, amount, callback = () => {}) {
  getUserProfile(userId, (err, user) => {
    if (err) return callback(err);
    const newGold = user.gold + amount;
    db.run('UPDATE users SET gold = ? WHERE userId = ?', [newGold, userId], callback);
  });
}

// Admin control: set gold to a specific value
function setGold(userId, value, callback = () => {}) {
  db.run('UPDATE users SET gold = ? WHERE userId = ?', [value, userId], callback);
}

// Add XP and check level up
function addXP(userId, amount, callback = () => {}) {
  getUserProfile(userId, (err, user) => {
    if (err) return callback(err);
    let newXP = user.xp + amount;
    let newLevel = user.level;
    let xpNeeded = 15 + newLevel * newLevel * 1.5;

    while (newXP >= xpNeeded) {
      newXP -= xpNeeded;
      newLevel++;
      xpNeeded = 15 + newLevel * newLevel * 1.5;
    }

    db.run('UPDATE users SET xp = ?, level = ? WHERE userId = ?', [newXP, newLevel, userId], callback);
  });
}

// Retrieve current level
function getLevel(userId, callback) {
  getUserProfile(userId, (err, user) => {
    if (err) return callback(err);
    callback(null, user.level);
  });
}

// Retrieve current balance
function getGold(userId, callback) {
  getUserProfile(userId, (err, user) => {
    if (err) return callback(err);
    callback(null, user.gold);
  });
}

// Calculate gold boost based on level (2% per 10 levels)
function getGoldBoost(level) {
  return Math.floor(level / 10) * 2;
}

// Generate XP progress bar for current level
function getXPProgressBar(currentXP, level) {
  const xpNeeded = 15 + level * level * 1.5;
  const percentage = Math.min((currentXP / xpNeeded) * 100, 100);
  const filled = Math.round(percentage / 10);
  const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);
  return `${bar} (${currentXP}/${Math.round(xpNeeded)} XP)`;
}

// Get user title based on level
function getTitle(level) {
  if (level >= 100) return "Legendary Gambler";
  if (level >= 90) return "Dice Dreadnought";
  if (level >= 80) return "Slot Machine Siren";
  if (level >= 70) return "High Roller Buccaneer";
  if (level >= 60) return "The Kraken Gambler";
  if (level >= 50) return "Jackpot Admiral";
  if (level >= 40) return "Captain of the Cards";
  if (level >= 30) return "First Mate of Fortune";
  if (level >= 20) return "Roulette Raider";
  if (level >= 10) return "Lucky Deckhand";
  return "Swabby";
}

module.exports = {
  initDatabase,
  getUserProfile,
  addGold,
  setGold,
  addXP,
  getLevel,
  getGold,
  getGoldBoost,
  getXPProgressBar,
  getTitle
};
