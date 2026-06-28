package config

import (
	"os"
	"strconv"
	"strings"
)

// Config holds every tunable the server needs. We read it once at startup so
// the rest of the codebase depends on plain values instead of calling
// os.Getenv from scattered places (easier to test, easier to reason about).
type Config struct {
	Port           string // HTTP port, e.g. "8080"
	DatabaseURL    string // path to the SQLite metadata file
	StorageDir     string // directory on disk where file blobs are written
	JWTSecret      string   // signing key for auth tokens
	MaxUploadBytes int64    // largest single upload we accept (bytes)
	FSAllowRoots   []string // restrict host filesystem access to these roots (empty = all)
	FSReadOnly     bool     // disable writes to the host filesystem

	// Optional cloud-broker link (device pairing). All four must be set to enable.
	BrokerURL      string
	BrokerEmail    string
	BrokerPassword string
	PublicURL      string // this laptop's current public (tunnel) URL
	DeviceName     string
	SetupPort      string // loopback port for the local setup UI
}

// Load reads configuration from environment variables, falling back to sane
// local-development defaults when a variable is unset.
func Load() Config {
	// Load ./.env first (if present) so local dev can keep a stable JWT_SECRET
	// etc. Real environment variables always win, so production (Render/Docker)
	// is unaffected.
	loadDotEnv(".env")

	return Config{
		Port:           getenv("PORT", "8080"),
		DatabaseURL:    getenv("DATABASE_URL", "./data/cloudbox.db"),
		StorageDir:     getenv("STORAGE_DIR", "./storage"),
		JWTSecret:      getenv("JWT_SECRET", "dev-only-insecure-secret-change-me"),
		MaxUploadBytes: getenvInt64("MAX_UPLOAD_BYTES", 2<<30), // 2 GiB
		FSAllowRoots:   getenvList("FS_ALLOW_ROOTS"),
		FSReadOnly:     getenvBool("FS_READONLY", false),
		BrokerURL:      getenv("BROKER_URL", "https://cloudbox-broker.onrender.com"),
		BrokerEmail:    getenv("BROKER_EMAIL", ""),
		BrokerPassword: getenv("BROKER_PASSWORD", ""),
		PublicURL:      getenv("PUBLIC_URL", ""),
		DeviceName:     getenv("DEVICE_NAME", ""),
		SetupPort:      getenv("SETUP_PORT", "8765"),
	}
}

// getenvList parses a comma-separated env var into a slice (empty if unset).
func getenvList(key string) []string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return nil
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// getenvBool parses key as a boolean ("1", "true", "yes" → true).
func getenvBool(key string, fallback bool) bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	switch v {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
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

// loadDotEnv reads simple KEY=VALUE lines from path into the process
// environment, WITHOUT overriding variables that are already set (so real env
// vars stay authoritative). A missing file is not an error. Lines starting with
// '#' and blank lines are ignored; surrounding quotes on values are stripped.
func loadDotEnv(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, val, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.Trim(strings.TrimSpace(val), `"'`)
		if _, exists := os.LookupEnv(key); !exists {
			_ = os.Setenv(key, val)
		}
	}
}
