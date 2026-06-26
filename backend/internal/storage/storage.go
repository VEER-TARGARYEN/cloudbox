package storage

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// Store reads and writes file blobs on the local hard drive. It is the ONLY
// part of the system that touches the filesystem for user content, which keeps
// our security boundary in one place.
//
// The golden rule enforced here: the on-disk filename is ALWAYS a
// server-generated UUID (the file's ID), never anything derived from user
// input. That single fact is what makes directory-traversal attacks
// (e.g. a "filename" of "../../etc/passwd") impossible.
type Store struct {
	dir string
}

// New returns a Store rooted at dir (e.g. "./storage").
func New(dir string) *Store {
	return &Store{dir: dir}
}

// path maps a file ID to its absolute location on disk. filepath.Base is a
// belt-and-suspenders defense: even if a malformed id with slashes ever reached
// us, Base strips everything but the final element, so the result can never
// escape the storage directory.
func (s *Store) path(id string) string {
	return filepath.Join(s.dir, filepath.Base(id))
}

// Save streams everything from src into a new blob named after id and returns
// the number of bytes written.
//
// io.Copy moves data in small fixed-size chunks (32 KiB by default), so even a
// multi-gigabyte upload uses only kilobytes of RAM — we never hold the whole
// file in memory.
func (s *Store) Save(id string, src io.Reader) (int64, error) {
	dst, err := os.Create(s.path(id))
	if err != nil {
		return 0, fmt.Errorf("create blob: %w", err)
	}
	defer dst.Close()

	n, err := io.Copy(dst, src)
	if err != nil {
		// Roll back the partially written file so a failed upload leaves no junk.
		_ = os.Remove(s.path(id))
		return 0, fmt.Errorf("write blob: %w", err)
	}
	return n, nil
}

// Open returns a readable handle to the blob for id. The caller MUST Close it.
// The returned *os.File is an io.ReadSeeker, which lets the download handler
// stream it (and, if we upgrade later, support HTTP range requests).
func (s *Store) Open(id string) (*os.File, error) {
	return os.Open(s.path(id))
}

// Remove deletes the blob for id. Returns nil if the file is already gone.
func (s *Store) Remove(id string) error {
	err := os.Remove(s.path(id))
	if os.IsNotExist(err) {
		return nil
	}
	return err
}
