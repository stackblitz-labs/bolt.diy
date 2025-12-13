# Website Information Collection Agent

## Overview

The Website Information Collection Agent is an LLM-based conversational agent that collects information from users for website generation. It guides users through providing optional website and Google Maps URLs, along with a required description of their desired website.

**Status**: ✅ Implemented (Phases 1-5 complete)  
**Spec**: `specs/001-info-collection-agent/spec.md`  
**Plan**: `specs/001-info-collection-agent/plan.md`

## Features

### User Stories Implemented

1. **Complete Information Collection (US1)** - Priority: P1
   - Collect website URL (optional)
   - Collect Google Maps URL (optional)
   - Collect website description (required)
   - Finalize and queue for crawler processing

2. **Partial Information Collection (US2)** - Priority: P2
   - Support description-only flow
   - Allow users to skip both URL fields
   - Clear communication that URLs are optional

3. **Information Correction and Update (US3)** - Priority: P3
   - Correct any previously entered field
   - Delete session and start over
   - Validation on corrections

## Architecture

### Technology Stack

- **LLM Integration**: Vercel AI SDK with tool calling
- **Database**: Supabase/PostgreSQL for session storage
- **State Management**: Nanostores (client) + Zustand
- **Authentication**: Better Auth (existing)
- **Validation**: Zod schemas

### System Components

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Chat UI    │────▶│  API Route   │────▶│ LLM Provider│
│  (React)    │     │  /api/chat   │     │ (OpenAI)    │
└─────────────┘     └──────┬───────┘     └──────┬──────┘
                           │                     │
                           ▼                     ▼
                    ┌────────────────────────────────┐
                    │  Info Collection Tools         │
                    │  - startInfoCollection         │
                    │  - collectWebsiteUrl           │
                    │  - collectGoogleMapsUrl        │
                    │  - collectDescription          │
                    │  - updateCollectedInfo         │
                    │  - finalizeCollection          │
                    │  - deleteSession               │
                    │  - getSessionState             │
                    └────────────┬───────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────────┐
                    │  Supabase Database           │
                    │  info_collection_sessions    │
                    └──────────────┬───────────────┘
                                   │
                                   ▼ (async queue)
                    ┌──────────────────────────────┐
                    │  Crawler Service (future)    │
                    └──────────────────────────────┘
```

## Database Schema

### Table: `info_collection_sessions`

```sql
CREATE TABLE info_collection_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  
  -- Collected data
  website_url TEXT,
  website_url_validated BOOLEAN DEFAULT FALSE,
  google_maps_url TEXT,
  google_maps_url_validated BOOLEAN DEFAULT FALSE,
  website_description TEXT,
  
  -- Session state
  status VARCHAR(30) NOT NULL DEFAULT 'in_progress',
  chat_id VARCHAR(255),
  current_step VARCHAR(50) DEFAULT 'website_url',
  
  -- Crawler integration
  crawler_job_id UUID,
  crawler_output JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

**Status Values**:
- `in_progress` - Session active
- `completed` - User confirmed, not yet queued
- `crawler_queued` - Sent to crawler
- `crawler_completed` - Crawler finished
- `cancelled` - User cancelled

**Step Values**:
- `website_url` - Collecting website URL
- `google_maps_url` - Collecting Google Maps URL
- `description` - Collecting description
- `review` - User reviewing information
- `completed` - Session finalized

## API Endpoints

### REST API: `/api/info-collection`

#### GET - List Sessions
```http
GET /api/info-collection
Authorization: Required (session cookie)
```

**Response**:
```json
{
  "sessions": [...],
  "total": 5
}
```

#### GET - Get Active Session
```http
GET /api/info-collection?active=true
Authorization: Required (session cookie)
```

**Response**:
```json
{
  "success": true,
  "session": {
    "id": "uuid",
    "userId": "user-id",
    "websiteUrl": "https://example.com",
    "googleMapsUrl": null,
    "websiteDescription": "A modern restaurant website",
    "status": "in_progress",
    "currentStep": "review",
    ...
  }
}
```

#### GET - Get Specific Session
```http
GET /api/info-collection/:id
Authorization: Required (session cookie)
```

**Response**:
```json
{
  "success": true,
  "session": { ... }
}
```

#### POST - Create Session
```http
POST /api/info-collection
Authorization: Required (session cookie)
Content-Type: application/json

{
  "chatId": "optional-chat-id"
}
```

**Response**:
```json
{
  "success": true,
  "session": { ... },
  "message": "Session created successfully"
}
```

#### DELETE - Delete Session
```http
DELETE /api/info-collection/:id
Authorization: Required (session cookie)
```

**Response**:
```json
{
  "success": true,
  "message": "Session deleted successfully"
}
```

