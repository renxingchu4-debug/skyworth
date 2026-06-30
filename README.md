# Learning and Lucky Draw Platform Prototype

Use the local server URL only:

```bash
/Users/crx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node server.js
```

Then open:

```text
http://127.0.0.1:4173/
```

Do not switch between `file://.../index.html` and `http://127.0.0.1:4173/` for daily use. Browsers isolate IndexedDB and uploads by page origin, so `file://` data and `http://127.0.0.1` data are separate.

When this project is served by `server.js`, uploaded courses, videos, materials, sales images, point shop gift photos, users, records, and draw data are saved to:

```text
data/platform-data.json
```

On first load, the app tries to migrate any existing browser IndexedDB data into that server data file if the server file is empty.

For a public website that everyone can access and share the same saved uploads, deploy the Node server, not only the static HTML/CSS/JS files. A static host alone cannot persist uploads for all users. For production, replace this JSON file store with a real database and object/file storage.

## Implemented Features

- Learning module: upload a course title, video, material, question, and answer options.
- Learner quiz: learners enter their name, choose an answer, and submit.
- Sales record form: collect store, TV model, user name, and optional receipt upload.
- Lucky draw: submit the sales record, then spin the prize wheel.
- Draw dashboard: show the top 5 users by draw entries and gift winners from the last 7 days.
- Admin data: review courses, quiz attempts, sales records, and draw results.
- CSV export: export records from the admin page.
- Full backup/restore: migrate uploaded files and browser data between page origins.
- Server persistence: when using `server.js`, all app data is saved in `data/platform-data.json`.
- Local fallback: if the server API is unavailable, data is stored in this browser with IndexedDB when available, and falls back to browser storage for direct file opening.

## Suggested Next Steps for Production

- Add account login and separate admin/user permissions.
- Replace browser storage with a server database such as MySQL, PostgreSQL, or MongoDB.
- Store uploaded files in object storage such as S3, OSS, or COS.
- Add configurable questions, prize inventory, draw limits, and data access rules.
