# Student Profile Picture Customization & Dark/Light Mode Integration

This plan introduces full student profile picture customization (allowing students and admins to upload photos, choose from preset avatars, or provide URLs) along with a complete, persistent Dark Mode and Light (White) Mode theme engine across the entire ClassroomOS application.

## User Review & Critical Decisions

> [!IMPORTANT]
> The clarifying questions were previously skipped. The following recommended defaults will be applied to deliver a fast, frictionless experience:
> - **Profile Picture Customization Method**: Students will have a dedicated Profile Photo dialog offering both **instant photo upload** (with automatic client-side compression to prevent storage bloat) and a **curated gallery of student avatars**, as well as custom image URL support.
> - **Dark / Light Mode Toggle Placement**: An accessible, high-visibility Sun/Moon theme switcher will be placed in the primary **Navbar**, synchronized with mobile drawer controls and available on the Login screen, persisting the user's preference in `localStorage`.

- **Confirmed Decision 1**: Student accounts will have full self-service photo upload and avatar picking, immediately propagating across class streams, submissions, comments, and people rosters.
- **Confirmed Decision 2**: Dark mode will support full system contrast with deep slate foundations (`#090d16` / `#0f172a`), WCAG AA compliant text hierarchy, and seamless 1-tap toggling without layout shift.

---

## 1. Overview & Core Concept

- **What It Does**: 
  1. Gives every student and teacher the power to personalize their identity with a profile picture via local file upload, pre-designed avatars, or image URLs.
  2. Introduces an adaptive Dark/White theme engine with smooth visual transitions, respecting user preference and persisting across browser sessions.
- **Target Audience / Persona**: Students accessing their classes on mobile phones and computers who want personalized profiles, as well as nighttime/low-light learners who require a dark theme to reduce eye fatigue.
- **Key Value**: Enhanced student personalization, visual ownership of their classroom presence, and comfortable viewing in both bright classrooms and low-light home environments.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Changing Profile Picture (Student or Teacher)**:
   - User clicks their avatar in the Navbar or taps the Profile item in the mobile navigation drawer.
   - Selects **"Change Profile Picture" (ပရိုဖိုင်ဓာတ်ပုံ ပြောင်းရန်)**.
   - Modal displays the current picture preview alongside three intuitive choices:
     - **Upload Image**: Drag-and-drop or file browser (PNG, JPG, WebP) with instant cropping/preview and client-side canvas optimization ($< 250\text{KB}$ data URI).
     - **Preset Avatars**: 12 diverse, high-quality illustrated student/teacher avatars for 1-click selection.
     - **Image URL**: Direct image link input with live preview verification.
   - Upon clicking **Save Photo**, profile picture updates instantly in user state, Navbar, People roster, and comment feeds.

2. **Toggling Dark / Light Mode**:
   - User clicks the theme toggle button in the top navigation bar (or mobile menu / login screen).
   - Theme immediately transitions between crisp Light mode (`bg-slate-50`) and deep Dark mode (`bg-slate-950`).
   - The selection is stored in `localStorage` under `classroomos_theme` so it remains active on future visits.

### Visual Identity & Theme Tokens

- **Aesthetic Direction**: Clean, contemporary EdTech workspace with utilitarian clarity, zero-pill metadata discipline, and high-legibility typographic hierarchy.
- **Color Tokens**:
  - **Light Mode**:
    - Canvas Background: `bg-slate-50` (`#f8fafc`)
    - Surface Containers: `bg-white` (`#ffffff`)
    - Borders & Dividers: `border-slate-200` (`#e2e8f0`)
    - Primary Text: `text-slate-900` (`#0f172a`)
    - Secondary/Muted: `text-slate-500` (`#64748b`)
  - **Dark Mode**:
    - Canvas Background: `dark:bg-slate-950` (`#020617` / `#090d16`)
    - Surface Containers: `dark:bg-slate-900` (`#0f172a`)
    - Surface Elevated (Modals/Dropdowns): `dark:bg-slate-900/95 dark:border-slate-800`
    - Borders & Dividers: `dark:border-slate-800` (`#1e293b`)
    - Primary Text: `dark:text-slate-100` (`#f1f5f9`)
    - Secondary/Muted: `dark:text-slate-400` (`#94a3b8`)
    - Focus & Interactive Accents: Indigo/Sky accents (`text-indigo-400`, `bg-indigo-600`)
