package handlers

import (
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// FSRoots returns the top-level starting points (drives + shortcut folders).
func (h *Handler) FSRoots(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]any{
		"roots":     h.FS.Roots(),
		"read_only": h.FS.ReadOnly(),
	})
}

// FSList lists the contents of a real directory: GET /fs/list?path=<dir>
func (h *Handler) FSList(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	entries, err := h.FS.List(path)
	if err != nil {
		respondError(w, fsStatus(err), err.Error())
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"path":    path,
		"entries": entries,
	})
}

// FSDownload streams a real file back: GET /fs/download?path=<file>
func (h *Handler) FSDownload(w http.ResponseWriter, r *http.Request) {
	abs, err := h.FS.Resolve(r.URL.Query().Get("path"))
	if err != nil {
		respondError(w, http.StatusForbidden, err.Error())
		return
	}
	info, err := os.Stat(abs)
	if err != nil {
		respondError(w, http.StatusNotFound, "file not found")
		return
	}
	if info.IsDir() {
		respondError(w, http.StatusBadRequest, "path is a directory")
		return
	}

	f, err := os.Open(abs)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "could not open file")
		return
	}
	defer f.Close()

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filepath.Base(abs)))
	_, _ = io.Copy(w, f)
}

// FSUpload saves an uploaded file into a real folder:
// POST /fs/upload?path=<dir>  (multipart/form-data field "file")
func (h *Handler) FSUpload(w http.ResponseWriter, r *http.Request) {
	if h.FS.ReadOnly() {
		respondError(w, http.StatusForbidden, "server is read-only")
		return
	}
	absDir, err := h.FS.Resolve(r.URL.Query().Get("path"))
	if err != nil {
		respondError(w, http.StatusForbidden, err.Error())
		return
	}
	if info, err := os.Stat(absDir); err != nil || !info.IsDir() {
		respondError(w, http.StatusBadRequest, "target is not a folder")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, h.MaxUploadBytes)
	reader, err := r.MultipartReader()
	if err != nil {
		respondError(w, http.StatusBadRequest, "expected multipart/form-data")
		return
	}

	for {
		part, err := reader.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			respondError(w, http.StatusBadRequest, "could not read upload")
			return
		}
		if part.FormName() != "file" {
			continue
		}

		// Only ever a bare filename — strip any directory components the client
		// might have sent, then confirm the result stays inside absDir.
		name := filepath.Base(part.FileName())
		if name == "" || name == "." || name == string(os.PathSeparator) {
			respondError(w, http.StatusBadRequest, "missing filename")
			return
		}
		target := filepath.Join(absDir, name)
		if rel, err := filepath.Rel(absDir, target); err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
			respondError(w, http.StatusBadRequest, "invalid filename")
			return
		}

		dst, err := os.Create(target)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "could not create file")
			return
		}
		size, err := io.Copy(dst, part)
		closeErr := dst.Close()
		if err != nil || closeErr != nil {
			_ = os.Remove(target)
			respondError(w, http.StatusInternalServerError, "could not write file")
			return
		}

		log.Printf("fs upload: %s (%d bytes)", target, size)
		respondJSON(w, http.StatusCreated, map[string]any{
			"name": name,
			"path": target,
			"size": size,
		})
		return
	}

	respondError(w, http.StatusBadRequest, `no "file" field found in upload`)
}

// fsStatus maps a browse error to an HTTP status.
func fsStatus(err error) int {
	msg := err.Error()
	switch {
	case strings.Contains(msg, "not allowed"), strings.Contains(msg, "must be absolute"):
		return http.StatusForbidden
	case os.IsNotExist(err) || strings.Contains(msg, "cannot find") || strings.Contains(msg, "no such file"):
		return http.StatusNotFound
	default:
		return http.StatusBadRequest
	}
}
