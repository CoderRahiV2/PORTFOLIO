import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const store = getStore("rahi-portfolio");
const COOKIE = "rahi_admin";
const MAX = 50 * 1024 * 1024;
const CHUNK = 4 * 1024 * 1024;
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
const secret = () => process.env.ADMIN_PASSWORD || "";
const sessionSecret = () => process.env.SESSION_SECRET || secret();
const sign = payload => { const body = Buffer.from(JSON.stringify(payload)).toString("base64url"); return body + "." + crypto.createHmac("sha256", sessionSecret()).update(body).digest("base64url"); };
const cookie = (value, age = 28800) => `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`;
function authed(req) {
  const value = (req.headers.get("cookie") || "").split(";").map(x => x.trim()).find(x => x.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  if (!value) return false;
  const [body, signature] = value.split("."); if (!body || !signature) return false;
  const actual = Buffer.from(signature, "base64url");
  const expected = crypto.createHmac("sha256", sessionSecret()).update(body).digest();
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return false;
  try { return JSON.parse(Buffer.from(body, "base64url").toString()).exp > Date.now(); } catch { return false; }
}
const defaultProfile = {
  name: "Mohammed Rahman Bin Halim (Rahi)",
  tagline: "Learning, Creating, Leading, and Making a Difference.",
  intro: "Hello, I am Mohammed Rahman Bin Halim, widely known as Rahi. I'm a curious and quick learner passionate about Holy Quran recitation, programming, artificial intelligence, technology, leadership, entrepreneurship, and volunteering.",
  about: "I learn new things quickly and enjoy connecting ideas across subjects. I believe that combining knowledge from different fields can lead to stronger ideas, more useful solutions and better outcomes.",
  email: "rahmanrahi2006@gmail.com", phone: "", education: "",
  skills: "MS Word, Excel, Canva, AI tools, digital marketing, communication",
  linkedin: "", facebook: "", instagram: "", github: "", profilePhotoKey: "", profilePhotoType: ""
};
async function getProfile() { try { return { ...defaultProfile, ...JSON.parse(await store.get("profile.json", { type: "text" })) }; } catch { return { ...defaultProfile }; } }
async function getItems() { try { return JSON.parse(await store.get("items.json", { type: "text" })) || []; } catch { return []; } }
function routePath(url) {
  let path = url.pathname;
  path = path.replace(/^\/.netlify\/functions\/api\/?/, "");
  path = path.replace(/^\/api\/?/, "");
  return path.replace(/^\/+/, "");
}
export default async function handler(req) {
  try {
    const url = new URL(req.url); const p = routePath(url); const method = req.method.toUpperCase();
    if (p === "" && method === "GET") return json({ ok: true, service: "Rahi Portfolio API", routes: ["/api/session", "/api/profile", "/api/items"] });
    if (p === "login" && method === "POST") {
      if (!secret()) return json({ error: "Set ADMIN_PASSWORD in Netlify environment variables first." }, 500);
      const body = await req.json(); const a = Buffer.from(String(body.password || "")); const b = Buffer.from(secret());
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return json({ error: "Incorrect password." }, 401);
      return json({ ok: true }, 200, { "set-cookie": cookie(sign({ exp: Date.now() + 28800000 })) });
    }
    if (p === "logout") return json({ ok: true }, 200, { "set-cookie": cookie("", 0) });
    if (p === "session") return json({ authenticated: authed(req) });
    if (p === "profile" && method === "GET") return json(await getProfile());
    if (p === "items" && method === "GET") return json(await getItems());
    if (p === "media" && method === "GET") {
      const key = url.searchParams.get("key") || ""; if (!key.startsWith("media/")) return json({ error: "Invalid media key." }, 400);
      const data = await store.get(key, { type: "arrayBuffer" }); if (!data) return json({ error: "Not found." }, 404);
      const meta = await store.getMetadata(key);
      return new Response(data, { headers: { "content-type": meta?.metadata?.contentType || "application/octet-stream", "cache-control": "public, max-age=3600", "x-content-type-options": "nosniff" } });
    }
    if (!authed(req)) return json({ error: "Please sign in as admin." }, 401);
    if (p === "profile" && (method === "PUT" || method === "POST")) {
      const body = await req.json(); const old = await getProfile(); const next = {};
      for (const key of Object.keys(defaultProfile)) next[key] = String(body[key] ?? old[key] ?? "").slice(0, key.startsWith("profilePhoto") ? 500 : 5000);
      await store.set("profile.json", JSON.stringify(next)); return json(next);
    }
    if (p === "items" && method === "POST") {
      const body = await req.json(); if (!body.title || !body.category) return json({ error: "Title and category required." }, 400);
      const all = await getItems(); const item = { id: crypto.randomUUID(), title: String(body.title).slice(0,160), category: String(body.category).slice(0,80), description: String(body.description || "").slice(0,2000), url: String(body.url || "").slice(0,2000), mediaKey: String(body.mediaKey || ""), mediaType: String(body.mediaType || ""), createdAt: new Date().toISOString() };
      all.unshift(item); await store.set("items.json", JSON.stringify(all)); return json(item, 201);
    }
    if (p.startsWith("items/") && method === "PUT") {
      const id = p.slice(6).split("/")[0]; const body = await req.json(); const all = await getItems(); const index = all.findIndex(x => x.id === id);
      if (index < 0) return json({ error: "Item not found." }, 404);
      all[index] = { ...all[index], title: String(body.title ?? all[index].title).slice(0,160), category: String(body.category ?? all[index].category).slice(0,80), description: String(body.description ?? all[index].description).slice(0,2000), url: String(body.url ?? all[index].url).slice(0,2000), ...(body.mediaKey ? { mediaKey: String(body.mediaKey), mediaType: String(body.mediaType || "") } : {}) };
      await store.set("items.json", JSON.stringify(all)); return json(all[index]);
    }
    if (p.startsWith("items/") && method === "DELETE") {
      const id = p.slice(6).split("/")[0]; const all = await getItems(); const item = all.find(x => x.id === id); if (!item) return json({ error: "Item not found." }, 404);
      await store.set("items.json", JSON.stringify(all.filter(x => x.id !== id))); if (item.mediaKey) await store.delete(item.mediaKey); return json({ ok: true });
    }
    if (p === "upload/start" && method === "POST") {
      const body = await req.json(); if (!body.name || !Number.isFinite(body.size) || body.size < 1 || body.size > MAX || !/^(image|video)\//.test(body.type || "")) return json({ error: "Choose an image or video under 50 MB." }, 400);
      const id = crypto.randomUUID(); const meta = { name: String(body.name).replace(/[^\w.-]/g, "_").slice(0,100), size: body.size, type: body.type, chunks: Math.ceil(body.size / CHUNK) };
      await store.setJSON(`up:${id}:meta`, meta); return json({ uploadId: id, chunkSize: CHUNK });
    }
    if (p.startsWith("upload/chunk/") && method === "PUT") {
      const parts = p.split("/"); const id = parts[2], index = Number(parts[3]); const meta = await store.get(`up:${id}:meta`, { type: "json" }); const data = new Uint8Array(await req.arrayBuffer());
      if (!meta || !Number.isInteger(index) || index < 0 || index >= meta.chunks || data.length > CHUNK) return json({ error: "Invalid upload chunk." }, 400);
      await store.set(`up:${id}:chunk:${index}`, data); return json({ ok: true });
    }
    if (p.startsWith("upload/finish/") && method === "POST") {
      const id = p.split("/")[2]; const meta = await store.get(`up:${id}:meta`, { type: "json" }); if (!meta) return json({ error: "Upload expired." }, 404);
      const output = new Uint8Array(meta.size); let offset = 0;
      for (let i = 0; i < meta.chunks; i++) { const chunk = await store.get(`up:${id}:chunk:${i}`, { type: "arrayBuffer" }); if (!chunk) return json({ error: `Missing part ${i+1}.` }, 400); output.set(new Uint8Array(chunk), offset); offset += chunk.byteLength; }
      if (offset !== meta.size) return json({ error: "Size mismatch." }, 400);
      const key = `media/${crypto.randomUUID()}-${meta.name}`; await store.set(key, output, { metadata: { contentType: meta.type } });
      for (let i = 0; i < meta.chunks; i++) await store.delete(`up:${id}:chunk:${i}`); await store.delete(`up:${id}:meta`);
      return json({ mediaKey: key, mediaType: meta.type });
    }
    return json({ error: "Not found.", path: p, method }, 404);
  } catch (error) {
    console.error("Portfolio API error:", error);
    return json({ error: "Server error. Check Netlify function logs." }, 500);
  }
}
