# ThumbForge - Docker Deployment Guide

This guide explains how to deploy ThumbForge using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 1.29+

## Quick Start

### 1. Clone or download the repository

```bash
cd /path/to/ThumbForge
```

### 2. Configure environment variables

Edit the `.env` file to set your desired port:

```bash
# .env
PORT=8080
```

### 3. Build and run with Docker Compose

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

### 4. Access the application

Open your browser and navigate to:
```
http://localhost:8080
```

(Replace `8080` with your configured PORT)

## Docker Commands

### Using Docker Compose (Recommended)

```bash
# Start the application
docker-compose up -d

# Stop the application
docker-compose down

# Restart the application
docker-compose restart

# View logs
docker-compose logs -f thumbforge

# Rebuild after code changes
docker-compose up -d --build

# Remove everything (including volumes)
docker-compose down -v
```

### Using Docker directly

```bash
# Build the image
docker build -t thumbforge:latest .

# Run the container
docker run -d \
  --name thumbforge \
  -p 8080:80 \
  --restart unless-stopped \
  thumbforge:latest

# Stop the container
docker stop thumbforge

# Remove the container
docker rm thumbforge

# View logs
docker logs -f thumbforge
```

## Configuration

### Environment Variables

The following environment variables can be configured in the `.env` file:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port to expose the application | `8080` |

### Custom Domain

To use a custom domain, update your DNS settings to point to your server, then:

1. Update the `nginx.conf` file:
   ```nginx
   server_name your-domain.com;
   ```

2. Rebuild the container:
   ```bash
   docker-compose up -d --build
   ```

3. (Optional) Add SSL with a reverse proxy like Traefik or Nginx Proxy Manager

## Production Deployment

### With Reverse Proxy (Recommended)

For production, use a reverse proxy like Traefik or Nginx Proxy Manager to handle:
- SSL/TLS certificates (Let's Encrypt)
- Domain routing
- Load balancing

Example with Traefik labels in `docker-compose.yaml`:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.thumbforge.rule=Host(`thumbforge.yourdomain.com`)"
  - "traefik.http.routers.thumbforge.entrypoints=websecure"
  - "traefik.http.routers.thumbforge.tls.certresolver=letsencrypt"
```

### Health Checks

The container includes a health check endpoint at `/health`:

```bash
curl http://localhost:8080/health
# Response: healthy
```

Docker Compose automatically monitors this endpoint and will restart the container if it becomes unhealthy.

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs thumbforge

# Check if port is already in use
sudo lsof -i :8080

# Try a different port in .env
PORT=8081
docker-compose up -d
```

### Application not accessible

```bash
# Check if container is running
docker ps

# Check container logs
docker logs thumbforge

# Verify port mapping
docker port thumbforge
```

### Rebuild after changes

```bash
# Force rebuild and restart
docker-compose up -d --build --force-recreate
```

## File Structure

```
ThumbForge/
├── Dockerfile              # Container image definition
├── docker-compose.yaml     # Container orchestration
├── .env                    # Environment variables (PORT)
├── .dockerignore          # Files to exclude from image
├── nginx.conf             # Nginx web server configuration
├── index.html             # Application entry point
├── styles.css             # Application styles
├── app.js                 # Application logic
└── README-DOCKER.md       # This file
```

## Architecture

- **Base Image**: nginx:alpine (~40MB)
- **Web Server**: Nginx 1.x
- **Port**: 80 (internal), configurable external port
- **Network**: Bridge network (isolated)
- **Restart Policy**: unless-stopped

## Security Features

The nginx configuration includes:
- Gzip compression
- Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
- Cache control for static assets
- Health check endpoint

## Resource Usage

- **Memory**: ~10-20MB
- **CPU**: Minimal (static site)
- **Disk**: ~50MB (image + layers)

## Support

For issues related to:
- **Docker setup**: Check this README
- **Application features**: Check main README.md
- **Development**: Check CLAUDE.md

## License

Same as ThumbForge application.
