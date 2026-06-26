package models

import "time"

// User mirrors a row in the `users` table.
//
// Note the tag on PasswordHash: `json:"-"` means this field is NEVER included
// when we serialize a User to JSON. That's defense-in-depth — even if we
// accidentally pass a fully-populated User to a response, the hash can't leak.
type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}
