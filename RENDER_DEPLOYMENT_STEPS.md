# Render Deployment Steps (obsolete)

The backend no longer runs on Render. Since 2026-11-25 it runs in Docker on our own Ubuntu server, behind Nginx and a Cloudflare Tunnel, with local PostgreSQL as the primary database and Neon as the backup.

For how to deploy, verify and troubleshoot the backend now, see **[DEPLOYMENT.md](DEPLOYMENT.md)**.

If the old Render service still exists, read [DEPLOYMENT.md § Render (legacy)](DEPLOYMENT.md#7-render-legacy) before using it. It writes to Neon directly, so the two databases drift apart. It should be suspended and then deleted.
