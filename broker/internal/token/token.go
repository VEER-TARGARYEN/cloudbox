// Package token issues and verifies the broker's session JWTs (HS256).
package token

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Service struct {
	secret []byte
	ttl    time.Duration
}

func New(secret string, ttl time.Duration) *Service {
	return &Service{secret: []byte(secret), ttl: ttl}
}

type claims struct {
	jwt.RegisteredClaims
}

// Generate returns a signed token whose subject is the account ID.
func (s *Service) Generate(accountID string) (string, error) {
	now := time.Now()
	c := claims{RegisteredClaims: jwt.RegisteredClaims{
		Subject:   accountID,
		Issuer:    "cloudbox-broker",
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(s.ttl)),
	}}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(s.secret)
}

// Verify returns the account ID carried by a valid token.
func (s *Service) Verify(tokenStr string) (string, error) {
	c := &claims{}
	tok, err := jwt.ParseWithClaims(tokenStr, c, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.secret, nil
	})
	if err != nil {
		return "", err
	}
	if !tok.Valid || c.Subject == "" {
		return "", errors.New("invalid token")
	}
	return c.Subject, nil
}
