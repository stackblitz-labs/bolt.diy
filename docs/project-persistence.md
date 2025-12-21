# Project Persistence Documentation

## Overview

The User Project Tables feature provides server-side persistence for user projects, chat history, and generated source code. This replaces the previous client-side IndexedDB storage with PostgreSQL (Supabase) while maintaining the same StackBlitz-style snapshot structure for minimal code changes.

## Features

- **Cross-device access** - Projects are stored on the server and accessible from any device
- **Chat history persistence** - All conversations are saved and restored across sessions
- **Source code snapshots** - Generated code persists and can be restored to WebContainer
- **Project management** - Create, rename, delete, and organize projects
- **Status workflow** - Track projects through draft → published → archived states
- **Soft limits** - 10 projects per user with visual indicators and upgrade prompts

## Architecture

### Database Schema

The implementation uses three main tables in PostgreSQL:

```sql
-- Projects table: Stores project metadata
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  url_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project messages: Stores chat history
CREATE TABLE project_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  message_id VARCHAR(255) NOT NULL,
  sequence_num INTEGER NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  annotations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, sequence_num)
);

-- Project snapshots: Stores file system state
CREATE TABLE project_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  files JSONB NOT NULL DEFAULT '{}',
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT snapshot_size_limit CHECK (pg_column_size(files) <= 52428800)
);
```

### API Endpoints

#### Projects API
- `GET /api/projects` - List user's projects with pagination and filtering
- `POST /api/projects` - Create new project (max 10 per user)
- `GET /api/projects/:id` - Get project details
- `PATCH /api/projects/:id` - Update project (name, description, status)
- `DELETE /api/projects/:id` - Delete project and associated data

#### Messages API
- `GET /api/projects/:id/messages` - Get chat history with pagination
- `POST /api/projects/:id/messages` - Save chat messages to server

#### Snapshots API
- `GET /api/projects/:id/snapshot` - Get file system snapshot
- `PUT /api/projects/:id/snapshot` - Save file system snapshot

### Error Handling

The system includes comprehensive error handling with:

- **Global Error Boundary** - Catches and handles project-related errors
- **Retry Logic** - Exponential backoff for failed API calls (max 3 retries)
- **Error Classification** - Different handling for authentication, network, and server errors
- **User Feedback** - Clear error messages and recovery options

### Loading States

Enhanced loading experience with:
- **Skeleton Components** - Animated placeholders for project cards, chat messages, and file trees
- **Progress Indicators** - Visual feedback during long operations
- **Loading Overlays** - Prevent interaction during critical operations

## Usage

### Creating a Project

```typescript
import { useProjects } from '~/lib/persistence/useProjects';

const { createProject, isLoading, error } = useProjects();

const handleCreate = async () => {
  const project = await createProject({
    name: 'My Restaurant Website',
    description: 'A modern restaurant website with online ordering',
    gmaps_url: 'https://maps.google.com/...'
  });
};
```

### Accessing Chat History

```typescript
import { useChatHistory } from '~/lib/persistence/useChatHistory';

// In your chat component
const { messages, ready, storeMessageHistory } = useChatHistory(projectId);

// Messages automatically sync to server when authenticated
```

### Managing Project Status

```typescript
const { updateProjectStatus } = useProjects();

// Change project status
await updateProjectStatus(projectId, 'published');
```

## Error Codes

| Code | Description | Recovery |
|------|-------------|----------|
| 401 | Authentication required | Redirect to login |
| 403 | Project limit reached (10) | Delete projects or upgrade |
| 404 | Project not found | Check project ID |
| 413 | Snapshot too large (>50MB) | Remove large files |
| 500 | Server error | Retry automatically |
| 429 | Rate limited | Automatic retry with backoff |

## Migration Instructions

### From IndexedDB (Development)

No automatic migration is provided for development environments. Users will need to:

1. Export important projects from old IndexedDB storage
2. Create new projects in the server-based system
3. Restore files and continue development

### Data Access

Legacy IndexedDB data can be accessed through browser dev tools:
1. Open DevTools → Application → Storage → IndexedDB
2. Export chat history and snapshots manually
3. Import into new projects via the UI

## Performance Considerations

