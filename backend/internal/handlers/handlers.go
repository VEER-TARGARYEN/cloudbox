package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/VEER-TARGARYEN/cloudbox/backend/internal/auth"
	"github.com/VEER-TARGARYEN/cloudbox/backend/internal/fsbrowser"
	"github.com/VEER-TARGARYEN/cloudbox/backend/internal/storage"
)

// BrokerVerifier validates a phone's broker token and returns its account ID.
// Implemented by brokerlink.Auth; nil when this server isn't broker-linked.
type BrokerVerifier interface {
	Verify(token string) (string, error)
}

// Handler holds the dependencies every route needs. Route handlers are METHODS
// on this struct, so they get their dependencies without reaching for
// package-level globals — easy to test, easy to follow.
type Handler struct {
	DB             *sql.DB
	Tokens         *auth.TokenService
	Store          *storage.Store     // file-blob persistence on disk
	FS             *fsbrowser.Browser // real-filesystem browsing
	Broker         BrokerVerifier     // optional cloud-broker token introspection
	MaxUploadBytes int64              // per-upload size ceiling
}

// New constructs a Handler.
func New(db *sql.DB, tokens *auth.TokenService, store *storage.Store, fs *fsbrowser.Browser, maxUpload int64) *Handler {
	return &Handler{
		DB:             db,
		Tokens:         tokens,
		Store:          store,
		FS:             fs,
		MaxUploadBytes: maxUpload,
	}
}

// Health reports service + database status (moved here from main.go so all
// routes live in one place).
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	status := "ok"
	if err := h.DB.PingContext(r.Context()); err != nil {
		status = "degraded"
	}
	respondJSON(w, http.StatusOK, map[string]string{
		"status":  status,
		"service": "cloudbox-api",
		"time":    time.Now().UTC().Format(time.RFC3339),
	})
}

// respondJSON writes any value as a JSON response with the given status code.
func respondJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

// respondError writes a JSON error body: {"error": "..."}.
func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}
