# Accounting Workspace

Accounting Workspace is a Next.js application for managing purchase invoices, creditors, and stock master data. It acts as a frontend and API proxy layer on top of an existing backend, with authentication, MFA, invite-based onboarding, and AI-assisted invoice preview/review flows.

## Features

- Purchase invoice workflow
  - Upload invoices and create preview tasks
  - Review extracted data before submission
  - Handle batch/group review flows
  - Re-run analysis and submit finalized invoices
  - View invoice history and detail records
- Creditor management
  - Search, view, and maintain creditor records
  - Open creditor detail panels from the management view
- Stock management
  - Manage stock items
  - Manage stock groups
  - Manage tax codes
- Authentication
  - Login and registration flows
  - MFA setup and confirmation
  - Invite-based registration support
  - Session bootstrap and refresh handling
- AI-assisted preview
  - Invoice preview pipeline driven by backend AI/OCR services
  - Configured through `GEMINI_API_KEY` for AI-related preview services

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS 4
- Motion
- Radix UI / shadcn-style components
- Redis for pending auth state recovery

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `env.example` to `.env.local` and fill in the values for your environment.

```bash
cp env.example .env.local
```

### 3. Run the development server

```bash
npm run dev
```

Open `http://localhost:3000`.

The root route redirects to `/purchase-invoice`.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | API key used by the AI preview pipeline. |
| `APP_URL` | Yes | Public URL of this app. Used for invite links, callbacks, and self-referential URLs. |
| `BACKEND_BASE_URL` | Yes | Base URL of the upstream backend that powers the proxy API routes. |
| `REDIS_URL` | Yes | Redis connection string used for pending auth state recovery. |

Example:

```env
GEMINI_API_KEY="your-key"
APP_URL="http://localhost:3000"
BACKEND_BASE_URL="http://api.example.com"
REDIS_URL="redis://localhost:6379"
```

## Available Scripts

- `npm run dev` - Start the Next.js development server on port 3000
- `npm run build` - Build the app for production
- `npm start` - Run the production server on port 3000
- `npm run lint` - Type-check the project with `tsc --noEmit`

## Main Routes

- `/login` - Sign in
- `/register` - Create an account
- `/totp` and `/toptp` - MFA setup / enrollment flow
- `/invite/[inviteCode]` - Invite acceptance page
- `/purchase-invoice` - Purchase invoice workspace
- `/purchase-invoice/[taskId]` - Invoice preview and review page
- `/purchase-invoice/batch/[groupId]` - Batch/group review page
- `/purchase-invoice/group/[itemId]` - Batch item detail page
- `/creditor-manage` - Creditor management
- `/stock-manage` - Stock, stock group, and tax code management
- `/profile` - User profile page

## Architecture Overview

This project is a frontend-first workspace with a thin Next.js API layer:

- UI lives in `src/components`
- Route handlers live in `src/app/api`
- Most API routes proxy to `BACKEND_BASE_URL`
- Authentication state is coordinated through cookies and middleware
- Protected pages are guarded by `middleware.ts` and the app layout

Key behaviors:

- Visiting `/` redirects to `/purchase-invoice`
- Unauthenticated users are redirected through the auth refresh/bootstrap flow
- Invite pages remain publicly accessible
- The app uses server route handlers to keep upstream credentials and tokens out of the browser

## Project Structure

```text
src/
  app/
    (auth)/         Auth pages
    (app)/          Main authenticated workspace
    api/            Next.js route handlers and backend proxy endpoints
  components/       Shared UI and feature components
  lib/              API clients, auth helpers, utilities, and stores
api/                Markdown API notes and reference docs
```

## Notes

- Some local development files are intentionally not part of version control.
- The application depends on an upstream backend being available and correctly configured.
- If the backend is unreachable, many screens will still render, but data loading and submission flows will fail.

## Development Tips

- Keep `env.example` updated when adding new environment variables.
- Update this README when adding new top-level routes or major workflows.
- If you change auth behavior, review `middleware.ts` and the auth helpers in `src/lib`.
