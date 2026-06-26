# syntax=docker/dockerfile:1

# ───────────── build stage ─────────────
FROM golang:1.26-alpine AS build
WORKDIR /src

# Download deps first so this layer is cached unless go.mod/go.sum change.
COPY go.mod go.sum ./
RUN go mod download

# Build a fully static, pure-Go binary. modernc.org/sqlite needs no CGO, so
# CGO_ENABLED=0 yields a single self-contained executable with no libc dep.
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/cloudbox ./cmd/server

# ───────────── run stage ─────────────
FROM alpine:3.20
# ca-certificates for any outbound TLS; create an unprivileged user to run as.
RUN apk add --no-cache ca-certificates && adduser -D -u 10001 app
WORKDIR /app
COPY --from=build /out/cloudbox /app/cloudbox

# Data + blobs live under /data. Mount a persistent disk here in production;
# without one (e.g. Render free tier) this directory is ephemeral.
ENV DATABASE_URL=/data/cloudbox.db \
    STORAGE_DIR=/data/storage \
    PORT=8080
RUN mkdir -p /data/storage && chown -R app:app /data

USER app
EXPOSE 8080
CMD ["/app/cloudbox"]
