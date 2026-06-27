package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	appmw "github.com/VEER-TARGARYEN/cloudbox/backend/internal/middleware"
	"github.com/VEER-TARGARYEN/cloudbox/backend/internal/models"
)

// Upload accepts a multipart/form-data POST with a single "file" field. It
// streams the bytes straight to disk under a fresh UUID and records the
// metadata in SQLite. Memory use stays flat no matter how big the file is.
func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	userID, ok := appmw.UserIDFromContext(r.Context())
	if !ok {
		respondError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	// Cap the request body so a single client can't fill the whole disk.
	// MaxBytesReader makes reads fail once the limit is crossed.
	r.Body = http.MaxBytesReader(w, r.Body, h.MaxUploadBytes)

	// MultipartReader gives us a STREAMING view of the upload. Unlike
	// ParseMultipartForm, it never buffers the file into memory or a temp file —
	// we copy each part directly to its final destination.
	reader, err := r.MultipartReader()
	if err != nil {
		respondError(w, http.StatusBadRequest, "expected multipart/form-data")
		return
	}

	for {
		part, err := reader.NextPart()
		if errors.Is(err, io.EOF) {
			break // no more parts
		}
		if err != nil {
			respondError(w, http.StatusBadRequest, "could not read upload")
			return
		}
		if part.FormName() != "file" {
			continue // ignore any other fields
		}

		originalName := part.FileName()
		if originalName == "" {
			respondError(w, http.StatusBadRequest, "missing filename")
			return
		}

		// The server, not the client, decides the on-disk name. This UUID is the
		// file's identity everywhere: DB primary key AND blob filename.
		fileID := uuid.NewString()

		// Stream the part straight onto the hard drive (io.Copy lives in Save).
		size, err := h.Store.Save(fileID, part)
		if err != nil {
			// A MaxBytesReader trip surfaces here as a read error.
			respondError(w, http.StatusRequestEntityTooLarge, "upload failed or file too large")
			return
		}

		mimeType := part.Header.Get("Content-Type")
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}

		file := models.File{
			ID:           fileID,
			UserID:       userID,
			OriginalName: filepath.Base(originalName), // strip any path components
			MimeType:     mimeType,
			SizeBytes:    size,
			CreatedAt:    time.Now().UTC(),
		}

		// Write metadata AFTER the bytes are safely on disk. There's no
		// transaction spanning disk + DB, so if this INSERT fails we delete the
		// blob we just wrote — otherwise we'd leak an orphan file. (A real system
		// would also run a periodic sweep to catch orphans from crashes.)
		_, err = h.DB.ExecContext(r.Context(),
			`INSERT INTO files (id, user_id, original_name, mime_type, size_bytes, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			file.ID, file.UserID, file.OriginalName, file.MimeType, file.SizeBytes, file.CreatedAt,
		)
		if err != nil {
			_ = h.Store.Remove(fileID)
			respondError(w, http.StatusInternalServerError, "could not save file metadata")
			return
		}

		log.Printf("upload ok: user=%s name=%q size=%d type=%s", userID, file.OriginalName, file.SizeBytes, file.MimeType)
		respondJSON(w, http.StatusCreated, file)
		return
	}

	respondError(w, http.StatusBadRequest, `no "file" field found in upload`)
}

// ListFiles returns the authenticated user's files, newest first. The query is
// filtered by user_id and served straight from the idx_files_user_created index
// (the WHERE + ORDER BY are both satisfied by that one index).
func (h *Handler) ListFiles(w http.ResponseWriter, r *http.Request) {
	userID, _ := appmw.UserIDFromContext(r.Context())

	rows, err := h.DB.QueryContext(r.Context(),
		`SELECT id, original_name, mime_type, size_bytes, created_at
		 FROM files WHERE user_id = ? ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "could not list files")
		return
	}
	defer rows.Close()

	// Initialize to a non-nil slice so an empty result serializes as [] not null.
	files := make([]models.File, 0)
	for rows.Next() {
		var f models.File
		if err := rows.Scan(&f.ID, &f.OriginalName, &f.MimeType, &f.SizeBytes, &f.CreatedAt); err != nil {
			respondError(w, http.StatusInternalServerError, "could not read files")
			return
		}
		files = append(files, f)
	}
	if err := rows.Err(); err != nil {
		respondError(w, http.StatusInternalServerError, "could not read files")
		return
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"files": files,
		"count": len(files),
	})
}

// Download streams a single file back to its owner. The ownership check is the
// authorization: the WHERE clause requires BOTH the file id and the caller's
// user_id, so someone else's file simply isn't found (404) — we never even
// confirm it exists.
func (h *Handler) Download(w http.ResponseWriter, r *http.Request) {
	userID, _ := appmw.UserIDFromContext(r.Context())
	fileID := chi.URLParam(r, "id")

	var f models.File
	err := h.DB.QueryRowContext(r.Context(),
		`SELECT id, original_name, mime_type, size_bytes, created_at
		 FROM files WHERE id = ? AND user_id = ?`,
		fileID, userID,
	).Scan(&f.ID, &f.OriginalName, &f.MimeType, &f.SizeBytes, &f.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		respondError(w, http.StatusNotFound, "file not found")
		return
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, "could not load file")
		return
	}

	blob, err := h.Store.Open(f.ID)
	if err != nil {
		// Metadata exists but the blob is gone — a corrupted/orphaned state.
		respondError(w, http.StatusInternalServerError, "file content missing")
		return
	}
	defer blob.Close()

	// Headers tell the client what the file is and how to handle it.
	w.Header().Set("Content-Type", f.MimeType)
	w.Header().Set("Content-Length", strconv.FormatInt(f.SizeBytes, 10))
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename=%q`, f.OriginalName))

	// Stream the bytes back chunk-by-chunk. Constant memory, any file size.
	// (Production upgrade: http.ServeContent would add HTTP range support for
	//  resumable downloads and media seeking — noted for later.)
	if _, err := io.Copy(w, blob); err != nil {
		// The client most likely disconnected mid-download; headers are already
		// sent, so there's nothing useful left to write.
		return
	}
}

// DeleteFile removes a file the caller owns: the metadata row first (which also
// enforces ownership), then the blob. Bonus endpoint — completes the CRUD and
// reuses the exact same ownership pattern as Download.
func (h *Handler) DeleteFile(w http.ResponseWriter, r *http.Request) {
	userID, _ := appmw.UserIDFromContext(r.Context())
	fileID := chi.URLParam(r, "id")

	res, err := h.DB.ExecContext(r.Context(),
		`DELETE FROM files WHERE id = ? AND user_id = ?`, fileID, userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "could not delete file")
		return
	}
	// RowsAffected == 0 means either the file doesn't exist OR it isn't ours.
	// Both collapse to a single 404 — we don't distinguish them.
	if n, _ := res.RowsAffected(); n == 0 {
		respondError(w, http.StatusNotFound, "file not found")
		return
	}

	_ = h.Store.Remove(fileID) // best-effort; metadata is already gone
	w.WriteHeader(http.StatusNoContent)
}
