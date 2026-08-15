const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

const dbPath = path.resolve(__dirname, '../../railsmart.sqlite');
const db = new Database(dbPath);

// Enable WAL mode for high performance concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
const schemaPath = path.join(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
}

module.exports = {
  db,
  query(sql, params = []) {
    return db.prepare(sql).all(params);
  },
  get(sql, params = []) {
    return db.prepare(sql).get(params);
  },
  run(sql, params = []) {
    return db.prepare(sql).run(params);
  }
};
