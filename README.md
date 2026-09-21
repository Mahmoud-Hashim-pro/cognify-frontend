# Cognify Frontend

Production Frontend for Cognify 2.0 — An AI-Powered Adaptive Learning and Accessibility Platform. Built with React 19, Vite, TailwindCSS, Motion, and MediaPipe.

---

## Architecture & Integration

This repository hosts the client-side SPA of Cognify. It is designed to be deployed independently to **Vercel** and communicate with the backend API (`cognify-backend`).

### Key Features
- **Adaptive Intelligence UI**: Cognitive assessment, personalized learning dashboard, concept graphs, and spaced retention.
- **Accessibility Engine**: Real-time sign language recognition, 3D avatar interpreter, vision companion, and motor/euphonia accessibility modes.
- **Centralized API Base**: Dynamically routes API traffic via `VITE_API_BASE_URL` in production, or uses Vite proxy to `http://localhost:3000` during local development.

---

## Getting Started (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional for local dev)
Create `.env.local` if needed:
```env
# Optional: defaults to empty in dev, using Vite proxy to http://localhost:3000
VITE_API_BASE_URL=
```

### 3. Run Development Server
```bash
npm run dev
```
The app runs at `http://localhost:5173`. Requests to `/api/*` are automatically proxied to the local backend at `http://localhost:3000`.

### 4. Production Build
```bash
npm run build
```

---

## Deploying to Vercel

1. Import the `Mahmoud-Hashim-pro/cognify-frontend` repository into Vercel.
2. Framework Preset: **Vite**
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Configure Environment Variables in Vercel Project Settings:
   - `VITE_API_BASE_URL`: The URL of your deployed backend (e.g. `https://cognify-backend.vercel.app`)
