# DAO Portal — Feature Specsheet

**Powered by Powers Protocol**  
**Date:** March 2026  
**Version:** 1.0

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Site Architecture & Routes](#site-architecture--routes)
4. [Authentication & Wallet System](#authentication--wallet-system)
5. [Pages & Features](#pages--features)
   - [Portal Landing Page](#1-portal-landing-page)
   - [Explorer (All DAO Portals)](#2-explorer-all-dao-portals)
   - [All DAOs View](#3-all-daos-view)
   - [DAO View (Main Dashboard)](#4-dao-view-main-dashboard)
   - [Mandate Page](#5-mandate-page)
   - [Action Page](#6-action-page)
   - [Flow Sequence Page](#7-flow-sequence-page)
   - [DAO Info Page](#8-dao-info-page)
   - [User Profile](#9-user-profile)
   - [Public User Profile](#10-public-user-profile)
6. [Shared Components & Systems](#shared-components--systems)
7. [Design System](#design-system)
8. [Data Architecture](#data-architecture)

---

## Overview

The DAO Portal is a web-based governance interface for decentralised autonomous organisations (DAOs). It enables DAO members to browse governance structures, view and vote on active actions, participate in chatroom discussions, and navigate hierarchical DAO/sub-DAO relationships — all through a terminal-inspired, monospace UI aesthetic.

The portal is designed as a **proof-of-concept / prototype** demonstrating the front-end experience for a DAO governance platform powered by **Powers Protocol**.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS + shadcn/ui component library |
| Routing | React Router v6 |
| State Management | React Context (WalletContext), local component state |
| Theming | next-themes (light/dark mode) |
| Data | Static mock data (no backend) |

---

## Site Architecture & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/portal` | Landing | Entry point with wallet connect / view-only options |
| `/all-daos` | All DAOs | Overview of all DAOs with mandate activity |
| `/view/:slug` | DAO View | Main DAO dashboard with mandates, actions, chatroom |
| `/view/:slug/mandate/:mandateId` | Mandate Page | Individual mandate detail with chatroom |
| `/view/:slug/action/:actionId` | Action Page | Individual action detail with voting and chatroom |
| `/view/:slug/action/:actionId/flow` | Flow Sequence | Flow visualisation with chatroom |
| `/dao-info` | DAO Info | Hidden information page about the DAO |
| `/info` | Redirect | Redirects to `/all-daos` |
| `/profile` | User Profile | Connected user's profile and activity |
| `/user/:username` | Public Profile | Public-facing user profile |
| `*` | 404 | Not Found page |

---

## Authentication & Wallet System

### Wallet Connection
- **Simulated wallet connect** via a modal dialog (WalletModal component)
- Supports mock wallet address: `0xe5805f00A7610A9005afb45CA6a00df90Ae2b101` with ENS `participant.eth`
- Users can enter a custom wallet address or ENS name

### Access Modes
| Mode | Description | Capabilities |
|------|-------------|-------------|
| **Connected** | Wallet connected via modal | Full access: voting, chatroom participation, profile |
| **View Only (Anonymous)** | No wallet connected | Browse-only: can view all content, chatrooms locked, voting locked |
| **Not Connected** | Default state | Must connect or enter view-only from landing page |

### Connection State
- Managed via `WalletContext` (React Context)
- Connection status displayed in header across all pages (green dot = connected, grey dot = not connected)
- Disconnect button available on all pages when connected

---

## Pages & Features

### 1. Portal Landing Page
**Route:** `/portal`

- Terminal-style welcome screen with typewriter animation (`> welcome`)
- Two entry options:
  - **Connect Wallet** — opens wallet connection modal, redirects to `/all-daos`
  - **View Only** — enters anonymous/read-only mode, redirects to `/all-daos`
- CRT scanline visual overlay effect
- Footer: "This DAO Portal is powered by Powers Protocol."
- Theme toggle (light/dark)

---

### 2. Explorer (All DAO Portals)
**Route:** Referenced externally (linked from navigation)

- Grid display of available DAO portals
- Each portal card shows: name, member count, number of DAOs
- "Visited" indicator for previously accessed portals
- Hide/unhide portals with confirmation dialog
- Filter toggle to show/hide hidden portals
- Click to enter a specific DAO portal

---

### 3. All DAOs View
**Route:** `/all-daos`

- Lists all DAOs (primary DAO + sub-DAOs) in the ecosystem
- Each DAO card displays:
  - DAO name and description
  - Member count
  - List of active mandates with activity indicators
- Click a DAO card to navigate to its dashboard (`/view/:slug`)
- Click an active mandate to open the **Mandate Sheet** (bottom drawer)
- Archive/hide DAOs with confirmation dialog
- Navigation dropdown for switching between pages

#### Mandate Sheet (Bottom Drawer)
- Opens from the bottom of the screen
- Shows mandate details: name, description, status, live quota
- Includes **voting interface** (YES / NO / ABSTAIN) for connected users
- Vote confirmation dialog (blockchain-integrated disclaimer)
- Vote results visualisation with progress bars
- Vote overview showing individual voter addresses and their votes
- Chatroom for the mandate (connected users only)
- Chat features: upvote/downvote messages, reply threads, hashtag filtering

---

### 4. DAO View (Main Dashboard)
**Route:** `/view/:slug`

The primary interface for interacting with a specific DAO. Split into multiple sections:

#### Header
- DAO name (links to DAO info page)
- Theme toggle
- Wallet connection status and controls
- Navigation dropdown

#### Left Panel — Mandates List
- List of all 40 mandates with:
  - Mandate ID and role number
  - Last active timestamp (days ago)
  - Click to navigate to mandate detail page
- Role-based filtering (filter by role 1–5)

#### Centre Panel — Latest Actions
- 25 actions displayed (14 active, 11 inactive)
- Each action shows:
  - Mandate ID and custom name
  - Time remaining (for active actions)
  - Quorum percentage
  - Role number
  - Active/inactive status indicator
- Click to open **Action Sheet** (bottom drawer) or navigate to action page

#### Right Panel — DAO Chatroom
- Real-time-style chat interface (mock data)
- Features:
  - Message upvoting/downvoting
  - Threaded replies
  - Hashtag system with clickable hashtags
  - Role badges on messages
  - Chat filtering (by hashtag, role, or search text)
  - Anchor hash system for bookmarking messages
- Locked behind wallet connection (shows placeholder for anonymous users)

#### Action Sheet (Bottom Drawer)
- Detailed action view with:
  - Action header (mandate ID, custom name)
  - "View Flow Sequence" button
  - More details section (description, quorum, chatroom ID, time left)
  - Voting interface (YES/NO/ABSTAIN) with confirmation dialog
  - Vote results with progress bars
  - Vote overview (individual voter addresses)
  - Action chatroom with full chat features

#### Flow Sheet (Bottom Drawer)
- Flow detail view with:
  - Flow name and DAO context
  - More details section with chatroom ID and status
  - Flow chatroom (coming soon placeholder)
  - Flow sequence visualisation (mandate chain)

#### Role Sheet (Bottom Drawer)
- Displays role information when a role is selected

#### Treasury Gallery
- Visual gallery component for DAO treasury assets

---

### 5. Mandate Page
**Route:** `/view/:slug/mandate/:mandateId`

Full-page mandate detail view:

- **Header:** Mandate ID, name, role number
- **More Details Section:**
  - Description text
  - Chatroom ID (5-digit identifier)
- **Start a New Action:** Button for connected users to create an action
  - Multi-parameter form with dynamic parameter fields
  - Anchor hash input fields
  - Confirmation step
- **Mandate Chatroom:**
  - Full chat interface with upvote/downvote, replies, hashtag filtering
  - Chat filter controls (hashtag, role, text search)
  - Locked for anonymous users

---

### 6. Action Page
**Route:** `/view/:slug/action/:actionId`

Full-page action detail view:

- **Header:** Mandate ID reference, custom mandate name
- **"View Flow Sequence" Button** — navigates to flow page
- **More Details Section:**
  - Description and parameter details
  - Chatroom ID: 48291
  - Quorum percentage
  - Time remaining
- **Vote Section:**
  - Three voting options: YES (green), NO (red), ABSTAIN (grey)
  - Vote confirmation dialog with blockchain disclaimer
  - Post-vote results display with progress bars
  - Locked for anonymous users (shows results only)
- **Vote Overview:**
  - Scrollable list of individual voters with addresses (ENS or truncated hex)
  - Each voter's choice colour-coded
  - Clickable addresses navigate to user profiles
- **Action Chatroom:**
  - Full chat interface with filtering
  - Locked for anonymous users

---

### 7. Flow Sequence Page
**Route:** `/view/:slug/action/:actionId/flow`

Full-page flow visualisation:

- **Header:** Flow context with back navigation to action
- **Flow Visualisation Image:** Static image showing mandate relationships
- **More Details Section:**
  - Flow description
  - Chatroom ID: 61837
- **Flow Chatroom:**
  - Chat interface for flow-level discussion
  - Upvote/downvote on messages
  - Locked for anonymous users

---

### 8. DAO Info Page
**Route:** `/dao-info`

- Hidden information page about the specific DAO
- "GO BACK TO ALL DAOs" navigation button
- Accessible via DAO name link in headers

---

### 9. User Profile
**Route:** `/profile`

Connected user's personal profile page:

- **Profile Header:**
  - Avatar with camera icon for upload
  - Display name (ENS or truncated address)
  - Wallet address (copyable)
  - Bio section (editable)
  - External links (editable)
  - Member since date
- **DAO Roles:** List of roles held across DAOs and sub-DAOs
- **Active Mandates:** Mandates the user is participating in
  - Click to open Mandate Sheet
- **Top Messages:** Highest-voted messages by the user
- **Voting History:** Record of votes cast with timestamps
- **Delegations:** Delegation relationships
- **Statistics:** Activity metrics (messages, votes, proposals, reputation score)
- **Achievement Badges:** Earned badges displayed as icons
- **Coin Animation:** Decorative animation triggered on profile load

---

### 10. Public User Profile
**Route:** `/user/:username`

- Read-only version of user profile
- Shows: avatar, name, address, bio, DAO roles, top messages, voting history, statistics, badges
- No edit capabilities

---

## Shared Components & Systems

### Navigation
- **NavigationDropdown:** Consistent dropdown menu across pages for quick navigation between All DAOs, Explorer, Profile, etc.
- **Back buttons:** Contextual navigation (e.g., "Back to DAO" on action pages)

### Chat System
All chatrooms share a common architecture:
- **ChatMessage component:** Renders individual messages with sender info, role badges, timestamps, vote controls, and reply threads
- **ChatFilter component:** Filter bar supporting hashtag, role, and text-based filtering
- **ChatroomPlaceholder:** Displayed when user is not connected (lock icon + message)
- **Chat data:** Generated from `getMandateChatMessages()` with seeded mock data per chatroom context

### Voting System
- Three-option voting: YES / NO / ABSTAIN
- Confirmation dialog before casting vote
- Simulated vote tallying with progress bar visualisation
- Vote overview showing individual voter addresses
- Blockchain integration disclaimer text

### Wallet Modal
- Modal dialog for wallet connection
- Options: MetaMask (simulated), WalletConnect (simulated), custom address input
- Redirects to specified page after connection

### Theme System
- Light/dark mode toggle available on all pages
- Uses CSS custom properties for semantic colour tokens
- Persistent theme preference via next-themes

### Document Viewer
- Component for viewing documents within the interface

---

## Design System

### Visual Identity
- **Aesthetic:** Terminal / retro-computing / monospace
- **Font:** Monospace throughout (`font-mono`)
- **Effects:** CRT scanline overlay, text glow, flicker animations, blinking cursor
- **Layout:** Dense, information-rich panels with border-based separation

### Colour Palette (Dark Mode — Default)
| Token | Purpose |
|-------|---------|
| `--background` | Page background (near-black) |
| `--foreground` | Primary text (near-white) |
| `--primary` | Accent / interactive elements |
| `--muted` | Subdued backgrounds and text |
| `--border` | Panel and section dividers |
| `--destructive` | Error / danger states |
| Green (`text-green-500`) | Active status, YES votes |
| Red (`text-red-500`) | NO votes |
| Orange (`text-orange-500`) | Powers Protocol branding |

### Interactive Elements
- **terminal-btn:** Primary button style with border and hover effects
- **terminal-btn-sm:** Compact button variant
- **terminal-btn-sm-muted:** Subdued button variant
- Hover states with underline offsets and opacity transitions

---

## Data Architecture

### DAO Configuration (`daoConfig.ts`)
- 4 DAOs defined: DAO #0 (primary), DAO #1, #2, #3 (sub-DAOs)
- Each DAO has: id, name, slug, description, member count, mandates array
- Mandates grouped by flow IDs with active/inactive states
- 20 flows across all DAOs

### Actions (`DaoView.tsx`)
- 25 latest actions generated with seeded data
- 14 active (with countdown timers), 11 inactive
- Each action: mandate ID, custom name, time left, quorum %, role number

### Mandates List (`DaoView.tsx`)
- 40 mandates with role assignments (1–5) and last-active timestamps

### Chat Messages (`demoChatMessages.ts`, `mandateChatMessages.ts`)
- Pre-defined mock messages with sender info, roles, hashtags
- Seeded generation per chatroom context
- Support for threaded replies and vote counts

### Explorer Data (`explorerData.ts`)
- External DAO portal listings for the Explorer page

### Sub-DAO Data (`subDaoData.ts`)
- Additional sub-DAO configuration

---

*This document describes the current state of the DAO Portal proof-of-concept. All wallet connections, voting, and chat interactions are simulated with mock data. No blockchain integration or backend services are currently connected.*
