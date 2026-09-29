# MedScan

## HTTPS in deployment

Terminate HTTPS at a reverse proxy such as nginx or Caddy. Configure the proxy to obtain and renew a TLS certificate, redirect HTTP requests to HTTPS, and forward requests to the FastAPI process on a private loopback address. Forward the original host and scheme headers only from the trusted proxy, and keep certificate private keys readable only by the proxy service account. Run Uvicorn behind that proxy rather than exposing its application port directly. Set `FRONTEND_ORIGIN` to the exact deployed frontend origin.
