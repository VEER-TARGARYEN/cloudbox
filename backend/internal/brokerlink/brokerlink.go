// Package brokerlink connects the laptop server to the cloud broker on demand
// (driven by the setup UI): it logs in / registers, registers the device,
// heartbeats the current public URL, writes a pairing QR, and validates phone
// tokens for /auth/broker.
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

func newAuth() *Auth { return &Auth{} }

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

// Linker owns the connection to the broker for this laptop.
type Linker struct {
	brokerURL   string
	deviceName  string
	persistPath string
	qrPath      string
	client      *brokerclient.Client
	auth        *Auth

	mu        sync.RWMutex
	publicURL string
	connected bool
	email     string
	pairCode  string
	deviceID  string
}

func NewLinker(brokerURL, publicURL, deviceName, persistPath, qrPath string) *Linker {
	return &Linker{
		brokerURL:   brokerURL,
		publicURL:   publicURL,
		deviceName:  deviceName,
		persistPath: persistPath,
		qrPath:      qrPath,
		client:      brokerclient.New(brokerURL),
		auth:        newAuth(),
	}
}

func (l *Linker) Auth() *Auth   { return l.auth }
func (l *Linker) QRPath() string { return l.qrPath }

// SetPublicURL updates the URL the laptop announces (e.g. once the tunnel is up).
func (l *Linker) SetPublicURL(url string) {
	l.mu.Lock()
	l.publicURL = url
	l.mu.Unlock()
}

// Status is a snapshot for the setup UI.
type Status struct {
	Connected bool   `json:"connected"`
	Email     string `json:"email"`
	HasQR     bool   `json:"has_qr"`
	BrokerURL string `json:"broker"`
	PublicURL string `json:"public_url"`
}

func (l *Linker) Status() Status {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return Status{
		Connected: l.connected,
		Email:     l.email,
		HasQR:     l.pairCode != "",
		BrokerURL: l.brokerURL,
		PublicURL: l.publicURL,
	}
}

// Connect logs in (registering first if `register`), registers/reuses a device,
// writes the QR, and starts heartbeating. Safe to call from the setup UI.
func (l *Linker) Connect(email, password string, register bool) error {
	l.mu.RLock()
	publicURL := l.publicURL
	l.mu.RUnlock()
	if publicURL == "" {
		return errors.New("the public tunnel isn't ready yet — wait a few seconds and try again")
	}

	if register {
		if err := l.client.Register(email, password); err != nil {
			return err
		}
	}
	token, accountID, err := l.client.Login(email, password)
	if err != nil {
		return err
	}
	l.auth.set(l.client, accountID)

	dev := loadDevice(l.persistPath)
	if dev.DeviceID == "" {
		id, code, err := l.client.RegisterDevice(token, l.deviceName, publicURL)
		if err != nil {
			return err
		}
		dev = persisted{DeviceID: id, PairCode: code}
		saveDevice(l.persistPath, dev)
	}
	writeQR(l.qrPath, l.brokerURL, dev.PairCode)

	l.mu.Lock()
	l.connected, l.email, l.pairCode, l.deviceID = true, email, dev.PairCode, dev.DeviceID
	l.mu.Unlock()

	go l.heartbeat(token, password)
	return nil
}

func (l *Linker) heartbeat(token, password string) {
	for {
		time.Sleep(60 * time.Second)
		l.mu.RLock()
		deviceID, publicURL, email := l.deviceID, l.publicURL, l.email
		l.mu.RUnlock()

		err := l.client.Heartbeat(token, deviceID, publicURL)
		switch {
		case errors.Is(err, brokerclient.ErrDeviceGone):
			if id, code, e := l.client.RegisterDevice(token, l.deviceName, publicURL); e == nil {
				saveDevice(l.persistPath, persisted{DeviceID: id, PairCode: code})
				writeQR(l.qrPath, l.brokerURL, code)
				l.mu.Lock()
				l.deviceID, l.pairCode = id, code
				l.mu.Unlock()
			}
		case err != nil:
			log.Printf("broker: heartbeat error (%v); re-logging in", err)
			if t, a, e := l.client.Login(email, password); e == nil {
				token = t
				l.auth.set(l.client, a)
			}
		}
	}
}

type persisted struct {
	DeviceID string `json:"device_id"`
	PairCode string `json:"pair_code"`
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
