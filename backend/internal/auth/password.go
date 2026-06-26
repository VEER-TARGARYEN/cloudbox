package auth

import "golang.org/x/crypto/bcrypt"

// dummyHash is a precomputed bcrypt hash. We compare against it during login
// when the submitted email doesn't exist, so that "no such user" and "wrong
// password" take roughly the same amount of time. That defeats timing-based
// account enumeration (an attacker timing responses to discover which emails
// are registered).
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("timing-equalizer"), bcrypt.DefaultCost)

// HashPassword returns the bcrypt hash of a plaintext password.
//
// bcrypt automatically generates a random salt and embeds it in the output,
// so two users with the same password get different hashes (no rainbow-table
// attacks). bcrypt.DefaultCost (=10) is the work factor — raise it to make
// hashing slower and brute-force harder as hardware improves.
func HashPassword(plaintext string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(plaintext), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// CheckPassword reports whether plaintext matches the stored bcrypt hash.
// bcrypt re-derives the hash using the salt embedded in `hash` and compares
// in constant time, so this is safe against timing attacks on the hash itself.
func CheckPassword(plaintext, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plaintext)) == nil
}

// DummyPasswordCheck burns roughly the same CPU as a real CheckPassword call.
// Call it on the unknown-email branch of login to equalize response timing.
func DummyPasswordCheck() {
	_ = bcrypt.CompareHashAndPassword(dummyHash, []byte("timing-equalizer"))
}
