# Deploy Node Version

This app must run as a Node service because uploaded courses, materials, sales images, point shop gift photos, users, and draw records are saved through `/api`.

## Local Production Test

```bash
npm install
npm start
```

Open:

```text
http://127.0.0.1:4173/
```

## Render Deployment

1. Create a new Web Service on Render.
2. Connect a GitHub repository containing this folder.
3. Use:
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Add a persistent disk:
   - Mount path: `/var/data`
   - Size: at least 1 GB
5. Add environment variable:
   - `DATA_DIR=/var/data`
6. Deploy.

Uploaded data will be saved at:

```text
/var/data/platform-data.json
```

## Important

Do not deploy this as a static site only. Static hosting cannot persist uploads for all users.

For long-term production, replace the JSON data file with a real database and object storage.
