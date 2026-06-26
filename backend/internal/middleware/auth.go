package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/VEER-TARGARYEN/cloudbox/backend/internal/auth"
)

// contextKey is an UNEXPORTED type used only as a context key. Using a private
// custom type (instead of a plain string) guarantees no other package can
// accidentally read or overwrite our value — the standard Go pattern for
// context keys.
type contextKey string

const userIDKey contextKey = "userID"

// Authenticator returns middleware that enforces a valid Bearer token. On
// success it stores the authenticated user's ID in the request context and
// calls the next handler; on any failure it short-circuits with 401 and the
// inner handler never runs.
func Authenticator(tokens *auth.TokenService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if header == "" {
				unauthorized(w, "missing authorization header")
				return
			}

			// Expect the format: "Bearer <token>"
			scheme, tokenStr, found := strings.Cut(header, " ")
			if !found || !strings.EqualFold(scheme, "Bearer") || tokenStr == "" {
				unauthorized(w, "malformed authorization header")
				return
			}

			userID, err := tokens.Verify(tokenStr)
			if err != nil {
				unauthorized(w, "invalid or expired token")
				return
			}

			// Hand the verified identity downstream via context. Every protected
			// handler reads it with UserIDFromContext — this is the single source
			// of truth for "who is making this request".
			ctx := context.WithValue(r.Context(), userIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserIDFromContext returns the authenticated user ID placed in the context by
// Authenticator. ok is false if the request never passed through the
// middleware (i.e. an unauthenticated route).
func UserIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(userIDKey).(string)
	return id, ok
}

func unauthorized(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_, _ = w.Write([]byte(`{"error":"` + msg + `"}`))
}
