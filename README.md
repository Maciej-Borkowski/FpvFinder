# FpvFinder

Analyzes telemetry logs from an EdgeTX radio (and other OpenTX-derived radios) and visualizes the GPS tracks on a map. It shows where the drone flew and where its last known point is — which helps you find it after a crash. It also includes a simple ballistic simulation of a disarmed drone falling.

The repo contains **two versions** that do exactly the same thing:

| Version | Location | Requires | Hosting | Do files leave your machine? |
|---------|----------|----------|---------|------------------------------|
| **A — web (plain JS)** | repo root | just a browser | **GitHub Pages**, free | **NO** — everything is computed locally |
| **B — Flask (Python)** | `flask/` | Python 3 + `pip install flask` | local only | n/a (runs on localhost) |

If you just want to open a page and drop in a folder of logs → version A. If you prefer something that can reach your whole disk by path (no picking files in the browser) → version B.

---

## Version A — web (GitHub Pages)

### Running locally (quick test)

Open `index.html` in a browser. **Not** through `file:///` — browsers block some features that way. Instead, start a simple server in the repo directory and go to `http://localhost:8000`:

```bash
# Python's built-in server is enough
python -m http.server 8000
```

Or any other static server (e.g. `npx serve`, Live Server in VS Code, etc.).

### Hosting it as a GitHub page — step by step

#### Option 1 — a "user" page (`https://NAME.github.io`)

This gives you an address like `fpvfinder.github.io`. One **caveat**: that address belongs to a GitHub account named `fpvfinder` — you cannot create such a subdomain under a different account. So you have to either:
- own/create a GitHub account named `fpvfinder` (if it's available), or
- use your own account — then the address will be `YOUR-LOGIN.github.io` (see option 2 if you don't want the project taking over your whole account).

Steps:

1. Create an account on github.com (if you don't have one). The login becomes the address.
2. Create a **public** repository named **exactly** `LOGIN.github.io` (e.g. `fpvfinder.github.io`). Important — no typos; only in this exact form does GitHub treat it as a user page.
3. In the project directory on your computer (i.e. here), run:

   ```bash
   git init
   git add index.html parser.js ballistics.js i18n.js app.js style.css README.md
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/LOGIN/LOGIN.github.io.git
   git push -u origin main
   ```

4. Go to `https://LOGIN.github.io` — the page should be live within 1–3 minutes.
5. (optional) In the repo: **Settings → Pages** — confirm the source is `main` and `/ (root)`.

#### Option 2 — a "project" page (`https://LOGIN.github.io/fpvfinder`)

Simpler, works under any login, doesn't take over the whole account.

1. Create a public repo with **any** name, e.g. `fpvfinder`.
2. Push the files (same as option 1, just change `origin` to `https://github.com/LOGIN/fpvfinder.git`).
3. In the repo: **Settings → Pages**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`, folder `/ (root)`
   - click **Save**.
4. After a few minutes the page shows up at `https://LOGIN.github.io/fpvfinder/`.

#### What to push to GitHub (and what not to)

These files in the root are all you need:

```
index.html
parser.js
ballistics.js
i18n.js
app.js
style.css
README.md
```

**The `flask/` folder is not needed for GitHub Pages** — you can push it anyway (it does no harm, GitHub Pages ignores it), or add it to `.gitignore`.

#### Custom domain (optional)

If you own a domain (e.g. `fpvfinder.dev`) and want to serve this page from it: add a `CNAME` file to the repo containing the domain, add a `CNAME` record at your registrar pointing to `LOGIN.github.io`, and enable **Enforce HTTPS** under Settings → Pages.

---

## Version B — Flask (local)

```bash
cd flask
python -m venv .venv
.venv\Scripts\activate            # Windows
# source .venv/bin/activate       # Linux/macOS
pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5000`. Type or pick a path to a folder of logs and click **Analyze**. Results stream in live (Server-Sent Events).

Environment variables:
- `FPVFINDER_HOST` (default `127.0.0.1`)
- `FPVFINDER_PORT` (default `5000`)
- `FPVFINDER_DEBUG=1` to enable Flask's debug mode

---

## Log format

The app accepts **`.csv`** files from an EdgeTX/OpenTX radio. The parser is tolerant:

- **Column position** is arbitrary — columns are found by header name, not by index.
- **The GPS column name** can be anything containing `gps`/`pos`/`coord`. Value: `"lat lon"` separated by a space (classic EdgeTX), a comma, or a semicolon.
- **Alternative**: two separate columns, one containing `lat`, the other `lon`/`lng`.
- **File encoding**: UTF-8 → CP1250 → Latin-1 are tried in order (version A uses `TextDecoder`; version B does it in `parser.py`).
- **Region filter** — none. Every valid point is shown (lat ∈ [-90, 90], lon ∈ [-180, 180], and not (0, 0) — which means no GPS fix).

Files with an unparsable GPS column, empty files, and files without a fix are simply skipped without crashing.

---

## Crash simulation

For a **disarmed** drone (motors OFF). Second tab. You enter the last lat/lon/alt/heading/speed known from telemetry (or click "Use as crash simulation start" in the popup of a track's last point), and optionally adjust the drone parameters (mass / Cd / frontal area). The simulation integrates the motion with air drag and shows the predicted crash site plus a ~40 m circle around it.
