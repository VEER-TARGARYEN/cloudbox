package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// TokenService issues and verifies JSON Web Tokens signed with a shared secret
// using HMAC-SHA256 (a symmetric algorithm: the same secret signs and verifies).
type TokenService struct {
	secret []byte
	ttl    time.Duration
}

// NewTokenService builds a TokenService. `secret` must be long and random in
// production; `ttl` is how long an issued token stays valid.
func NewTokenService(secret string, ttl time.Duration) *TokenService {
	return &TokenService{secret: []byte(secret), ttl: ttl}
}

// Claims is the payload embedded in every token. We only need the standard
// registered claims (sub, iat, exp, iss); the user's ID rides in `Subject`.
type Claims struct {
	jwt.RegisteredClaims
}

// Generate creates a signed JWT whose subject (`sub`) is the given user ID.
func (s *TokenService) Generate(userID string) (string, error) {
	now := time.Now()
	claims := Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			Issuer:    "cloudbox",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.ttl)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secret)
}

// Verify parses and validates a token string and returns the user ID it
// carries. It rejects expired tokens, bad signatures, and — critically —
// tokens signed with an unexpected algorithm.
func (s *TokenService) Verify(tokenString string) (string, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (any, error) {
		// SECURITY: pin the signing algorithm. Without this check, an attacker
		// could craft a token with alg "none" (no signature) or swap HMAC for
		// RSA to bypass verification — the classic JWT algorithm-confusion
		// attacks. We only trust HMAC.
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.secret, nil
	})
	if err != nil {
		return "", err
	}
	if !token.Valid {
		return "", errors.New("invalid token")
	}
	if claims.Subject == "" {
		return "", errors.New("token missing subject")
	}
	return claims.Subject, nil
}
