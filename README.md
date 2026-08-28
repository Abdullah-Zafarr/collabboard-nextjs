# CollabBoard

CollabBoard is a realtime, multi-user Kanban board built as a creative extension of Vercel's Next.js + Supabase starter. Teams can create private workspaces, invite registered users, move tasks between columns, discuss work, and attach files.

## Features

- Supabase email/password authentication
- Private multi-user workspaces
- Native drag-and-drop Kanban board
- Task priorities, descriptions, deadlines, and assignees
- Realtime board and activity updates
- Task comments and private file attachments
- Owner-controlled member invitations
- Row Level Security on every application table
- Responsive Next.js App Router interface

## Local setup

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. Open the Supabase SQL editor and run [`supabase/migrations/20260828000000_create_collab_board.sql`](supabase/migrations/20260828000000_create_collab_board.sql).
3. Copy `.env.example` to `.env.local` and add the values from **Project Settings → API**:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
   ```

4. Install dependencies and start the app:

   ```bash
   npm install
   npm run dev
   ```

5. Open `http://localhost:3000`, create an account, and create your first workspace.

Invited teammates must already have a CollabBoard account. This keeps the MVP invitation flow simple and prevents exposing the authentication user directory.

## Database model

The migration creates `profiles`, `workspaces`, `workspace_members`, `board_columns`, `tasks`, `comments`, `attachments`, and `activity_logs`. It also creates the private `task-attachments` Storage bucket, realtime publication entries, user-profile trigger, workspace creation RPC, invitation RPC, indexes, and RLS policies.

All authorization is enforced in Postgres. Client-side route and button checks are presentation conveniences rather than the security boundary.

## Verification

```bash
npm run lint
npm run build
```

