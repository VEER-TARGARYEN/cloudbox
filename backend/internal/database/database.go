package database

import (
	"database/sql"
	_ "embed"
	"fmt"
	"time"

	_ "modernc.org/sqlite" // pure-Go SQLite driver (no CGO / C compiler needed)
)

// schemaSQL holds the contents of schema.sql, baked into the compiled binary
// at build time via go:embed. The deployed server therefore has no external
// file dependency to create its tables.
//
//go:embed schema.sql
var schemaSQL string

// Open opens (or creates) the SQLite database at dbPath, tunes it for safe
// server use, applies the schema, and returns a ready-to-use *sql.DB.
//
// Note: *sql.DB is a CONNECTION POOL, not a single connection. It is safe to
// share across all your goroutines/handlers — you open it once in main().
func Open(dbPath string) (*sql.DB, error) {
	// The DSN enables three pragmas at connection time:
	//   busy_timeout(5000) -> wait up to 5s for a lock instead of failing
	//                         immediately with "database is locked"
	//   journal_mode(WAL)  -> Write-Ahead Logging: readers and the writer no
	//                         longer block each other (essential for a server)
	//   foreign_keys(ON)   -> actually enforce the FK constraints in schema.sql
	dsn := fmt.Sprintf(
		"file:%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)",
		dbPath,
	)

	// Driver name is "sqlite" (registered by the modernc.org/sqlite import above).
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	// SQLite serializes writes (only one writer at a time). The simplest way to
	// completely avoid "database is locked" errors is to cap the pool at a
	// single connection, which serializes ALL access. For a personal-scale app
	// this is plenty fast. To scale reads later, you'd add a separate read-only
	// pool (MaxOpenConns > 1) against the same WAL database — a good interview
	// talking point on SQLite concurrency.
	db.SetMaxOpenConns(1)
	db.SetConnMaxLifetime(time.Hour)

	// sql.Open is lazy and does not actually connect. Ping forces a real
	// connection so we fail fast at startup if the path/permissions are wrong.
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping database: %w", err)
	}

	// Apply the schema. Safe to run on every boot (all statements are
	// IF NOT EXISTS).
	if _, err := db.Exec(schemaSQL); err != nil {
		return nil, fmt.Errorf("apply schema: %w", err)
	}

	return db, nil
}
