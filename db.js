const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./pirateape.db');

function initDatabase() {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    gold INTEGER DEFAULT 10000,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1
  )`);
}

function getUserProfile(userId, callback) {
  db.get(`SELECT * FROM users WHERE user_id = ?`, [userId], (err, row) => {
    if (err) return callback(err);
    if (row) return callback(null, row);

    db.run(`INSERT INTO users (user_id) VALUES (?)`, [userId], function (err) {
      if (err) return callback(err);
      getUserProfile(userId, callback);
    });
  });
}

function addGold(userId, amount) {
  db.run(`UPDATE users SET gold = gold + ? WHERE user_id = ?`, [amount, userId]);
}

function addXP(userId, amount) {
  getUserProfile(userId, (err, user) => {
    if (err) return;
    let newXP = user.xp + amount;
    let newLevel = user.level;

    const xpForNextLevel = lvl => 100 + lvl * 20;

    while (newXP >= xpForNextLevel(newLevel)) {
      newXP -= xpForNextLevel(newLevel);
      newLevel++;
    }

    db.run(`UPDATE users SET xp = ?, level = ? WHERE user_id = ?`, [newXP, newLevel, userId]);
  });
}

function getXPProgressBar(xp, level) {
  const nextLevelXP = 100 + level * 20;
  const percent = Math.floor((xp / nextLevelXP) * 100);
  const filled = Math.floor(percent / 10);
  const empty = 10 - filled;
  return '🟩'.repeat(filled) + '⬛'.repeat(empty) + ` (${xp}/${nextLevelXP})`;
}

function getTitle(level) {
  if (level >= 100) return "Legendary Pirate Gambler 🧙‍♂️";
  if (level >= 90) return "Dice Dreadnought 🎲";
  if (level >= 80) return "Slot Machine Siren 🎰";
  if (level >= 70) return "High Roller Buccaneer 🏴‍☠️";
  if (level >= 60) return "The Kraken Gambler 🐙";
  if (level >= 50) return "Jackpot Admiral 💰";
  if (level >= 40) return "Captain of the Cards 🃏";
  if (level >= 30) return "First Mate of Fortune ⚓";
  if (level >= 20) return "Roulette Raider 🎯";
  if (level >= 10) return "Lucky Deckhand 🍀";
  return "🪙 Swabby";
}

function getGoldBoost(level) {
    return Math.min(25, level * 0.25);
  }
  

function getLeaderboard(callback) {
  db.all(`SELECT user_id, gold FROM users ORDER BY gold DESC LIMIT 10`, [], (err, rows) => {
    callback(err, rows);
  });
}

module.exports = {
  initDatabase,
  getUserProfile,
  addGold,
  addXP,
  getXPProgressBar,
  getTitle,
  getGoldBoost,
  getLeaderboard
};
