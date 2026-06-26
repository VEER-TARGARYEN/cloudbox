package config

import (
	"os"
	"strconv"
)

// Config holds every tunable the server needs. We read it once at startup so
// the rest of the codebase depends on plain values instead of calling
// os.Getenv from scattered places (easier to test, easier to reason about).
type Config struct {
	Port           string // HTTP port, e.g. "8080"
	DatabaseURL    string // path to the SQLite metadata file
	StorageDir     string // directory on disk where file blobs are written
	JWTSecret      string // signing key for auth tokens
	MaxUploadBytes int64  // largest single upload we accept (bytes)
}

// Load reads configuration from environment variables, falling back to sane
// local-development defaults when a variable is unset.
func Load() Config {
	return Config{
		Port:           getenv("PORT", "8080"),
		DatabaseURL:    getenv("DATABASE_URL", "./data/cloudbox.db"),
		StorageDir:     getenv("STORAGE_DIR", "./storage"),
		JWTSecret:      getenv("JWT_SECRET", "dev-only-insecure-secret-change-me"),
		MaxUploadBytes: getenvInt64("MAX_UPLOAD_BYTES", 2<<30), // 2 GiB
	}
}

// getenv returns the value of key, or fallback if the variable is empty/unset.
func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// getenvInt64 parses key as an int64, returning fallback if unset or invalid.
func getenvInt64(key string, fallback int64) int64 {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n
		}
	}
	return fallback
}
