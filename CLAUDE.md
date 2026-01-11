# SOGO Admin Panel v2

## What This App Does
Admin panel for the SOGO Golf mobile app - a golf scoring and social app used by golfers across Australia.

**Key Functions:**
- **Golfer Lookup** - Search golfers by GolfLink number, view their profile, transaction history, and token balance. Admins can add/debit tokens (credits used in the app).
- **Golfers** - Browse and search all registered golfers with filters.
- **Rounds** - Monitor golf rounds in real-time. See rounds "in progress" and "submitted" today. Expandable rows show hole-by-hole scorecards.
- **Closed Comps** - Manage private competitions (see detailed description below).
- **Notifications** - Send push notifications to golfers (by audience: all, club, state, gender, or individual).
- **Admin Users** - Manage who has access to this admin panel and what features they can see.
- **Audit Log** - Track admin actions like token credits/debits (super admin only).

**Users of this admin panel:**
- SOGO staff (super admins) - full access
- Golf club administrators - limited to their club's golfers/rounds

## Tech Stack
- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **State:** TanStack React Query (with localStorage persistence)
- **Tables:** TanStack React Table
- **Auth:** Firebase Authentication
- **Backend APIs:**
  - CosmosDB (Azure) - for golfers, transactions, audit logs
  - MongoDB API (Google Cloud Run) - for rounds, notifications, closed comps, admin users
    - **Backend source:** `/Users/angusjohnston/src-dotnet/simplegolf/mongoapi/MongoApi/`
    - Key files: `Endpoints/RoundEndpoint.cs`, `Endpoints/ClosedCompEndpoint.cs`

## Key Directories
```
src/
├── api/              # API clients (cosmosdb.ts, mongodb.ts)
├── components/       # Reusable UI components
├── contexts/         # React contexts (AuthContext, TenantContext)
├── pages/            # Page components
├── services/         # Business logic layer
├── types/            # TypeScript interfaces
└── config/           # Tenant configurations
```

## Important Files
| File | Purpose |
|------|---------|
| `src/App.tsx` | Routes, layout, menu items |
| `src/contexts/AuthContext.tsx` | Firebase auth + admin permissions |
| `src/api/cosmosdb.ts` | CosmosDB queries (golfers, transactions, audit logs) |
| `src/api/mongodb.ts` | MongoDB API calls (rounds, notifications, etc.) |
| `src/pages/Rounds.tsx` | Rounds page with polling for updates |
| `src/pages/AuditLog.tsx` | Super admin audit log viewer |

## User Roles
- `super_admin` - Full access, sees Audit Log
- `club_admin` - Limited to assigned clubs, feature-based access

## Features by Permission
Menu items are controlled by `adminUser.features` array:
- `golfer-lookup`, `golfers`, `rounds`, `closed-comps`, `notifications`, `admin-users`
- Audit Log is `superAdminOnly` (role-based, not feature-based)

## Key Patterns

### API Providers
Switchable between CosmosDB and MongoDB via `VITE_API_PROVIDER` env var.

### Query Caching
React Query with localStorage persistence (`@tanstack/react-query-persist-client`). Cache persists for 24 hours.

### Rounds Page Polling
Polls for count changes every 30 seconds. Shows "Round updates available" notification when counts differ.

### Audit Logging
Admin credit/debit transactions are logged to CosmosDB. View via Audit Log page (super admin only).

## Closed Comps (Private Competitions)

Closed Comps are private golf competitions that golfers create and manage through the SOGO mobile app. The admin panel provides oversight and management capabilities.

### What is a Closed Comp?
A private competition where:
- An **owner** (golfer) creates the comp and sets the rules
- Participants join via an **invite code** shared by the owner
- Players submit rounds from their regular golf games to compete
- A **leaderboard** tracks rankings based on submitted scores

### Competition Settings
| Setting | Description |
|---------|-------------|
| **Name** | Display name of the competition |
| **Comp Type** | Scoring format: Stableford, Stroke, or Par |
| **Max Rounds** | How many rounds count toward final score (e.g., best 3 of unlimited) |
| **Holes Per Round** | 9 or 18 holes |
| **Round Selection Mode** | `best` = new better rounds replace worse ones; `first` = first N rounds are locked in |
| **Start/End Date** | Competition window - rounds outside this period don't count |
| **Timezone** | For date calculations |
| **Prize** | Optional prize description shown to participants |

### Participant Statuses
- `invited` - Received invite but hasn't accepted yet
- `accepted` - Active participant who can submit rounds
- `blocked` - Removed from competition by admin/owner

