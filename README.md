# Dil Se Event Control

Simple mobile-friendly event control web app for rehearsals and live stage programs. It uses plain HTML, CSS, and JavaScript with Firebase Auth and Firestore for live sync between phone and laptop.

## File Structure

```text
Event Sound Organizer/
├── app.js
├── firebase-config.js
├── index.html
├── README.md
└── styles.css
```

## What It Includes

- Dashboard with totals for program items, missing songs, incomplete checklist items, and recent notes
- Program List with add, edit, delete, and up/down reorder
- Song Tracker with missing-song filter
- Checklist grouped by category with incomplete filter
- Notes / Live Issues with automatic timestamps
- Backup / Emergency quick toggles
- Sample starter data in every section
- Responsive layout with desktop side navigation and mobile bottom navigation

## Firebase Setup

1. Create a Firebase project at <https://console.firebase.google.com/>.
2. Add a Web App inside the project.
3. In Firebase, enable:
   - `Authentication` -> `Email/Password`
   - `Firestore Database`
4. Open [`firebase-config.js`](/Users/jc/Library/Mobile Documents/com~apple~CloudDocs/coding/Event Sound Organizer/firebase-config.js) and replace the placeholder values with your Firebase config.
5. In Firestore rules, start with something like this while you test:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Local Run

Because this app uses ES modules, run it from a small static server instead of opening the file directly.

### Option A: Python

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

### Option B: VS Code Live Server

Open the folder and run a simple static server extension.

## Deploy to Netlify

1. Upload this folder as a new site, or connect the repo.
2. Build command: leave blank
3. Publish directory: `.`
4. Make sure `firebase-config.js` contains your real Firebase config before deploy.

## Deploy to GitHub Pages

1. Put these files in a GitHub repository.
2. Commit and push.
3. In GitHub repository settings, enable `Pages`.
4. Deploy from the root of the default branch.
5. Confirm `firebase-config.js` has your real Firebase config.

## Notes

- Firestore seeds starter data automatically the first time a signed-in user opens the app.
- No audio playback is included; this is only for control, organization, and live notes.
- The same Firebase account can be used on phone and laptop for live sync.
