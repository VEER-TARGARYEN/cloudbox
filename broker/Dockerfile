# syntax=docker/dockerfile:1
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/broker ./cmd/server

FROM alpine:3.20
RUN apk add --no-cache ca-certificates && adduser -D -u 10001 app
WORKDIR /app
COPY --from=build /out/broker /app/broker
# Mount a persistent disk at /data in production so accounts survive restarts.
ENV DATABASE_URL=/data/broker.db PORT=9000
RUN mkdir -p /data && chown -R app:app /data
USER app
EXPOSE 9000
CMD ["/app/broker"]
