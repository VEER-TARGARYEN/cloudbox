package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/VEER-TARGARYEN/cloudbox/broker/internal/broker"
	"github.com/VEER-TARGARYEN/cloudbox/broker/internal/mailer"
	"github.com/VEER-TARGARYEN/cloudbox/broker/internal/store"
	"github.com/VEER-TARGARYEN/cloudbox/broker/internal/token"
)

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	loadDotEnv(".env")

	port := env("PORT", "9000")
	dbPath := env("DATABASE_URL", "./data/broker.db")
	jwtSecret := env("JWT_SECRET", "dev-only-broker-secret-change-me")
	// On Render, RENDER_EXTERNAL_URL is injected automatically, so verification
	// links work out of the box without setting PUBLIC_URL.
	publicURL := env("PUBLIC_URL", env("RENDER_EXTERNAL_URL", "http://localhost:"+port))

	if dir := filepath.Dir(dbPath); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			log.Fatalf("create data dir: %v", err)
		}
	}

	st, err := store.Open(dbPath)
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	log.Println("broker db ready:", dbPath)

	ml := mailer.New(
		os.Getenv("SMTP_HOST"), env("SMTP_PORT", "587"),
		os.Getenv("SMTP_USER"), os.Getenv("SMTP_PASS"),
		env("SMTP_FROM", "no-reply@cloudbox.local"), publicURL,
	)
	tk := token.New(jwtSecret, 30*24*time.Hour)
	handler := broker.New(st, tk, ml).Routes()

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           handler,
		ReadHeaderTimeout: 15 * time.Second,
	}

	go func() {
		log.Println("broker listening on http://localhost:" + port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Println("shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
	log.Println("broker stopped")
}

// loadDotEnv reads KEY=VALUE lines from path into the environment (real env
// vars win). Missing file is fine.
func loadDotEnv(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		k = strings.TrimSpace(k)
		v = strings.Trim(strings.TrimSpace(v), `"'`)
		if _, exists := os.LookupEnv(k); !exists {
			_ = os.Setenv(k, v)
		}
	}
}
