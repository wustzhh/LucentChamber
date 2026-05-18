import Database from 'better-sqlite3'
import { join } from 'path'
import * as bcrypt from 'bcryptjs'

export function initDB(dataDir: string): Database.Database {
  const db = new Database(join(dataDir, 'users.db'))
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
  return db
}

export function getUser(db: Database.Database, username: string, password: string) {
  const row = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username) as any
  if (!row) return null
  if (!bcrypt.compareSync(password, row.password_hash)) return null
  return { id: row.id, username: row.username }
}

export function createUser(db: Database.Database, username: string, password: string) {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existing) return { success: false, error: '用户名已存在' }
  const hash = bcrypt.hashSync(password, 10)
  const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash)
  return { success: true, userId: result.lastInsertRowid }
}
