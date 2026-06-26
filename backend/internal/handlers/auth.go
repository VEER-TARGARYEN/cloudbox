package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	sqlitedrv "modernc.org/sqlite"
	sqlite3 "modernc.org/sqlite/lib"

	"github.com/VEER-TARGARYEN/cloudbox/backend/internal/auth"
	appmw "github.com/VEER-TARGARYEN/cloudbox/backend/internal/middleware"
	"github.com/VEER-TARGARYEN/cloudbox/backend/internal/models"
)

// credentials is the shared request body for /register and /login.
type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// authResponse is returned on a successful register/login: the JWT plus the
// public view of the user (no password hash — see models.User's json tags).
type authResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

// Register creates a new account, stores a bcrypt hash of the password, and
// returns a signed JWT so the client is logged in immediately.
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var body credentials
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	email := strings.ToLower(strings.TrimSpace(body.Email))
	if email == "" || !strings.Contains(email, "@") {
		respondError(w, http.StatusBadRequest, "a valid email is required")
		return
	}
	// bcrypt rejects inputs longer than 72 bytes; enforce a sane range up front
	// so we return a clean 400 instead of a 500.
	if len(body.Password) < 8 || len(body.Password) > 72 {
		respondError(w, http.StatusBadRequest, "password must be 8-72 characters")
		return
	}

	hash, err := auth.HashPassword(body.Password)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "could not process password")
		return
	}

	user := models.User{
		ID:        uuid.NewString(),
		Email:     email,
		CreatedAt: time.Now().UTC(),
	}

	_, err = h.DB.ExecContext(r.Context(),
		`INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)`,
		user.ID, user.Email, hash, user.CreatedAt,
	)
	if err != nil {
		// The UNIQUE index on email turns a duplicate signup into a constraint
		// error, which we surface as a clean 409 Conflict.
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "an account with that email already exists")
			return
		}
		respondError(w, http.StatusInternalServerError, "could not create account")
		return
	}

	token, err := h.Tokens.Generate(user.ID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "could not issue token")
		return
	}

	respondJSON(w, http.StatusCreated, authResponse{Token: token, User: user})
}

// Login verifies an email + password and returns a signed JWT.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var body credentials
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))

	var user models.User
	var hash string
	err := h.DB.QueryRowContext(r.Context(),
		`SELECT id, email, password_hash, created_at FROM users WHERE email = ?`,
		email,
	).Scan(&user.ID, &user.Email, &hash, &user.CreatedAt)

	switch {
	case errors.Is(err, sql.ErrNoRows):
		// Unknown email. Run a dummy bcrypt comparison so this path takes the
		// same time as a wrong-password path (no timing oracle), then return the
		// SAME generic message — never reveal whether the email exists.
		auth.DummyPasswordCheck()
		respondError(w, http.StatusUnauthorized, "invalid email or password")
		return
	case err != nil:
		respondError(w, http.StatusInternalServerError, "login failed")
		return
	}

	if !auth.CheckPassword(body.Password, hash) {
		respondError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	token, err := h.Tokens.Generate(user.ID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "could not issue token")
		return
	}
	respondJSON(w, http.StatusOK, authResponse{Token: token, User: user})
}

// Me returns the authenticated user's profile. It lives behind the auth
// middleware, so reaching it at all proves a valid token was presented.
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	userID, ok := appmw.UserIDFromContext(r.Context())
	if !ok {
		respondError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	var user models.User
	err := h.DB.QueryRowContext(r.Context(),
		`SELECT id, email, created_at FROM users WHERE id = ?`,
		userID,
	).Scan(&user.ID, &user.Email, &user.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		respondError(w, http.StatusNotFound, "user not found")
		return
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, "could not load user")
		return
	}
	respondJSON(w, http.StatusOK, user)
}

// isUniqueViolation reports whether err is a SQLite UNIQUE-constraint failure.
// We use the driver's typed error + the official extended result code rather
// than string-matching the message, which is brittle across versions.
func isUniqueViolation(err error) bool {
	var sqlErr *sqlitedrv.Error
	if errors.As(err, &sqlErr) {
		return sqlErr.Code() == sqlite3.SQLITE_CONSTRAINT_UNIQUE
	}
	return false
}