- **Typography**: Clean display and body hierarchy with `Plus Jakarta Sans`, tabular figures (`tabular-nums`) for grades and counts, and balanced line wrapping.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Client-Side Avatar Image Processing**
  - *Chosen Approach*: Compress uploaded photos via HTML5 Canvas before persisting as Base64 in `localStorage`.
  - *Why*: Eliminates the need for external cloud image hosting while preventing `localStorage` quota overflow (capped at ~200KB per avatar with $256 \times 256$ dimensions).
  - *Alternatives Considered*: Storing raw full-resolution files (would rapidly hit browser 5MB storage limits) or external file upload API (requires external backend hosting).

- **Decision 2: Root Tailwind `dark` Class via Theme Context / Hook**
  - *Chosen Approach*: Maintain a dedicated theme helper with event listeners, attaching/removing the `dark` class on `document.documentElement` (`<html class="dark">`).
  - *Why*: Standard Tailwind CSS utility-first approach (`dark:bg-slate-900`, `dark:text-white`) with zero runtime overhead and instant flicker-free rendering.
  - *Alternatives Considered*: CSS-in-JS style objects or scoped theme wrappers (heavier bundle, CSS divergence).

- **Decision 3: Admin & Self-Service Picture Management**
  - *Chosen Approach*: Support avatar assignment both when Admin creates students (in `AddStudentModal` and `AdminStudentDirectoryModal`) and when students edit their own profile in `Navbar`.
  - *Why*: Gives instructors full control during onboarding while empowering students to personalize their own accounts.

---

## 4. Technical Architecture & Data Strategy

### Component & System Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ClassroomOS Application                         │
│                                                                        │
│   ┌───────────────────────────┐      ┌──────────────────────────────┐  │
│   │    Theme Engine           │      │    ClassroomDB Storage       │  │
│   │  - localStorage sync      │      │  - updateUserProfilePicture()│  │
│   │  - 'dark' / 'light' class │      │  - getAllUsers() / User[]    │  │
│   └─────────────┬─────────────┘      └──────────────┬───────────────┘  │
│                 │                                   │                  │
│                 ▼                                   ▼                  │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                       Top Navigation Bar                        │  │
│   │  - Sun/Moon Theme Toggle Button                                 │  │
│   │  - User Avatar with Dropdown:                                   │  │
│   │      • "Change Profile Picture" (Opens ProfilePictureModal)     │  │
│   │      • "Change Password" (Opens ChangePasswordModal)            │  │
│   │      • "Logout"                                                 │  │
│   └────────────────────────────────┬────────────────────────────────┘  │
│                                    │                                   │
│            ┌───────────────────────┴───────────────────────┐           │
│            ▼                                               ▼           │
│   ┌──────────────────────────────┐        ┌─────────────────────────┐  │
│   │    ProfilePictureModal       │        │   PeopleView & Stream   │  │
│   │  - Real-time photo preview   │        │ - Classmates list       │  │
│   │  - File Upload (canvas shrink│        │ - Stream posts & comments│ │
│   │  - 12 Preset avatar gallery  │        │ - All render updated    │  │
│   │  - Direct image URL input    │        │   avatars with dark     │  │
│   │  - Save & Cancel handlers    │        │   mode styling          │  │
│   └──────────────────────────────┘        └─────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Model Additions

- **User Model**: Avatar URL already exists in `User.avatar`. We will ensure standard support for:
  - Base64 data URIs (`data:image/jpeg;base64,...`)
  - Direct HTTPS URLs
  - Preset SVG / Vector avatars
- **Theme Preference**:
  - `localStorage.getItem('classroom_theme')`: `'dark' | 'light'`
  - Default: `'light'`, or respects system preference if set.

### Execution Steps (Post-Approval)

1. **Theme Engine & Styles**:
   - Configure global theme helper and update `index.css` / `App.tsx` root classes to support smooth light/dark switching.
   - Update `Navbar`, `LoginView`, `CourseCard`, `CourseDetail`, `CourseStream`, `ClassworkView`, and `PeopleView` with comprehensive `dark:*` Tailwind tokens.
2. **Profile Picture Management Modal**:
   - Create `ProfilePictureModal.tsx` with photo upload (canvas compressor), 12 preset avatars gallery, and URL input.
   - Connect `ClassroomDB.updateUserProfilePicture(userId, avatarUrl)`.
3. **Admin Creation Integration**:
   - Enhance `AddStudentModal.tsx` and `AdminStudentDirectoryModal.tsx` with avatar selection/presets so admins can assign pictures upon student creation.
4. **Verification & Testing**:
   - Verify dark mode legibility on desktop and mobile screens.
   - Test photo uploads, preset selections, and password/picture persistence across sessions.
