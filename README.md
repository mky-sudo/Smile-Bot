# My Smile Bot

This repository contains the My Smile Bot project — a Node/Express chatbot with WebSocket support and a frontend in `public/`.

Quick Start (locally)

1. Install dependencies

```powershell
npm install
```

2. Run locally

```powershell
# dev (nodemon)
npm run dev

# or production
npm start
```

3. Open the app

Visit `http://localhost:3000` and verify `/test` and `/health` endpoints.

Uploads
- By default uploads are saved to `uploads/` (local). To persist uploads to Cloudinary, set the environment variable `CLOUDINARY_URL` before starting:

```powershell
setx CLOUDINARY_URL "cloudinary://<API_KEY>:<API_SECRET>@<CLOUD_NAME>"
```

Deployment (Fly.io)

1. Create a Fly app and set a secret (example):

```powershell
iwr https://fly.io/install.ps1 -useb | iex
# restart shell
flyctl launch --name my-smile-bot --region ord --no-deploy
flyctl secrets set CLOUDINARY_URL="cloudinary://..."
flyctl deploy
```

CI/CD
- This repo contains a GitHub Actions workflow that deploys to Fly when you push to `main`. You must add `FLY_API_TOKEN` to repository secrets.
