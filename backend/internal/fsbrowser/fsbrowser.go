// Package fsbrowser provides safe, authenticated access to the host's real
// filesystem (drives, folders, files) for the mobile app's file browser.
package fsbrowser

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"
)

// Browser resolves and lists real filesystem paths under a security policy.
type Browser struct {
	allowRoots []string // cleaned absolute roots; EMPTY means allow everything
	readOnly   bool
}

// New builds a Browser. allowRoots restricts access to those directory trees;
// pass an empty slice to allow the entire filesystem. readOnly disables writes.
func New(allowRoots []string, readOnly bool) *Browser {
	cleaned := make([]string, 0, len(allowRoots))
	for _, r := range allowRoots {
		r = strings.TrimSpace(r)
		if r == "" {
			continue
		}
		if abs, err := filepath.Abs(r); err == nil {
			cleaned = append(cleaned, filepath.Clean(abs))
		}
	}
	return &Browser{allowRoots: cleaned, readOnly: readOnly}
}

func (b *Browser) ReadOnly() bool { return b.readOnly }

// Resolve validates a client-supplied path: it must be absolute, contain no NUL
// byte, and (if allowRoots is set) live inside an allowed root. Returns the
// cleaned absolute path. This is the single choke point that prevents traversal.
func (b *Browser) Resolve(path string) (string, error) {
	if path == "" {
		return "", errors.New("path is required")
	}
	if strings.ContainsRune(path, 0) {
		return "", errors.New("invalid path")
	}
	clean := filepath.Clean(path)
	if !filepath.IsAbs(clean) {
		return "", errors.New("path must be absolute")
	}
	if len(b.allowRoots) == 0 {
		return clean, nil // full-filesystem access
	}

	cmp := clean
	if runtime.GOOS == "windows" {
		cmp = strings.ToLower(clean) // Windows paths are case-insensitive
	}
	for _, root := range b.allowRoots {
		rc := root
		if runtime.GOOS == "windows" {
			rc = strings.ToLower(root)
		}
		if cmp == rc || strings.HasPrefix(cmp, rc+string(os.PathSeparator)) {
			return clean, nil
		}
	}
	return "", errors.New("path is not allowed")
}

// Entry is one item in a directory listing.
type Entry struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	IsDir   bool      `json:"is_dir"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"mod_time"`
}

// List returns the contents of a directory (folders first, then alphabetical).
func (b *Browser) List(path string) ([]Entry, error) {
	dir, err := b.Resolve(path)
	if err != nil {
		return nil, err
	}
	items, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	out := make([]Entry, 0, len(items))
	for _, it := range items {
		info, err := it.Info()
		if err != nil {
			continue // skip entries we can't stat (locked/permission)
		}
		out = append(out, Entry{
			Name:    it.Name(),
			Path:    filepath.Join(dir, it.Name()),
			IsDir:   it.IsDir(),
			Size:    info.Size(),
			ModTime: info.ModTime().UTC(),
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].IsDir != out[j].IsDir {
			return out[i].IsDir // folders first
		}
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	return out, nil
}

// Root is a top-level starting point (a drive or a shortcut folder).
type Root struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

// Roots returns the browser's entry points. With allowRoots set, those are the
// roots; otherwise it returns Home + common folders + every drive (Windows) or
// the filesystem root (Unix).
func (b *Browser) Roots() []Root {
	if len(b.allowRoots) > 0 {
		out := make([]Root, 0, len(b.allowRoots))
		for _, r := range b.allowRoots {
			out = append(out, Root{Name: label(r), Path: r})
		}
		return out
	}

	var roots []Root
	if home, err := os.UserHomeDir(); err == nil {
		roots = append(roots, Root{Name: "Home", Path: home})
		for _, sub := range []string{"Downloads", "Desktop", "Documents"} {
			p := filepath.Join(home, sub)
			if st, err := os.Stat(p); err == nil && st.IsDir() {
				roots = append(roots, Root{Name: sub, Path: p})
			}
		}
	}
	if runtime.GOOS == "windows" {
		for c := 'A'; c <= 'Z'; c++ {
			d := string(c) + `:\`
			if _, err := os.Stat(d); err == nil {
				roots = append(roots, Root{Name: string(c) + ":", Path: d})
			}
		}
	} else {
		roots = append(roots, Root{Name: "Filesystem", Path: "/"})
	}
	return roots
}

func label(p string) string {
	base := filepath.Base(p)
	if base == "" || base == string(os.PathSeparator) {
		return p
	}
	return base
}
