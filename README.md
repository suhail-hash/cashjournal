# CashJournal

A cash book (*Kassenbuch*) app for small organisations. Create a journal for a period, record income and expenses with receipt photos, share it with other people, and export a cash report as PDF.

Built as a university project for the *Webanwendungen* course at Hochschule Osnabrück. The UI is in German.

## Features

- Sign up and log in with email and password or Google; password reset by email
- Multiple cash journals, each with a period, an opening balance and an open/closed status
- Entries with date, description and income or expense, with a running balance
- Receipt photos attached to entries (camera or gallery, via Capacitor)
- Invite other users to a journal and accept or decline invitations
- PDF export of the cash report (jsPDF)
- Runs in the browser and as an iOS app (Capacitor)

## Tech stack

- Angular 20 and Ionic 8
- Capacitor 7 (camera, filesystem, share, iOS)
- Firebase: Authentication and Firestore (via `@angular/fire`)
- Tailwind CSS and Flowbite
- jsPDF and jspdf-autotable

## Getting started

### Prerequisites

- Node.js 20 or newer
- Ionic CLI: `npm install -g @ionic/cli`
- A Firebase project with Authentication (Email/Password, Google) and Firestore enabled

### Setup

```bash
git clone <repo-url>
cd cashjournal
npm install
```

Copy `src/environments/environment.example.ts` to `environment.ts` and `environment.prod.ts` (set `production: true` in the latter). Both are gitignored. Fill in your own Firebase values from the Firebase console under *Project settings → Your apps*.

### Run

```bash
npm start          # dev server at http://localhost:4200
npm run build      # production build into www/
npm test           # unit tests (Karma/Jasmine)
npm run lint
```

### iOS

```bash
npm run build
npx cap add ios    # first time only
npx cap sync ios
npx cap open ios
```

## Project structure

```
src/app/
  pages/        login, profile, requests (invitations), cash-report
  home/ journal/ tabs/   main tab views
  services/     auth, journal, entries, invites, users, photo, pdf
  models/       Journal, Entry, Invite types
  utils/        currency and date helpers
```

## Security note

Firebase web API keys are not secrets, but access control must be enforced with **Firestore and Storage security rules**. Make sure only a journal's owner and invited users (`access`) can read or write it before deploying.