### Admin Panel Capabilities
**List View (`/closed-comps`):**
- Browse all closed comps with filters (status, search)
- See owner, invite code, participant count, dates
- Create new closed comps (admin becomes owner)

**Detail View (`/closed-comps/:id`):**
- **Overview Tab**: Edit comp settings, change status (active/closed), delete comp
- **Participants Tab**: View all participants, block/unblock players
- **Rounds Tab**: See all submitted rounds with scores, expandable scorecards
- **Leaderboard Tab**: Current rankings with total scores

### Key Files
- `src/pages/ClosedComps.tsx` - List view with create modal
- `src/pages/ClosedCompDetail.tsx` - Detail view with tabs
- `src/api/mongodb.ts` - API functions (`getClosedComps`, `createClosedComp`, `updateClosedComp`, etc.)
- `src/types/index.ts` - Types: `ClosedComp`, `ClosedCompParticipant`, `ClosedCompRound`, `LeaderboardEntry`

### MongoDB Data Model

**Collection: `closedComps`**
```javascript
{
  _id: ObjectId,
  entityId: string,              // Optional tenant/entity ID
  ownerId: string,               // Golfer ID of creator
  ownerFirstName: string,
  ownerLastName: string,
  ownerEmail: string,
  name: string,                  // Competition name
  inviteCode: string,            // Unique code to join (e.g., "ABC123")
  compTypes: string[],           // ["stableford"] or ["stroke", "par"]
  maxRounds: number,             // How many rounds count toward total
  holesPerRound: number,         // 9 or 18
  roundSelectionMode: "best" | "first",
  prize: string,                 // Optional prize description
  startDate: ISODate,
  endDate: ISODate,
  timezone: string,              // e.g., "Australia/Sydney"
  status: "active" | "closed",
  participantCount: number,      // Denormalized count
  createdDate: ISODate,
  updateDate: ISODate
}
```

**Collection: `closedCompParticipants`**
```javascript
{
  _id: ObjectId,
  compId: string,                // Reference to closedComps._id
  compName: string,              // Denormalized for display
  golferId: string,
  golferFirstName: string,
  golferLastName: string,
  golferEmail: string,
  golferImageUrl: string,
  isOwner: boolean,              // True if this participant created the comp
  status: "invited" | "accepted" | "blocked",
  roundsSubmitted: number,       // Denormalized count
  invitedDate: ISODate,
  acceptedDate: ISODate,
  blockedDate: ISODate,
  createdDate: ISODate,
  updateDate: ISODate
}
```

**Collection: `closedCompRounds`**
```javascript
{
  _id: ObjectId,
  compId: string,                // Reference to closedComps._id
  compName: string,              // Denormalized
  roundId: string,               // Reference to rounds collection
  golferId: string,
  golferFirstName: string,
  golferLastName: string,
  golferEmail: string,
  golferImageUrl: string,
  score: number,                 // The score for this round (stableford points, strokes, etc.)
  compType: string,              // "stableford", "stroke", or "par"
  clubName: string,              // Where the round was played
  roundDate: ISODate,
  submittedDate: ISODate,        // When submitted to this comp
  createdDate: ISODate,
  updateDate: ISODate
}
```

### Round Auto-Inclusion Logic (Backend)
When a golfer submits a round, the backend should automatically add it to eligible closed comps:
1. Golfer is `accepted` participant in the comp
2. Comp `status` is `active`
3. Round date is within `startDate` to `endDate`
4. Round's comp type matches one of comp's `compTypes`
5. Round's hole count matches `holesPerRound`

Then apply `roundSelectionMode`:
- `best`: Keep top N scores (by `maxRounds`), replace worse ones
- `first`: Keep first N submitted, reject any after

## Environment Variables
```
VITE_SOGO_API_URL=https://sogo-api.azure-api.net/sogo-general
VITE_AZURE_API_KEY=<key>
VITE_MONGODB_API_URL=https://mongo-api-613362712202.australia-southeast1.run.app
VITE_API_PROVIDER=cosmosdb
```

## Deployment
**IMPORTANT:** Always use the deploy script, not raw gcloud commands:
```bash
sh scripts/deploy.sh
```
Deploys to Google Cloud Run (project: sogo-golf, service: sogo-admin-panel, region: us-central1).

## Development
```bash
npm run dev    # Start dev server at localhost:5173
npm run build  # Type check + production build
```

## Conventions
- Use existing service layer pattern for new features
- Super admin features use `requireSuperAdmin` prop on ProtectedRoute
- Feature-based access uses `requiredFeature` prop
- Keep API logic in `src/api/`, business logic in `src/services/`
