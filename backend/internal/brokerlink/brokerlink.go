// Package brokerlink connects the laptop server to the cloud broker: it logs
// in, registers the device, heartbeats the current public URL, writes a pairing
// QR, and validates phone tokens for /auth/broker.
package brokerlink

import (
	"encoding/json"
	"errors"
	"log"
	"os"
	"sync"
	"time"

	qrcode "github.com/skip2/go-qrcode"

	"github.com/VEER-TARGARYEN/cloudbox/backend/internal/brokerclient"
)

// Auth validates a phone's broker token and confirms it belongs to this
// laptop's owner account. It satisfies handlers.BrokerVerifier.
type Auth struct {
	mu      sync.RWMutex
	client  *brokerclient.Client
	ownerID string
	ready   bool
}

func NewAuth() *Auth { return &Auth{} }

func (a *Auth) set(c *brokerclient.Client, ownerID string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.client, a.ownerID, a.ready = c, ownerID, true
}

func (a *Auth) Verify(token string) (string, error) {
	a.mu.RLock()
	client, ownerID, ready := a.client, a.ownerID, a.ready
	a.mu.RUnlock()

	if !ready {
		return "", errors.New("broker not connected yet")
	}
	id, err := client.VerifyToken(token)
	if err != nil {
		return "", err
	}
	if id != ownerID {
		return "", errors.New("token belongs to a different account")
	}
	return id, nil
}

type Opts struct {
	BrokerURL   string
	Email       string
	Password    string
	DeviceName  string
	PublicURL   string // the laptop's current public (tunnel) URL
	PersistPath string // remembers device id + pair code across restarts
	QRPath      string // where to write the pairing QR PNG
}

type persisted struct {
	DeviceID string `json:"device_id"`
	PairCode string `json:"pair_code"`
}

// Run links to the broker then heartbeats forever. Call in a goroutine; it
// populates `auth` once logged in so /auth/broker starts working.
func Run(opts Opts, auth *Auth) {
	client := brokerclient.New(opts.BrokerURL)

	// 1. Log in (retry until the broker is reachable).
	var token, accountID string
	for {
		var err error
		token, accountID, err = client.Login(opts.Email, opts.Password)
		if err == nil {
			break
		}
		log.Printf("broker: login failed (%v); retrying in 30s", err)
		time.Sleep(30 * time.Second)
	}
	auth.set(client, accountID)
	log.Println("broker: linked as", opts.Email)

	// 2. Reuse a saved device, or register a new one.
	dev := loadDevice(opts.PersistPath)
	if dev.DeviceID == "" {
		if id, code, err := client.RegisterDevice(token, opts.DeviceName, opts.PublicURL); err != nil {
			log.Printf("broker: register device failed: %v", err)
		} else {
			dev = persisted{DeviceID: id, PairCode: code}
			saveDevice(opts.PersistPath, dev)
		}
	}
	if dev.PairCode != "" {
		writeQR(opts.QRPath, opts.BrokerURL, dev.PairCode)
		log.Printf("broker: pair code = %s  (QR written to %s)", dev.PairCode, opts.QRPath)
	}

	// 3. Heartbeat the current URL forever.
	for {
		err := client.Heartbeat(token, dev.DeviceID, opts.PublicURL)
		switch {
		case errors.Is(err, brokerclient.ErrDeviceGone):
			if id, code, e := client.RegisterDevice(token, opts.DeviceName, opts.PublicURL); e == nil {
				dev = persisted{DeviceID: id, PairCode: code}
				saveDevice(opts.PersistPath, dev)
				writeQR(opts.QRPath, opts.BrokerURL, dev.PairCode)
			}
		case err != nil:
			log.Printf("broker: heartbeat error (%v); re-logging in", err)
			if t, a, e := client.Login(opts.Email, opts.Password); e == nil {
				token = t
				auth.set(client, a)
			}
		}
		time.Sleep(60 * time.Second)
	}
}

func loadDevice(path string) persisted {
	var p persisted
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &p)
	}
	return p
}

func saveDevice(path string, p persisted) {
	if data, err := json.Marshal(p); err == nil {
		_ = os.WriteFile(path, data, 0o600)
	}
}

func writeQR(path, brokerURL, pairCode string) {
	payload, _ := json.Marshal(map[string]string{"broker": brokerURL, "code": pairCode})
	if err := qrcode.WriteFile(string(payload), qrcode.Medium, 512, path); err != nil {
		log.Printf("broker: could not write QR: %v", err)
	}
}
