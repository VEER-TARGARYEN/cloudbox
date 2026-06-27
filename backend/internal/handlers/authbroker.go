package handlers

import (
	"encoding/json"
	"net/http"
)

// AuthBroker exchanges a phone's BROKER session token for a LAPTOP session
// token. The phone authenticated with the cloud broker (via QR or login); this
// endpoint validates that token with the broker (token introspection) and, if
// it belongs to this laptop's owner, issues a normal CloudBox token the phone
// then uses for the /fs file API. This is the federation that means one login.
func (h *Handler) AuthBroker(w http.ResponseWriter, r *http.Request) {
	if h.Broker == nil {
		respondError(w, http.StatusNotImplemented, "this server is not linked to a broker")
		return
	}

	var body struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Token == "" {
		respondError(w, http.StatusBadRequest, "missing broker token")
		return
	}

	accountID, err := h.Broker.Verify(body.Token)
	if err != nil {
		respondError(w, http.StatusUnauthorized, "invalid or unauthorized broker token")
		return
	}

	tok, err := h.Tokens.Generate(accountID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "could not issue token")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"token": tok})
}
