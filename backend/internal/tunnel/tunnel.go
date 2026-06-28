// Package tunnel starts a Cloudflare quick tunnel as a child process so the
// laptop server can expose itself publicly without any manual steps.
package tunnel

import (
	"bufio"
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"time"
)

var urlRe = regexp.MustCompile(`https://[a-z0-9-]+\.trycloudflare\.com`)

// Start launches `cloudflared tunnel --url http://localhost:<port>` and returns
// the assigned public URL. stop() terminates the tunnel. If cloudflared can't be
// found, it returns an empty URL (and a no-op stop) rather than an error, so the
// server still runs (the user can set PUBLIC_URL or run a tunnel manually).
func Start(ctx context.Context, port string) (string, func()) {
	bin := find()
	if bin == "" {
		return "", func() {}
	}

	cmd := exec.CommandContext(ctx, bin, "tunnel", "--url", "http://localhost:"+port)
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return "", func() {}
	}
	if err := cmd.Start(); err != nil {
		return "", func() {}
	}
	stop := func() {
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
	}

	urlCh := make(chan string, 1)
	go func() {
		sc := bufio.NewScanner(stderr)
		for sc.Scan() {
			if m := urlRe.FindString(sc.Text()); m != "" {
				select {
				case urlCh <- m:
				default:
				}
			}
		}
	}()

	select {
	case u := <-urlCh:
		return u, stop
	case <-time.After(45 * time.Second):
		return "", stop
	}
}

// find locates cloudflared next to our own executable first, then on PATH.
func find() string {
	if exe, err := os.Executable(); err == nil {
		dir := filepath.Dir(exe)
		for _, name := range []string{"cloudflared.exe", "cloudflared"} {
			c := filepath.Join(dir, name)
			if _, err := os.Stat(c); err == nil {
				return c
			}
		}
	}
	if p, err := exec.LookPath("cloudflared"); err == nil {
		return p
	}
	return ""
}
