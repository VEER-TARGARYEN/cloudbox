// Package brokerclient talks to the cloud broker from the laptop server:
// logging in, registering the device, heartbeating the current URL, and
// validating phone tokens (introspection).
package brokerclient

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// ErrDeviceGone means the broker no longer knows this device (re-register).
var ErrDeviceGone = errors.New("device not found on broker")

type Client struct {
	baseURL string
	http    *http.Client
}

func New(baseURL string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		http:    &http.Client{Timeout: 15 * time.Second},
	}
}

func (c *Client) do(method, path, token string, body, out any) (int, error) {
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			return 0, err
		}
	}
	req, err := http.NewRequest(method, c.baseURL+path, &buf)
	if err != nil {
		return 0, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if out != nil && resp.StatusCode < 300 {
		_ = json.NewDecoder(resp.Body).Decode(out)
	}
	return resp.StatusCode, nil
}

// Register creates a broker account. An already-existing account (409) is not
// treated as an error — we'll just log in afterwards.
func (c *Client) Register(email, password string) error {
	code, err := c.do(http.MethodPost, "/accounts/register", "",
		map[string]string{"email": email, "password": password}, nil)
	if err != nil {
		return err
	}
	if code == http.StatusCreated || code == http.StatusConflict {
		return nil
	}
	return fmt.Errorf("register failed (status %d)", code)
}

// Login returns a broker session token + the account ID.
func (c *Client) Login(email, password string) (token, accountID string, err error) {
	var r struct {
		Token   string `json:"token"`
		Account struct {
			ID string `json:"id"`
		} `json:"account"`
	}
	code, err := c.do(http.MethodPost, "/accounts/login", "",
		map[string]string{"email": email, "password": password}, &r)
	if err != nil {
		return "", "", err
	}
	if code != http.StatusOK {
		return "", "", fmt.Errorf("broker login failed (status %d)", code)
	}
	return r.Token, r.Account.ID, nil
}

// RegisterDevice creates a device record and returns its id + pair code.
func (c *Client) RegisterDevice(token, name, url string) (deviceID, pairCode string, err error) {
	var r struct {
		DeviceID string `json:"device_id"`
		PairCode string `json:"pair_code"`
	}
	code, err := c.do(http.MethodPost, "/devices", token,
		map[string]string{"name": name, "url": url}, &r)
	if err != nil {
		return "", "", err
	}
	if code != http.StatusCreated {
		return "", "", fmt.Errorf("device register failed (status %d)", code)
	}
	return r.DeviceID, r.PairCode, nil
}

// Heartbeat updates the device's current URL. Returns ErrDeviceGone on 404.
func (c *Client) Heartbeat(token, deviceID, url string) error {
	code, err := c.do(http.MethodPost, "/devices/"+deviceID+"/heartbeat", token,
		map[string]string{"url": url}, nil)
	if err != nil {
		return err
	}
	if code == http.StatusNotFound {
		return ErrDeviceGone
	}
	if code != http.StatusOK {
		return fmt.Errorf("heartbeat failed (status %d)", code)
	}
	return nil
}

// VerifyToken validates a phone's broker token and returns its account ID.
func (c *Client) VerifyToken(token string) (string, error) {
	var r struct {
		ID string `json:"id"`
	}
	code, err := c.do(http.MethodGet, "/accounts/me", token, nil, &r)
	if err != nil {
		return "", err
	}
	if code != http.StatusOK {
		return "", fmt.Errorf("token not valid (status %d)", code)
	}
	return r.ID, nil
}
