const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      gold INTEGER DEFAULT 500000,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      gold_earned INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inventory (
      user_id TEXT,
      item_name TEXT,
      item_type TEXT,
      quantity INTEGER DEFAULT 1,
      PRIMARY KEY (user_id, item_name, item_type)
    );

    CREATE TABLE IF NOT EXISTS equipped (
      user_id TEXT PRIMARY KEY,
      weapon TEXT,
      companion TEXT
    );
  `);
  console.log('✅ PostgreSQL tables ensured.');
}

async function getUserProfile(userId, callback) {
  try {
    const res = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    if (res.rows.length > 0) return callback(null, res.rows[0]);

    await pool.query(`INSERT INTO users (user_id, gold, xp, level, gold_earned)
                  VALUES ($1, DEFAULT, DEFAULT, DEFAULT, DEFAULT)`, [userId]);

    const newUser = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    return callback(null, newUser.rows[0]);
  } catch (err) {
    return callback(err);
  }
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
  pool.query('UPDATE users SET gold = gold + $1, gold_earned = gold_earned + $2 WHERE user_id = $3', [amount, earned, userId]);
}

function addXP(userId, amount) {
  getUserProfile(userId, async (err, user) => {
    if (err) return;
    let newXP = user.xp + amount;
    let newLevel = user.level;
    const xpForNextLevel = lvl => 100 + lvl * 20;

    while (newXP >= xpForNextLevel(newLevel)) {
      newXP -= xpForNextLevel(newLevel);
      newLevel++;
    }

    await pool.query('UPDATE users SET xp = $1, level = $2 WHERE user_id = $3', [newXP, newLevel, userId]);
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
  pool.query('SELECT user_id, gold FROM users ORDER BY gold DESC LIMIT 10', [], (err, result) => {
    callback(err, result?.rows || []);
  });
}

function addToInventory(userId, itemName, itemType) {
  pool.query(`INSERT INTO inventory (user_id, item_name, item_type, quantity)
              VALUES ($1, $2, $3, 1)
              ON CONFLICT (user_id, item_name, item_type)
              DO UPDATE SET quantity = inventory.quantity + 1`,
    [userId, itemName, itemType]);
}

function getInventory(userId, callback) {
  pool.query('SELECT item_name, item_type, quantity FROM inventory WHERE user_id = $1', [userId], (err, result) => {
    callback(err, result?.rows || []);
  });
}

function equipItem(userId, itemName, itemType) {
  const column = itemType === 'weapon' ? 'weapon' : 'companion';
  pool.query(`INSERT INTO equipped (user_id, ${column}) VALUES ($1, $2)
              ON CONFLICT (user_id) DO UPDATE SET ${column} = EXCLUDED.${column}`,
    [userId, itemName]);
}

function getEquipped(userId, callback) {
  pool.query('SELECT weapon, companion FROM equipped WHERE user_id = $1', [userId], (err, result) => {
    callback(err, result?.rows[0]);
  });
}

function consumeEquippedItems(userId) {
  getEquipped(userId, (err, row) => {
    if (!row) return;
    if (row.weapon) {
      pool.query(`UPDATE inventory SET quantity = quantity - 1 WHERE user_id = $1 AND item_name = $2 AND item_type = 'weapon'`, [userId, row.weapon]);
    }
    if (row.companion) {
      pool.query(`UPDATE inventory SET quantity = quantity - 1 WHERE user_id = $1 AND item_name = $2 AND item_type = 'companion'`, [userId, row.companion]);
    }
  });
}

function assignTemporaryLoadout(userId, weapon, companion) {
  pool.query(`INSERT INTO equipped (user_id, weapon, companion) VALUES ($1, $2, $3)
              ON CONFLICT (user_id) DO UPDATE SET weapon = EXCLUDED.weapon, companion = EXCLUDED.companion`,
    [userId, weapon, companion]);
}

function addWeapon(userId, weaponId) {
  addToInventory(userId, weaponId, 'weapon');
}

function addCompanion(userId, companionId) {
  addToInventory(userId, companionId, 'companion');
}

module.exports = {
  initDatabase,
  addWeapon,
  addCompanion,
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
