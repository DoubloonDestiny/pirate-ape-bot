const sqlite3 = require('sqlite3').verbose();

// Use explicit absolute path to shared DB
const db = new sqlite3.Database('C:/Users/babyd/Desktop/pirate-ape-bot/pirate-ape-bot/pirateape.db');

function initDatabase() {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    gold INTEGER DEFAULT 10000,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    wins INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    kills INTEGER DEFAULT 0,
    gold_earned INTEGER DEFAULT 0,
    weapon_usage TEXT DEFAULT '{}',
    companion_usage TEXT DEFAULT '{}'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inventory (
    user_id TEXT,
    item_name TEXT,
    item_type TEXT,
    quantity INTEGER DEFAULT 1,
    PRIMARY KEY (user_id, item_name, item_type)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS equipped (
    user_id TEXT PRIMARY KEY,
    weapon TEXT,
    companion TEXT
  )`);
}

function getUserProfile(userId, callback) {
  db.get(`SELECT * FROM users WHERE user_id = ?`, [userId], (err, row) => {
    if (err) return callback(err);
    if (row) return callback(null, row);

    db.run(`INSERT INTO users (user_id) VALUES (?)`, [userId], function (err) {
      if (err) return callback(err);
      db.get(`SELECT * FROM users WHERE user_id = ?`, [userId], callback);
    });
  });
}

function getUserProfileAsync(userId) {
  return new Promise((resolve, reject) => {
    getUserProfile(userId, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function addGold(userId, amount) {
  const earned = amount > 0 ? amount : 0;
  db.run(`UPDATE users SET gold = gold + ?, gold_earned = gold_earned + ? WHERE user_id = ?`, [amount, earned, userId]);
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

function addToInventory(userId, itemName, itemType) {
  db.run(`INSERT INTO inventory (user_id, item_name, item_type, quantity)
          VALUES (?, ?, ?, 1)
          ON CONFLICT(user_id, item_name, item_type) DO UPDATE SET quantity = quantity + 1`,
    [userId, itemName, itemType]);
}

function getInventory(userId, callback) {
  db.all(`SELECT item_name, item_type, quantity FROM inventory WHERE user_id = ?`, [userId], (err, rows) => {
    callback(err, rows);
  });
}

function equipItem(userId, itemName, itemType) {
  const column = itemType === 'weapon' ? 'weapon' : 'companion';
  db.run(`INSERT INTO equipped (user_id, ${column}) VALUES (?, ?)
          ON CONFLICT(user_id) DO UPDATE SET ${column} = excluded.${column}`,
    [userId, itemName]);
}

function getEquipped(userId, callback) {
  db.get(`SELECT weapon, companion FROM equipped WHERE user_id = ?`, [userId], (err, row) => {
    callback(err, row);
  });
}

function consumeEquippedItems(userId) {
  db.get(`SELECT weapon, companion FROM equipped WHERE user_id = ?`, [userId], (err, row) => {
    if (!row) return;
    if (row.weapon) {
      db.run(`UPDATE inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_name = ? AND item_type = 'weapon'`, [userId, row.weapon]);
    }
    if (row.companion) {
      db.run(`UPDATE inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_name = ? AND item_type = 'companion'`, [userId, row.companion]);
    }
  });
}

function assignTemporaryLoadout(userId, weapon, companion) {
  db.run(`INSERT INTO equipped (user_id, weapon, companion) VALUES (?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET weapon = excluded.weapon, companion = excluded.companion`,
    [userId, weapon, companion]);
}

function addWeapon(userId, weaponId) {
  addToInventory(userId, weaponId, 'weapon');
}

function addCompanion(userId, companionId) {
  addToInventory(userId, companionId, 'companion');
}

module.exports = {
  addWeapon,
  addCompanion,
  initDatabase,
  getUserProfile,
  getUserProfileAsync,
  addGold,
  addXP,
  getXPProgressBar,
  getTitle,
  getGoldBoost,
  getLeaderboard,
  addToInventory,
  getInventory,
  equipItem,
  getEquipped,
  consumeEquippedItems,
  assignTemporaryLoadout
};
