# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**UIGen** is an AI-powered React component generator that uses Claude to create React components based on user descriptions. The app features a split-panel UI with a chat interface on the left and a live preview/code editor on the right. Users can describe components, see them generated and rendered in real-time, and save their projects if authenticated.

## Quick Commands

- **`npm run setup`** - Install dependencies, generate Prisma client, run migrations (run once after cloning)
- **`npm run dev`** - Start development server on http://localhost:3000 with Turbopack
- **`npm run dev:daemon`** - Start dev server in background, logs to logs.txt
- **`npm run build`** - Build for production
- **`npm run start`** - Start production server
- **`npm test`** - Run unit tests with Vitest
- **`npm run lint`** - Run ESLint
- **`npm run db:reset`** - Force reset database (drops and recreates from schema)

For running single tests, use Vitest: `npx vitest --run src/components/chat/__tests__/MessageInput.test.tsx`

## Architecture & Key Concepts

### Virtual File System (VFS)
The app uses an in-memory VirtualFileSystem (`src/lib/file-system.ts`) that represents a tree of files and directories without writing to disk. This allows Claude to generate React component files and the preview to dynamically render them. The VFS is serialized and sent to the AI API, and deserialized from the response. Files are never persisted to the actual filesystem—only project metadata and serialized VFS state are saved to the database.

### AI Integration
- Claude AI is called via `/api/chat` (POST endpoint at `src/app/api/chat/route.ts`)
- Uses Vercel AI SDK (`ai` package) with `@ai-sdk/anthropic` provider
- The `MockLanguageModel` in `src/lib/provider.ts` provides fallback behavior when no API key is set—it returns static component examples instead of real AI generation
- AI has two tool calls available: `str_replace_editor` and `file_manager` to create/update files in the VFS
- Prompt is defined in `src/lib/prompts/generation.tsx`—governs AI behavior (React+Tailwind, virtual FS, import aliases)
- Maximum 40 AI steps per request (limited to 4 for mock provider to prevent repetition)

### UI Layout & State Management
- **Two-panel split UI**: Chat panel (left, 35% default) and Preview/Code panel (right, 65% default)
- **Chat Context** (`src/lib/contexts/chat-context.tsx`): Wraps `useChat` from Vercel AI SDK, manages messages and form submission
- **FileSystem Context** (`src/lib/contexts/file-system-context.tsx`): Manages VirtualFileSystem state and handles tool calls from the AI (routing them to create/update/delete files)
- **Resizable panels** allow users to adjust split ratio dynamically

### Project Persistence
- Authenticated users can save projects to SQLite (via Prisma)
- Schema: `User` (email, password) → `Project` (name, messages, data/serialized VFS)
- When a user submits a message, the chat response and VFS state are saved to the project in `onFinish` callback
- Anonymous users can only work in-memory (tracked via `setHasAnonWork` for analytics)

## Project Structure

```
src/
├── app/                 # Next.js app router (15 with App Router)
│   ├── page.tsx        # Home (redirects authenticated users to their project)
│   ├── [projectId]/    # Dynamic route for viewing a saved project
│   ├── layout.tsx      # Root layout wrapper
│   ├── main-content.tsx # Main UI container with resizable panels
│   └── api/chat/       # AI chat endpoint (receives messages, files, calls Claude)
├── components/         # React components
│   ├── auth/          # Sign up, sign in dialogs
│   ├── chat/          # Chat UI (message list, input, markdown renderer)
│   ├── editor/        # Code editor (Monaco) and file tree
│   ├── preview/       # Component preview iframe
│   └── ui/            # Shadcn/radix-ui primitives (button, dialog, tabs, etc.)
├── lib/
│   ├── file-system.ts # VirtualFileSystem class
│   ├── provider.ts    # Claude AI model + MockLanguageModel
│   ├── auth.ts        # Session management (JWT with jose)
│   ├── prisma.ts      # Prisma client singleton
│   ├── contexts/      # React contexts (chat, file system)
│   ├── tools/         # Tool builders for AI (str_replace_editor, file_manager)
│   ├── prompts/       # System prompt for component generation
│   ├── transform/     # Utilities (likely for code transformation)
│   └── anon-work-tracker.ts # Analytics for anonymous sessions
└── actions/           # Server actions (getUser, getProjects, createProject)
```

## Testing

- Uses **Vitest** with jsdom environment (configured in `vitest.config.mts`)
- Test files: `src/**/__tests__/*.test.tsx`
- Coverage includes Chat components (MessageInput, MessageList, MarkdownRenderer), FileTree, and some contexts
- Tests use `@testing-library/react` and `@testing-library/user-event`

## Environment Setup

- Optional `.env` file for `ANTHROPIC_API_KEY` — if not set, app uses MockLanguageModel and returns static examples
- Database: SQLite at `prisma/dev.db` (auto-created on first `npm run setup`)
- Prisma client generated to `src/generated/prisma` (committed after generation)

## Deployment & Production

- Built for Vercel/serverless: uses `next/server` APIs, sets `maxDuration = 120s` for API routes
- Node.js 18+ required
- `node-compat.cjs` loaded via NODE_OPTIONS to handle Node.js globals in edge runtime

## Key Dependencies & Versions

- **Next.js 15.3.3** with Turbopack bundler
- **React 19**, TypeScript 5
- **Tailwind CSS v4** (via `@tailwindcss/postcss` and `tailwindcss` v4)
- **@ai-sdk/anthropic 1.2.12**, **ai 4.3.16** (Vercel AI SDK)
- **Prisma 6.10.1** with SQLite
- **Radix UI** primitives for accessible components
- **Monaco Editor** for code editing
- **Vitest 3.2.4** for testing

## Common Development Patterns

1. **Adding a new component**: Place in `src/components/` with optional `__tests__/` subfolder for tests
2. **Database changes**: Update `prisma/schema.prisma`, then `npx prisma migrate dev` to generate migration
3. **Calling Claude AI**: POST to `/api/chat` with `{messages, files, projectId}` — the endpoint streams a response with tool calls
4. **Accessing authenticated user**: Use server-side `getSession()` from `src/lib/auth.ts`
5. **UI components**: Import from `src/components/ui/` (Radix + Tailwind primitives)
6. **Understanding database data**: Reference `prisma/schema.prisma` anytime you need to understand the data models and relationships

## Code Quality

- **Comments**: Use comments sparingly—only for complex or non-obvious code. Keep straightforward logic clean and uncluttered.

## Notable Design Choices

- **Virtual FS over disk writes**: Keeps the generated code sandboxed and allows previewing without filesystem side effects
- **Mock provider fallback**: Graceful degradation when API key is missing; still demonstrates UI and component generation flow
- **Streaming AI responses**: Uses Vercel AI SDK's `streamText()` to handle long-running agentic tasks with tool calls
- **Ephemeral prompt caching**: Uses Anthropic's prompt caching to reduce token usage on system prompt (~1.3KB)
