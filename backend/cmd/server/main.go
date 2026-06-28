package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"

	"github.com/VEER-TARGARYEN/cloudbox/backend/internal/auth"
	"github.com/VEER-TARGARYEN/cloudbox/backend/internal/brokerlink"
	"github.com/VEER-TARGARYEN/cloudbox/backend/internal/config"
	"github.com/VEER-TARGARYEN/cloudbox/backend/internal/database"
	"github.com/VEER-TARGARYEN/cloudbox/backend/internal/fsbrowser"
	"github.com/VEER-TARGARYEN/cloudbox/backend/internal/handlers"
	appmw "github.com/VEER-TARGARYEN/cloudbox/backend/internal/middleware"
	"github.com/VEER-TARGARYEN/cloudbox/backend/internal/setupui"
	"github.com/VEER-TARGARYEN/cloudbox/backend/internal/storage"
	"github.com/VEER-TARGARYEN/cloudbox/backend/internal/tunnel"
)

func main() {
	// 1. Load configuration (env vars with local defaults).
	cfg := config.Load()

	// 2. Ensure the database's directory and the storage directory exist before
	//    we touch them. We derive the DB directory from DATABASE_URL so this
	//    works whether the file is ./data/cloudbox.db locally or /data/... in a
	//    container with a mounted disk.
	if dbDir := filepath.Dir(cfg.DatabaseURL); dbDir != "" && dbDir != "." {
		if err := os.MkdirAll(dbDir, 0o755); err != nil {
			log.Fatalf("create data dir: %v", err)
		}
	}
	if err := os.MkdirAll(cfg.StorageDir, 0o755); err != nil {
		log.Fatalf("create storage dir: %v", err)
	}

	// 3. Open the database (this also applies the schema).
	db, err := database.Open(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()
	log.Println("database ready:", cfg.DatabaseURL)

	// 4. Wire dependencies: JWT service + disk store + the HTTP handlers.
	tokens := auth.NewTokenService(cfg.JWTSecret, 7*24*time.Hour)
	store := storage.New(cfg.StorageDir)
	browser := fsbrowser.New(cfg.FSAllowRoots, cfg.FSReadOnly)
	h := handlers.New(db, tokens, store, browser, cfg.MaxUploadBytes)

	if len(cfg.FSAllowRoots) == 0 {
		log.Printf("filesystem access: FULL (all drives), read-only=%v", cfg.FSReadOnly)
	} else {
		log.Printf("filesystem access: restricted to %v, read-only=%v", cfg.FSAllowRoots, cfg.FSReadOnly)
	}

	// ── Broker pairing + local setup UI ──────────────────────────────────────
	// Public URL: use PUBLIC_URL if set, otherwise spawn a Cloudflare tunnel so
	// the .exe is fully self-contained.
	publicURL := cfg.PublicURL
	tunnelStop := func() {}
	if publicURL == "" {
		if u, stop := tunnel.Start(context.Background(), cfg.Port); u != "" {
			publicURL, tunnelStop = u, stop
			log.Println("tunnel ready:", u)
		} else {
			log.Println("tunnel: cloudflared not found — set PUBLIC_URL or run a tunnel yourself")
		}
	}
	defer tunnelStop()

	deviceName := cfg.DeviceName
	if deviceName == "" {
		if hn, err := os.Hostname(); err == nil && hn != "" {
			deviceName = hn
		} else {
			deviceName = "My Laptop"
		}
	}

	dataDir := filepath.Dir(cfg.DatabaseURL)
	linker := brokerlink.NewLinker(
		cfg.BrokerURL, publicURL, deviceName,
		filepath.Join(dataDir, "broker-device.json"),
		filepath.Join(dataDir, "pair-qr.png"),
	)
	h.Broker = linker.Auth()

	// Headless auto-connect when credentials are supplied via env.
	if cfg.BrokerEmail != "" && cfg.BrokerPassword != "" {
		go func() {
			if err := linker.Connect(cfg.BrokerEmail, cfg.BrokerPassword, false); err != nil {
				log.Println("broker: auto-connect failed:", err)
			}
		}()
	}

	// Local setup UI (loopback only) where you sign in and see the pairing QR.
	setupSrv := &http.Server{
		Addr:              "127.0.0.1:" + cfg.SetupPort,
		Handler:           setupui.New(linker).Routes(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		if err := setupSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Println("setup UI error:", err)
		}
	}()
	setupURL := "http://127.0.0.1:" + cfg.SetupPort + "/"
	log.Println("setup UI:", setupURL)
	openBrowser(setupURL)

	// 5. Build the router + global middleware.
	//    NOTE: we deliberately do NOT add a blanket request timeout here. The
	//    upload/download routes stream arbitrarily large files, and a fixed
	//    deadline would cut off legitimate transfers. We protect the handshake
	//    with the server's ReadHeaderTimeout instead (see step 7).
	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)

	// 6a. Public routes — no token required.
	r.Get("/health", h.Health)
	r.Post("/register", h.Register)
	r.Post("/login", h.Login)
	r.Post("/auth/broker", h.AuthBroker) // exchange a broker token for a laptop token

	// 6b. Protected routes — Authenticator runs first; everything here requires
	//     a valid Bearer token and gets the caller's user_id from the context.
	r.Group(func(pr chi.Router) {
		pr.Use(appmw.Authenticator(tokens))

		pr.Get("/me", h.Me)

		pr.Post("/upload", h.Upload)                    // multipart file upload
		pr.Get("/files", h.ListFiles)                   // list my files
		pr.Get("/files/{id}/download", h.Download)      // download one of my files
		pr.Delete("/files/{id}", h.DeleteFile)          // delete one of my files

		// Real-filesystem browser — access the host's actual files/folders.
		pr.Get("/fs/roots", h.FSRoots)       // drives + shortcut folders
		pr.Get("/fs/list", h.FSList)         // list a directory
		pr.Get("/fs/download", h.FSDownload) // download a real file
		pr.Post("/fs/upload", h.FSUpload)    // upload into a real folder
	})

	// 7. http.Server with timeouts tuned for streaming. ReadHeaderTimeout still
	//    defends against slow-header (slowloris) attacks, but the body and the
	//    response may take as long as a big transfer needs.
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 15 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	// 8. Run the server in a goroutine so main() can block on a shutdown signal.
	go func() {
		log.Println("listening on http://localhost:" + cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	// 9. Graceful shutdown: wait for Ctrl-C / SIGTERM, then drain connections.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Println("shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = setupSrv.Shutdown(ctx)
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("graceful shutdown failed: %v", err)
	}
	log.Println("server stopped")
}

// openBrowser opens url in the user's default browser (best-effort). Set
// CLOUDBOX_NO_BROWSER to skip (headless servers, automated runs).
func openBrowser(url string) {
	if os.Getenv("CLOUDBOX_NO_BROWSER") != "" {
		return
	}
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}