## AI Tools

The agent uses the following Vercel AI SDK tools:

### `startInfoCollection`
Starts a new session or resumes an existing one.

**Parameters**: None  
**Returns**: Session ID and current state

### `collectWebsiteUrl`
Records whether user has a website and collects URL if present.

**Parameters**:
- `sessionId: string`
- `hasWebsite: boolean`
- `url?: string`

**Returns**: Success status, next step

### `collectGoogleMapsUrl`
Records whether user has a Google Maps listing and collects URL if present.

**Parameters**:
- `sessionId: string`
- `hasListing: boolean`
- `url?: string`

**Returns**: Success status, next step

### `collectDescription`
Records user's description of desired website.

**Parameters**:
- `sessionId: string`
- `description: string`

**Returns**: Success status, collected data summary

### `updateCollectedInfo`
Updates a previously collected field (for corrections).

**Parameters**:
- `sessionId: string`
- `field: 'websiteUrl' | 'googleMapsUrl' | 'websiteDescription'`
- `newValue: string`

**Returns**: Success status, updated session data

### `finalizeCollection`
Completes the session and queues for crawler processing.

**Parameters**:
- `sessionId: string`
- `confirmed: boolean`

**Returns**: Success status, crawler package

### `deleteSession`
Deletes a session when user requests it.

**Parameters**:
- `sessionId: string`

**Returns**: Success status

### `getSessionState`
Gets current state of a session.

**Parameters**:
- `sessionId: string`

**Returns**: Current session state

## Conversation Flow

1. **Initialization**
   - LLM detects website generation intent
   - Calls `startInfoCollection` to create/resume session

2. **Website URL (Optional)**
   - Asks: "Do you have an existing website?"
   - If yes: collects and validates URL
   - If no: proceeds to next step

3. **Google Maps (Optional)**
   - Asks: "Do you have a Google Maps listing?"
   - If yes: collects and validates URL
   - If no: proceeds to next step

4. **Description (Required)**
   - Asks: "Tell me about your desired website"
   - Records any non-empty description

5. **Review & Confirm**
   - Presents summary of collected information
   - Offers correction options
   - On confirmation: finalizes and queues

## URL Validation

### Website URLs
- Accepts `http://` and `https://` protocols
- Adds `https://` if protocol missing
- Validates hostname format (must contain dot)
- Returns normalized URL

### Google Maps URLs
Accepts various formats:
- `google.com/maps/...`
- `maps.google.com/...`
- `goo.gl/maps/...`
- `maps.app.goo.gl/...`

### Place ID Extraction
Extracts Google Place IDs from:
- Query parameter: `?place_id=ChIJ...`
- Path format: `/place/ChIJ...`

## Client State Management

### Stores

**File**: `app/lib/stores/infoCollection.ts`

```typescript
// Active session
export const activeSession = atom<InfoCollectionSession | null>(null);

// Loading state
export const isLoadingSession = atom<boolean>(false);

// Collection progress
export const collectionProgress = map<{
  step: CollectionStep;
  completedSteps: CollectionStep[];
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  description: string | null;
}>();
```

### Actions

```typescript
// Set active session
setActiveSession(session: InfoCollectionSession | null)

// Clear session
clearSession()

// Fetch from API
fetchActiveSession(): Promise<void>
```

## UI Components

### InfoCollectionStatus

**File**: `app/components/chat/InfoCollectionStatus.tsx`

Displays:
- Progress indicator with 4 steps
- Current step label with optional/required markers
- Collected data preview
- Correction hint during review

**Features**:
- Visual step completion (green checkmarks)
- Current step highlighting (accent color)
- Optional field indicators
- Helpful hints for corrections

## Environment Variables

### Required

```bash
# Supabase connection (for session storage)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
```

### Optional (from existing config)

```bash
# Better Auth (already configured)
DATABASE_URL=postgresql://...
```

## Migration

**File**: `supabase/migrations/20251209000000_info_collection_sessions.sql`

### To Apply

```bash
# Local development
pnpm supabase migration up

# Production
pnpm supabase db push --linked
```

### Verification

```sql
-- Check table exists
SELECT * FROM info_collection_sessions LIMIT 1;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'info_collection_sessions';

-- Check indexes
SELECT * FROM pg_indexes WHERE tablename = 'info_collection_sessions';
```

## Testing

### User Flow Testing

1. **Complete flow**: Provide all information
   ```
   User: "I want to create a website"
   AI: Starts collection, asks for website
   User: Provides website, Google Maps, description
   AI: Reviews, user confirms
   Result: Session finalized, queued for crawler
   ```