### Snapshot Size Limits
- Maximum snapshot size: 50MB
- Large binary files should be avoided
- Consider using external storage for assets

### API Rate Limits
- No explicit rate limiting implemented
- Built-in retry logic handles temporary failures
- Consider implementing rate limiting for production

### Database Optimization
- Indexes on frequently queried columns
- JSONB storage for efficient file map access
- Row-level security for multi-tenant access

## Development Guide

### Adding New Project Features

1. **Database Changes**
   ```sql
   -- Add migration to supabase/migrations/
   ALTER TABLE projects ADD COLUMN new_field VARCHAR(255);
   ```

2. **TypeScript Types**
   ```typescript
   // Update app/types/project.ts
   export interface Project {
     // ... existing fields
     new_field: string | null;
   }
   ```

3. **API Updates**
   ```typescript
   // Update app/lib/services/projects.server.ts
   export async function updateProjectFeature(projectId: string, data: any) {
     // Implementation
   }
   ```

4. **Frontend Integration**
   ```typescript
   // Update app/lib/persistence/useProjects.ts
   const updateFeature = useCallback(async (projectId: string, value: any) => {
     // API call and state update
   }, []);
   ```

### Testing

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test -- --grep "projects"
pnpm test -- --grep "persistence"
```

### Local Development

```bash
# Start Supabase locally
supabase start

# Reset database (migrations only)
supabase db reset

# View database logs
supabase logs db
```

## Security Considerations

### Row-Level Security (RLS)

All tables implement RLS policies:
- Users can only access their own projects
- Service role bypass for admin operations
- Tenant-based isolation for multi-tenancy

### Data Validation

- Input validation on all API endpoints
- File size limits for snapshots
- SQL injection prevention through parameterized queries

### Authentication

- Better Auth integration for session management
- JWT tokens for API authentication
- Automatic session refresh

## Troubleshooting

### Common Issues

**Projects not saving**
- Check authentication status
- Verify Supabase connection
- Review browser console for errors

**Snapshot restore failures**
- Verify snapshot size < 50MB
- Check JSON structure integrity
- Review WebContainer initialization

**Performance issues**
- Monitor database query performance
- Check snapshot sizes
- Review API response times

### Debug Tools

```typescript
// Enable debug logging
localStorage.setItem('debug', 'project:*');

// Check authentication
import { isUserAuthenticated } from '~/lib/persistence/db';
console.log('Authenticated:', await isUserAuthenticated());

// Inspect project data
const projects = await getProjectsByUserId(userId);
console.log('Projects:', projects);
```

## Future Enhancements

### Planned Features

- **Real-time collaboration** - Multiple users editing same project
- **Version history** - Git-like versioning for snapshots
- **Team projects** - Shared projects with role-based access
- **Advanced search** - Full-text search across projects and messages

### Scaling Considerations

- **Horizontal scaling** - Read replicas for better performance
- **CDN integration** - Static asset delivery
- **Background jobs** - Async processing for large operations
- **Analytics** - Usage metrics and insights

## Support

For issues related to project persistence:

1. Check this documentation first
2. Review the error messages in browser console
3. Search existing GitHub issues
4. Create new issue with detailed reproduction steps

## API Reference

### Response Formats

#### Project List
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "Project Name",
      "description": "Description",
      "status": "draft|published|archived",
      "url_id": "unique-url-id",
      "message_count": 15,
      "has_snapshot": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 5,
  "has_more": false
}
```

#### Project Details
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "tenant_id": "uuid",
  "name": "Project Name",
  "description": "Description",
  "status": "draft",
  "url_id": "unique-url-id",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z",
  "business_profile": {
    "name": "Business Name",
    "address": "123 Main St",
    "gmaps_url": "https://maps.google.com/..."
  }
}
```

#### Chat Messages
```json
{
  "messages": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "message_id": "ai-sdk-message-id",
      "sequence_num": 1,
      "role": "user|assistant|system",
      "content": "Message content",
      "annotations": [],
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 15,
  "has_more": true
}
```

#### File Snapshot
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "files": {
    "/home/project/src/App.tsx": {
      "type": "file",
      "content": "export default function App() { ... }",
      "isBinary": false
    },
    "/home/project/public": {
      "type": "folder"
    }
  },
  "summary": "Initial project setup",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```