# DJHebei's MatchZy — Admin Setup Guide

This guide is written for someone running the server, not writing code. Follow it top to
bottom the first time; after that, jump to whichever section you need.

By the end you'll have:
1. CS2 game servers running under **CSM** (CS2 Server Manager)
2. **DJHebei's MatchZy** (the tournament panel, "MAT" for short) running in Docker
3. Your servers added to the panel, with the live console working
4. Automated backups pushing your data to a private GitHub repo

---

## 0. What you need before you start

- A Linux PC or server that stays on (this is what will host both the game servers and the
  panel). Ubuntu is assumed below.
- That machine's **local network IP address** — run `hostname -I` in a terminal on it and
  take the *first* address shown (looks like `192.168.x.x`). Write it down; you'll need it
  several times below. Call this `<SERVER_IP>` for the rest of this guide.
- Comfortable copy-pasting commands into a terminal. Nothing here requires reading code.

> ⚠️ **If your network uses DHCP and this machine's IP address ever changes** (common on
> shared/café networks), things will break until you update the IP everywhere it's used.
> The panel has a **"Detect current IP"** button (see section 3) to make this less painful —
> but the more permanent fix is to ask whoever manages your router for a **DHCP reservation**
> (a fixed IP for this machine's network card) so it never changes at all.

---

## 1. Install CS2 Server Manager (CSM)

CSM is a separate open-source tool that runs and supervises your actual CS2 game server
processes (it is *not* part of this repo). Follow the official install instructions here:

**https://docs.sivert.io/docs/csm**

What to expect once it's installed (so you know it worked):

- CSM creates a dedicated system user for running game servers (on our setup this is called
  `cs2servermanager`) — this keeps the game server processes separate from your own login,
  which is safer.
- Each game server you configure gets a number (its **index**, e.g. server `1`, server `2`).
  CSM runs each one inside a background terminal session (`tmux`) named `cs2-<index>`
  (e.g. `cs2-1`). You'll need this number later when connecting the panel's live console.
- Useful day-to-day commands, run as your normal user:
  ```bash
  sudo csm status          # see which servers are running
  sudo csm start <N>       # start server N
  sudo csm stop <N>        # stop server N
  sudo csm restart <N>     # restart server N
  sudo csm attach <N>      # jump into server N's live console (Ctrl+B then D to leave)
  sudo csm list-sessions   # list all running server sessions
  ```

Once you have at least one CS2 server running under CSM and you know:
- its **game port** (e.g. `27015`)
- its **RCON password** (set when you configured the server in CSM)
- its **CSM index number** (e.g. `1`)

...move on to the next section.

---

## 2. Install DJHebei's MatchZy (the panel)

This is a Docker-based app: two commands and you have a running website.

### 2.1 Install Docker (if not already installed)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```
Log out and back in after this (or restart your terminal) so the group change applies.

### 2.2 Get the code

```bash
git clone https://github.com/Z1yuguo/djhebei-matchzy-auto-tournament.git
cd djhebei-matchzy-auto-tournament
```

### 2.3 Create your configuration file

```bash
cp example.env .env
nano .env
```

At minimum, fill in these lines (everything else can stay as-is for a first run):

| Setting | What to put |
|---|---|
| `SESSION_SECRET` | Any long random string. You can generate one with `openssl rand -base64 32` |
| `DB_PASSWORD` | Any password you choose — this is for the panel's own database, not your CS2 servers |
| `SERVER_TOKEN` | Any random string (e.g. `openssl rand -base64 24`). Your CS2 servers will use this to talk back to the panel securely |
| `API_BASE_URL` | `http://<SERVER_IP>:3069` |
| `FRONTEND_BASE_URL` | `http://<SERVER_IP>:3069` |
| `STEAM_API_KEY` | Get a free key at https://steamcommunity.com/dev/apikey — needed so people can log in with Steam |

Save and exit (in `nano`: `Ctrl+O`, Enter, then `Ctrl+X`).

### 2.4 Start it

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

The first run takes a few minutes (it's building the app). After that, open:

```
http://<SERVER_IP>:3069
```

...in a browser and log in with Steam. The first account to log in becomes an admin.

To check if it's running or see errors:
```bash
docker compose -f docker/docker-compose.yml logs -f
```
To stop it: `docker compose -f docker/docker-compose.yml down` (your data stays safe in
Docker's storage — this just stops the app).

---

## 3. Add your CS2 servers to the panel

1. Log into the panel, go to **Servers** in the sidebar → **Add Server**.
2. Fill in:
   - **Name**: anything you like (e.g. "Server 1")
   - **Host**: `<SERVER_IP>` (same address as before — if your CS2 servers run on the same
     machine as the panel, which is the normal setup)
   - **Port**: the CS2 server's game port (e.g. `27015`)
   - **RCON Password**: the RCON password you set for that server in CSM
3. Click **Test Connectivity** — it should say OK. If it says the address is unreachable and
   you're not sure the IP is right, click the small target icon next to **Host** — it fills
   in the address your own browser is using to reach the panel right now, which is usually
   the correct one to use.
4. (Optional but recommended) Turn on **SSH Console** so you can watch/interact with the live
   game console from your browser instead of SSHing in manually:
   - **csm Server Index**: the number from CSM (e.g. `1` for `cs2-1`)
   - **SSH Host**: `<SERVER_IP>`
   - **SSH Username**: `cs2servermanager` (the CSM system user from section 1 — **not** your
     own login) — you'll need a password or SSH key set up for this account first:
     ```bash
     sudo passwd cs2servermanager
     ```
     then pick "Password" as the auth method and enter that password.
   - Make sure SSH itself is turned on on this machine:
     ```bash
     sudo apt install -y openssh-server
     sudo systemctl enable --now ssh
     ```
5. Save. Repeat for each server.

Once servers are added with SSH Console on, open **Live Console** in the sidebar — you can
click between servers and see/interact with their real game console live in the browser.

---

## 4. Set up automated backups (optional but recommended)

This pushes copies of your teams, players, tournament info, and match results to a **private**
GitHub repository, so you always have an off-machine copy.

### 4.1 Create a private GitHub repo for backups

On github.com, click **New repository**, name it something like `your-name-matchzy-backups`,
and set visibility to **Private**. Nothing else needs configuring.

### 4.2 Create a token so the panel can write to it

1. GitHub → your avatar (top right) → **Settings** → **Developer settings** →
   **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Set **Repository access** to the backup repo you just created.
3. Under **Repository permissions**, set **Contents** to **Read and write**. Leave everything
   else as "No access".
4. Generate it and copy the token (starts with `github_pat_...`) — GitHub shows it only once.

### 4.3 Add it to your `.env`

```bash
nano .env
```
Add these two lines (already documented near the bottom of `example.env`):
```
GITHUB_BACKUP_TOKEN=github_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_BACKUP_REPO=your-github-username/your-backup-repo-name
```
Save, then restart the panel so it picks up the change:
```bash
docker compose -f docker/docker-compose.yml up -d
```

### 4.4 Use it

In the panel: **Admin Tools → GitHub Backup → Sync Now**. It pushes four files
(`teams.json`, `players.json`, `tournament.json`, `results.json`) to your repo. Click it
whenever you want a fresh snapshot — there's no automatic schedule, it's on-demand.

### 4.5 Backing up `.env` itself (so setup on a new PC is fast)

Your `.env` file has real passwords and tokens in it, so it should **never** be uploaded as
plain text, even to a private repo. Instead, encrypt it first:

```bash
gpg --symmetric --cipher-algo AES256 --output env.gpg .env
```
You'll be asked to set a passphrase — pick a strong one and save it somewhere safe (a
password manager, not the repo). Upload the resulting `env.gpg` file to your backup repo
(drag-and-drop on github.com works fine, or `git add`/`commit`/`push` if you're comfortable
with git).

To restore on a new PC, after cloning the code (section 2.2):
```bash
gpg --output .env --decrypt env.gpg
```
Enter the same passphrase, then continue from section 2.4.

---

## 5. Everyday admin tasks — quick reference

| I want to... | Where |
|---|---|
| Create a tournament bracket | Sidebar → **Tournament** |
| Run a one-off match outside the bracket | Sidebar → **Manual Match** |
| See final scores of finished games | Sidebar → **Results** |
| Watch a server's live console / send commands | Sidebar → **Live Console** |
| Add/edit a CS2 server | Sidebar → **Servers** |
| Back up data to GitHub | Sidebar → **Admin Tools** → GitHub Backup |
| Fix "server unreachable" after network changes | **Servers** → edit server → click the target icon next to Host |

---

## 6. Troubleshooting

**"Unable to connect to the server"** — almost always means the Host address on that server's
entry is stale (e.g. the machine's IP changed). Use the target-icon "detect current IP"
button on the Servers page.

**Panel loads but Steam login redirects somewhere wrong / fails** — check that
`FRONTEND_BASE_URL` in `.env` exactly matches the address you actually use to reach the panel
(including the port), then restart the panel.

**RCON test fails but the server is definitely running** — check the RCON password matches
exactly what's set on the CS2 server, and that both machines are actually on the same local
network (not separated by a VLAN/guest network) — `ping <that server's IP>` from the panel's
machine should get a reply.

**A server's Live Console says "no tmux session found"** — that server isn't currently running
under CSM's tmux session. Start/restart it via `sudo csm restart <N>` on the machine running
it, then try the console again.
