// Package broker is the cloud directory service: verified accounts + a registry
// of where each account's laptop currently is (its tunnel URL).
package broker

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/VEER-TARGARYEN/cloudbox/broker/internal/mailer"
	"github.com/VEER-TARGARYEN/cloudbox/broker/internal/store"
	"github.com/VEER-TARGARYEN/cloudbox/broker/internal/token"
)

type Server struct {
	Store  *store.Store
	Tokens *token.Service
	Mailer *mailer.Mailer
}

func New(st *store.Store, tk *token.Service, ml *mailer.Mailer) *Server {
	return &Server{Store: st, Tokens: tk, Mailer: ml}
}

func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()
	r.Use(chimw.RequestID, chimw.RealIP, chimw.Logger, chimw.Recoverer)

	// Public
	r.Get("/health", s.health)
	r.Post("/accounts/register", s.register)
	r.Get("/accounts/verify", s.verify)
	r.Post("/accounts/login", s.login)
	r.Post("/pair/claim", s.pairClaim) // phone scans QR → exchanges code for a session

	// Authenticated (broker session token)
	r.Group(func(pr chi.Router) {
		pr.Use(s.auth)
		pr.Get("/accounts/me", s.me)                     // token introspection (laptop uses this)
		pr.Post("/devices", s.deviceRegister)            // laptop announces itself
		pr.Post("/devices/{id}/heartbeat", s.deviceBeat) // laptop updates its URL
		pr.Get("/devices", s.deviceList)                 // phone lists linked laptops
	})
	return r
}

// ── auth middleware ─────────────────────────────────────────────────────────
type ctxKey string

const accountKey ctxKey = "accountID"

func (s *Server) auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		scheme, tok, found := strings.Cut(r.Header.Get("Authorization"), " ")
		if !found || !strings.EqualFold(scheme, "Bearer") || tok == "" {
			respondError(w, http.StatusUnauthorized, "missing bearer token")
			return
		}
		acc, err := s.Tokens.Verify(tok)
		if err != nil {
			respondError(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), accountKey, acc)))
	})
}

func accountID(r *http.Request) string {
	v, _ := r.Context().Value(accountKey).(string)
	return v
}

// ── handlers ────────────────────────────────────────────────────────────────
type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	status := "ok"
	if err := s.Store.Ping(); err != nil {
		status = "degraded"
	}
	respondJSON(w, http.StatusOK, map[string]string{
		"status": status, "service": "cloudbox-broker",
		"time": time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var b credentials
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		respondError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	email := strings.ToLower(strings.TrimSpace(b.Email))
	if !strings.Contains(email, "@") {
		respondError(w, http.StatusBadRequest, "a valid email is required")
		return
	}
	if len(b.Password) < 8 || len(b.Password) > 72 {
		respondError(w, http.StatusBadRequest, "password must be 8-72 characters")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(b.Password), bcrypt.DefaultCost)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "could not process password")
		return
	}
	verifyTok := uuid.NewString()
	if err := s.Store.CreateAccount(uuid.NewString(), email, string(hash), verifyTok); err != nil {
		if errors.Is(err, store.ErrConflict) {
			respondError(w, http.StatusConflict, "an account with that email already exists")
			return
		}
		respondError(w, http.StatusInternalServerError, "could not create account")
		return
	}
	s.Mailer.SendVerification(email, verifyTok)
	respondJSON(w, http.StatusCreated, map[string]string{
		"message": "Account created. Check your email to verify it.",
	})
}

func (s *Server) verify(w http.ResponseWriter, r *http.Request) {
	tok := r.URL.Query().Get("token")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if tok == "" || s.Store.VerifyAccount(tok) != nil {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte("<h2>Invalid or expired verification link.</h2>"))
		return
	}
	_, _ = w.Write([]byte("<h2>✓ Your CloudBox account is verified.</h2><p>You can now sign in from the app.</p>"))
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var b credentials
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		respondError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	email := strings.ToLower(strings.TrimSpace(b.Email))
	acc, err := s.Store.GetAccountByEmail(email)
	if errors.Is(err, store.ErrNotFound) ||
		(err == nil && bcrypt.CompareHashAndPassword([]byte(acc.PasswordHash), []byte(b.Password)) != nil) {
		respondError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, "login failed")
		return
	}
	if !acc.Verified {
		respondError(w, http.StatusForbidden, "please verify your email first")
		return
	}
	tok, err := s.Tokens.Generate(acc.ID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "could not issue token")
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"token":   tok,
		"account": map[string]string{"id": acc.ID, "email": acc.Email},
	})
}

// me returns the account behind the bearer token — used by a laptop to validate
// a phone's broker token (token introspection).
func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	acc, err := s.Store.GetAccountByID(accountID(r))
	if err != nil {
		respondError(w, http.StatusNotFound, "account not found")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": acc.ID, "email": acc.Email})
}

type deviceReq struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

func (s *Server) deviceRegister(w http.ResponseWriter, r *http.Request) {
	var b deviceReq
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		respondError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	name := strings.TrimSpace(b.Name)
	if name == "" {
		name = "My Laptop"
	}
	id := uuid.NewString()
	pair := strings.ReplaceAll(uuid.NewString(), "-", "")[:12]
	if err := s.Store.RegisterDevice(id, accountID(r), name, strings.TrimSpace(b.URL), pair); err != nil {
		respondError(w, http.StatusInternalServerError, "could not register device")
		return
	}
	respondJSON(w, http.StatusCreated, map[string]string{"device_id": id, "pair_code": pair})
}

func (s *Server) deviceBeat(w http.ResponseWriter, r *http.Request) {
	var b deviceReq
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		respondError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	err := s.Store.HeartbeatDevice(accountID(r), chi.URLParam(r, "id"), strings.TrimSpace(b.URL))
	if errors.Is(err, store.ErrNotFound) {
		respondError(w, http.StatusNotFound, "device not found")
		return
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, "heartbeat failed")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) deviceList(w http.ResponseWriter, r *http.Request) {
	devs, err := s.Store.ListDevices(accountID(r))
	if err != nil {
		respondError(w, http.StatusInternalServerError, "could not list devices")
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"devices": devs})
}

type claimReq struct {
	Code string `json:"code"`
}

func (s *Server) pairClaim(w http.ResponseWriter, r *http.Request) {
	var b claimReq
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		respondError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	code := strings.TrimSpace(b.Code)
	if code == "" {
		respondError(w, http.StatusBadRequest, "missing pairing code")
		return
	}
	acc, dev, err := s.Store.ClaimPair(code)
	if errors.Is(err, store.ErrNotFound) {
		respondError(w, http.StatusNotFound, "invalid pairing code")
		return
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, "pairing failed")
		return
	}
	tok, err := s.Tokens.Generate(acc)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "could not issue token")
		return
	}
	dev.PairCode = ""
	respondJSON(w, http.StatusOK, map[string]any{"token": tok, "device": dev})
}

// ── helpers ─────────────────────────────────────────────────────────────────
func respondJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}
