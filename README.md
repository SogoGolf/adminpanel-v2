# GolfApp Admin Panel

Admin panel for managing golfers and tokens in the GolfApp system.

## Tech Stack

- **React 18** + TypeScript
- **Vite** - Build tool
- **TanStack Query** - Data fetching & caching
- **TanStack Table** - Flexible table component
- **Tailwind CSS** - Styling
- **Firebase Auth** - Authentication
- **Azure CosmosDB** - Backend API

## Features

- Golfer lookup by GolfLink number
- View golfer details and token balance
- Add/debit tokens (Admin Credit/Debit)
- Transaction history
- Responsive design (mobile-friendly)
- Multi-tenant support (white-labeling ready)

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
VITE_SOGO_API_URL=https://your-api-url
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
```

### Development

```bash
npm run dev
```

Open http://localhost:5173

### Testing Multi-Tenant Locally

Add `?tenant=` to switch tenants:

```
http://localhost:5173/?tenant=masseypark
http://localhost:5173/?tenant=goldencreek
```

### Build

```bash
npm run build
```

## Deployment

Deployed to Google Cloud Run.

```bash
gcloud run deploy sogo-admin-panel \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

### URLs

- **Production**: https://admin-panel.app
- **Cloud Run**: https://sogo-admin-panel-719518718236.us-central1.run.app

## Multi-Tenant Configuration

Tenant configs are in `src/config/tenants.ts`. Each tenant has:

- `clubId` - Unique identifier
- `subdomain` - URL subdomain (e.g., `masseypark.admin-panel.app`)
- `name` - Display name
- `logo` - Logo URL (optional)
- `primaryColor` - Brand color for sidebar/buttons
- `features` - Feature flags
  - `canAddTokens` - Show Add Tokens button
  - `canViewRounds` - Show Rounds History section

## Project Structure

```
src/
├── api/           # API client (CosmosDB)
├── components/    # Reusable UI components
├── config/        # Tenant configuration
├── contexts/      # React contexts (Auth, Tenant)
├── pages/         # Page components
└── types/         # TypeScript types
```
