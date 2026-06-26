package models

import "time"

// File mirrors a row in the `files` table — METADATA only, never the bytes.
//
//   - ID is a server-generated UUID that doubles as the blob's filename on disk.
//   - UserID is hidden from JSON (`json:"-"`): the client already knows it's
//     theirs, and we never want ownership info leaking into responses.
//   - OriginalName is the human-facing name; it is display data, never used to
//     build a filesystem path.
type File struct {
	ID           string    `json:"id"`
	UserID       string    `json:"-"`
	OriginalName string    `json:"name"`
	MimeType     string    `json:"mime_type"`
	SizeBytes    int64     `json:"size_bytes"`
	CreatedAt    time.Time `json:"created_at"`
}
