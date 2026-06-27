// Package store is the broker's SQLite persistence: accounts + devices.
package store

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	sqlitedrv "modernc.org/sqlite"
	sqlite3 "modernc.org/sqlite/lib"
)

var (
	ErrNotFound = errors.New("not found")
	ErrConflict = errors.New("already exists")
)

type Account struct {
	ID           string
	Email        string
	PasswordHash string
	Verified     bool
}

type Device struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	URL      string `json:"url"`
	PairCode string `json:"pair_code,omitempty"`
	LastSeen string `json:"last_seen"` // RFC3339, "" if never seen
}

const schema = `
CREATE TABLE IF NOT EXISTS accounts (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  verified      INTEGER NOT NULL DEFAULT 0,
  verify_token  TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_accounts_email  ON accounts(email);
CREATE INDEX IF NOT EXISTS idx_accounts_verify ON accounts(verify_token);

CREATE TABLE IF NOT EXISTS devices (
  id         TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  name       TEXT NOT NULL,
  url        TEXT NOT NULL DEFAULT '',
  pair_code  TEXT,
  last_seen  INTEGER NOT NULL DEFAULT 0,   -- unix seconds
  created_at INTEGER NOT NULL DEFAULT 0,   -- unix seconds
  FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_devices_account ON devices(account_id);
CREATE INDEX IF NOT EXISTS idx_devices_pair    ON devices(pair_code);
`

type Store struct{ db *sql.DB }

func Open(path string) (*Store, error) {
	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if err := db.Ping(); err != nil {
		return nil, err
	}
	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("apply schema: %w", err)
	}
	return &Store{db: db}, nil
}

func (s *Store) Ping() error { return s.db.Ping() }

func (s *Store) CreateAccount(id, email, passwordHash, verifyToken string) error {
	_, err := s.db.Exec(
		`INSERT INTO accounts (id, email, password_hash, verify_token) VALUES (?, ?, ?, ?)`,
		id, email, passwordHash, verifyToken,
	)
	if isUnique(err) {
		return ErrConflict
	}
	return err
}

func (s *Store) GetAccountByEmail(email string) (Account, error) {
	var a Account
	var verified int
	err := s.db.QueryRow(
		`SELECT id, email, password_hash, verified FROM accounts WHERE email = ?`, email,
	).Scan(&a.ID, &a.Email, &a.PasswordHash, &verified)
	if errors.Is(err, sql.ErrNoRows) {
		return Account{}, ErrNotFound
	}
	a.Verified = verified == 1
	return a, err
}

func (s *Store) GetAccountByID(id string) (Account, error) {
	var a Account
	var verified int
	err := s.db.QueryRow(
		`SELECT id, email, password_hash, verified FROM accounts WHERE id = ?`, id,
	).Scan(&a.ID, &a.Email, &a.PasswordHash, &verified)
	if errors.Is(err, sql.ErrNoRows) {
		return Account{}, ErrNotFound
	}
	a.Verified = verified == 1
	return a, err
}

// VerifyAccount marks the account with the given token verified. Returns
// ErrNotFound if the token doesn't match any account.
func (s *Store) VerifyAccount(token string) error {
	res, err := s.db.Exec(
		`UPDATE accounts SET verified = 1, verify_token = NULL WHERE verify_token = ?`, token,
	)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) RegisterDevice(id, accountID, name, url, pairCode string) error {
	now := time.Now().Unix()
	_, err := s.db.Exec(
		`INSERT INTO devices (id, account_id, name, url, pair_code, last_seen, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, accountID, name, url, pairCode, now, now,
	)
	return err
}

func (s *Store) HeartbeatDevice(accountID, deviceID, url string) error {
	res, err := s.db.Exec(
		`UPDATE devices SET url = ?, last_seen = ? WHERE id = ? AND account_id = ?`,
		url, time.Now().Unix(), deviceID, accountID,
	)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) ListDevices(accountID string) ([]Device, error) {
	rows, err := s.db.Query(
		`SELECT id, name, url, last_seen FROM devices WHERE account_id = ? ORDER BY created_at`,
		accountID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Device, 0)
	for rows.Next() {
		var d Device
		var ls int64
		if err := rows.Scan(&d.ID, &d.Name, &d.URL, &ls); err != nil {
			return nil, err
		}
		d.LastSeen = unixToRFC(ls)
		out = append(out, d)
	}
	return out, rows.Err()
}

// ClaimPair finds the device whose pair code matches and returns its owning
// account ID plus the device (URL included), so the phone can connect.
func (s *Store) ClaimPair(code string) (string, Device, error) {
	var accountID string
	var d Device
	var ls int64
	err := s.db.QueryRow(
		`SELECT account_id, id, name, url, last_seen FROM devices WHERE pair_code = ?`, code,
	).Scan(&accountID, &d.ID, &d.Name, &d.URL, &ls)
	if errors.Is(err, sql.ErrNoRows) {
		return "", Device{}, ErrNotFound
	}
	if err != nil {
		return "", Device{}, err
	}
	d.LastSeen = unixToRFC(ls)
	return accountID, d, nil
}

func unixToRFC(sec int64) string {
	if sec <= 0 {
		return ""
	}
	return time.Unix(sec, 0).UTC().Format(time.RFC3339)
}

func isUnique(err error) bool {
	var se *sqlitedrv.Error
	return errors.As(err, &se) && se.Code() == sqlite3.SQLITE_CONSTRAINT_UNIQUE
}