2. **Description-only flow**: Skip URLs
   ```
   User: "I want to create a website"
   AI: Asks for website
   User: "I don't have one"
   AI: Asks for Google Maps
   User: "No"
   AI: Asks for description
   User: Provides description
   Result: Session finalized with nulls for URLs
   ```

3. **Correction flow**: Update fields
   ```
   User: Completes collection
   AI: Shows review
   User: "Change the website URL to..."
   AI: Updates field, shows new summary
   User: Confirms
   Result: Session finalized with corrected data
   ```

4. **Deletion flow**: Start over
   ```
   User: In middle of collection
   User: "Let's start over"
   AI: Deletes session
   Result: Fresh session created
   ```

## Error Handling

### Tool Errors

- **Invalid URL**: Clear error message, ask to retry or skip
- **Missing session**: Create new session automatically
- **Database errors**: Graceful failure, log error

### Validation Errors

- **Empty description**: Not allowed (required field)
- **Invalid URL format**: Explained, ask for correction
- **Wrong Google Maps domain**: Specific error message

## Future Integration

### Crawler Service

When crawler service is implemented:

1. Uncomment in `infoCollectionService.ts`:
   ```typescript
   // TODO: Queue crawler job here
   // await crawlerQueue.enqueue(crawlerPackage);
   ```

2. Create queue (e.g., Cloudflare Queue, AWS SQS)

3. Crawler processes `CrawlerDataPackage`:
   ```typescript
   {
     sessionId: string;
     userId: string;
     websiteUrl: string | null;
     googleMapsUrl: string | null;
     userDescription: string;
     createdAt: string;
   }
   ```

4. Crawler calls back with results:
   ```typescript
   await infoCollectionService.updateCrawlerOutput(
     sessionId,
     crawlerJobId,
     output
   );
   ```

## Files Structure

```
app/
├── lib/
│   ├── services/
│   │   └── infoCollectionService.ts       # Database operations
│   ├── tools/
│   │   └── infoCollectionTools.ts         # AI SDK tools
│   ├── stores/
│   │   └── infoCollection.ts              # Client state
│   └── prompts/
│       └── infoCollectionPrompt.ts        # System prompt
├── routes/
│   ├── api.info-collection.ts             # REST endpoints
│   └── api.chat.ts                        # Modified (tool registration)
├── types/
│   └── info-collection.ts                 # TypeScript types
├── utils/
│   └── urlValidation.ts                   # URL validators
└── components/
    └── chat/
        └── InfoCollectionStatus.tsx       # Status UI

supabase/
└── migrations/
    └── 20251209000000_info_collection_sessions.sql

docs/
└── info-collection-agent.md               # This file
```

## Troubleshooting

### Session Not Persisting
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in env
- Verify migration applied: `SELECT * FROM info_collection_sessions;`
- Check RLS policies allow user access

### Tool Not Being Called
- Verify detection logic in `api.chat.ts` (keywords: "generate website", "create website", "build website")
- Check tool registration in `allTools` object
- Verify `userId` is available from session

### URL Validation Failing
- Check URL format (must have valid domain)
- For Google Maps: must contain valid hostname patterns
- Review validation logic in `urlValidation.ts`

### UI Not Updating
- Check `fetchActiveSession()` is called on mount
- Verify nanostores subscriptions with `useStore()`
- Check React component re-rendering

## Maintenance

### Adding New Fields

1. Update migration: Add column to `info_collection_sessions`
2. Update types: Add field to `InfoCollectionSession`
3. Update service: Add method in `infoCollectionService.ts`
4. Update tools: Add tool or update existing in `infoCollectionTools.ts`
5. Update UI: Add to `InfoCollectionStatus.tsx`
6. Update prompt: Add to system prompt

### Changing Conversation Flow

1. Update prompt: Modify `INFO_COLLECTION_SYSTEM_PROMPT`
2. Update step order: Modify `CollectionStep` type
3. Update UI: Modify `STEP_ORDER` and `STEP_LABELS`
4. Update migration: Modify CHECK constraint on `current_step`

## Performance Considerations

- Sessions are user-specific (RLS enforced)
- Active session query uses index on `(user_id, status)`
- Tool calls are async, non-blocking
- Client state updates optimistically

## Security

- ✅ Authentication required (Better Auth)
- ✅ Row-level security on sessions table
- ✅ User ID validated on all operations
- ✅ URLs validated before storage
- ✅ No sensitive data in client state
- ✅ Service key used server-side only

## Support

For issues or questions:
1. Check this documentation
2. Review spec: `specs/001-info-collection-agent/spec.md`
3. Review plan: `specs/001-info-collection-agent/plan.md`
4. Check implementation tasks: `specs/001-info-collection-agent/tasks.md`

