# Rahi Digital Portfolio — Netlify package

## Features
- Responsive public portfolio with six talent categories.
- Admin login protected by Netlify Function session cookie.
- Edit profile, tagline, introduction, about, contact details, education, skills and social links.
- Upload profile picture and portfolio images/videos up to 50 MB per file, subject to Netlify plan and service limits.
- Create, edit and delete portfolio items.
- Netlify Blobs stores profile data, items, upload chunks and media persistently. No Supabase or Firebase project is required.

## Deploy to a new GitHub repository and Netlify site
1. Extract this ZIP. Upload the *contents* of the extracted folder to the root of a new, empty GitHub repository. At repository root you should see `index.html`, `admin.html`, `package.json`, `netlify.toml`, and the `netlify/` folder.
2. In Netlify, import that repository. Keep **Base directory** blank. Leave **Build command** blank. Set **Publish directory** to `.` and **Functions directory** to `netlify/functions`.
3. In Netlify site configuration, add environment variables:
   - `ADMIN_PASSWORD`: a strong, unique admin password.
   - `SESSION_SECRET`: a different, randomly generated secret with at least 32 characters.
4. Trigger a new deploy after adding environment variables.
5. Test `https://YOUR-SITE.netlify.app/api` or `/api/`. The API should return JSON identifying the service. Test `/api/profile` and `/api/items` (public GET routes).
6. Open `https://YOUR-SITE.netlify.app/admin.html`, sign in with `ADMIN_PASSWORD`, edit the profile and save. Then add a test portfolio item and confirm it appears on the homepage. Delete the test item afterward if desired.

## How routing works
The function uses Netlify's standard `/.netlify/functions/api` endpoint. `netlify.toml` rewrites `/api` and `/api/*` to that endpoint. Do not add `export const config = { path: "/api/*" }` to the function as it conflicts with this standard-route rewrite approach.

## Security and costs
- Never commit `ADMIN_PASSWORD` or `SESSION_SECRET` to GitHub or share them in chat.
- Admin changes and uploads require a valid signed session. The cookie is HTTP-only, Secure, SameSite=Strict.
- Media URLs are public to anyone who knows the media key; do not upload private documents.
- Netlify Blobs, function execution, storage and bandwidth are subject to current Netlify plan limits and pricing. The 50 MB per-file limit in this UI does not guarantee every account can transfer or store files of that size.

## Troubleshooting
- If `/api` returns 404, confirm `netlify.toml`, `package.json`, and `netlify/functions/api.mjs` are at repository root / expected relative path and that the latest deploy includes the function.
- If login says `Set ADMIN_PASSWORD...`, add the variable in Netlify and redeploy.
- If profile saving returns an error, open Netlify Functions logs and inspect the `api` function invocation. Never share secret environment-variable values.
