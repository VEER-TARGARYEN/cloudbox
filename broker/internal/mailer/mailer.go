// Package mailer sends account-verification emails. If SMTP isn't configured
// (local dev), it logs the verification link instead so you can click it.
package mailer

import (
	"fmt"
	"log"
	"net/smtp"
)

type Mailer struct {
	host, port, user, pass, from, publicURL string
}

func New(host, port, user, pass, from, publicURL string) *Mailer {
	return &Mailer{host: host, port: port, user: user, pass: pass, from: from, publicURL: publicURL}
}

// Configured reports whether real email sending is set up (SMTP host present).
func (m *Mailer) Configured() bool { return m.host != "" }

// SendVerification emails (or logs) a verification link for the given token.
func (m *Mailer) SendVerification(to, token string) {
	link := fmt.Sprintf("%s/accounts/verify?token=%s", m.publicURL, token)

	if m.host == "" { // no SMTP configured → dev mode
		log.Printf("[email:dev] verify %s -> %s", to, link)
		return
	}

	msg := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: Verify your CloudBox account\r\n\r\n"+
			"Welcome to CloudBox!\r\n\r\nClick to verify your account:\r\n%s\r\n",
		m.from, to, link,
	)
	auth := smtp.PlainAuth("", m.user, m.pass, m.host)
	if err := smtp.SendMail(m.host+":"+m.port, auth, m.from, []string{to}, []byte(msg)); err != nil {
		log.Printf("[email] send to %s failed: %v (link: %s)", to, err, link)
	}
}
