<div align="center">
  <img src="client/public/icon.svg" alt="DJHebei's MatchZy" width="140" height="140">

  # DJHebei's MatchZy

  ⚡ **Automated CS2 tournament management — one click from bracket creation to final scores**

  <p>A fork of <a href="https://github.com/sivert-io/matchzy-auto-tournament">MatchZy Auto Tournament</a> with extra admin tooling: a live SSH server console, a manual-match builder, cast/broadcaster management, HLTV-style ratings, and GitHub-backed data backups.</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](docker/docker-compose.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## 🚀 New here? Start with the setup guide

**👉 [SETUP_GUIDE.md](SETUP_GUIDE.md)** — a complete, step-by-step walkthrough written for someone who has never touched code before. It covers, in order:

1. Installing CS2 Server Manager (CSM) and starting your game servers
2. Installing this panel via Docker
3. Adding your servers to the panel (RCON + live SSH console)
4. Setting up automated GitHub backups
5. Everyday tasks (creating matches, checking results) and troubleshooting

If you just want the panel up and running as fast as possible:

```bash
git clone https://github.com/Z1yuguo/djhebei-matchzy-auto-tournament.git
cd djhebei-matchzy-auto-tournament
cp example.env .env
# edit .env - see SETUP_GUIDE.md section 2.3 for what to fill in
docker compose -f docker/docker-compose.yml up -d --build

# Open http://<this-machine's-ip>:3069
```

---

## ✨ What's in this fork (beyond upstream)

- 🖥️ **Live Console** — SSH into any server's tmux session and watch/interact with the real game console from the browser
- 🎮 **Manual Match builder** — standalone matches outside the tournament bracket: pick rosters (existing players, whole teams, or raw SteamID), BO1/BO3/BO5, veto on/off with per-map side selection, pin a specific server, toggle demo recording, and preview the exact MatchZy config before committing
- 🎙️ **Cast/Broadcaster registry** — register caster SteamIDs once, attach them to any match as MatchZy spectators
- 📊 **Results page** — browse completed games, download a normalized stats JSON per match
- ⭐ **HLTV Rating** — a per-match performance score (independent of win/loss), alongside the existing win/loss-driven ELO/Skill Rating system, with a fully custom weight editor
- ☁️ **GitHub Backup sync** — push teams/players/tournament/results JSON to a separate private repo on demand
- 🌐 **Detect current IP** button on server config — handy on unstable/DHCP networks where the host's address changes

See [Releases](https://github.com/Z1yuguo/djhebei-matchzy-auto-tournament/releases) for version history.

---

## ✨ What you get from upstream

🏆 **Tournament Formats** — Single/Double Elimination, Swiss, Round Robin, Shuffle
🗺️ **Map Veto** — FaceIT-style ban/pick for BO1/BO3/BO5
📈 **Player Ratings** — OpenSkill-backed ELO system with leaderboards
⚡ **Real-Time** — WebSocket updates for scores, connections, status
🎮 **Auto-Everything** — Server allocation, match loading, bracket progression
🎬 **Demo Recording** — Automatic upload and download
👥 **Public Pages** — No-login team pages with server connect info

---

## 📖 Documentation

- **This fork's setup guide (start here):** [SETUP_GUIDE.md](SETUP_GUIDE.md)
- **Upstream platform docs** (architecture, admin dashboard, tournaments — mostly still accurate for the shared core): https://docs.sivert.io/docs/mat
- **CS2 Server Manager (CSM) docs:** https://docs.sivert.io/docs/csm

---

## 🔧 Requirements

- A Linux machine with Docker & Docker Compose
- CS2 servers with [MatchZy Enhanced v1.3.0+](https://github.com/sivert-io/matchzy-Enhanced/releases)
- RCON access to servers

---

## 🔄 Updating

```bash
git pull
docker compose -f docker/docker-compose.yml up -d --build
```

Your data lives in Docker's Postgres volume and survives this. See [SETUP_GUIDE.md](SETUP_GUIDE.md) for backing up `.env` and your data before major updates.

---

## 📜 License

MIT License - see [LICENSE](LICENSE)

**Credits:** Forked from [sivert-io/matchzy-auto-tournament](https://github.com/sivert-io/matchzy-auto-tournament) • [cs2-server-manager](https://github.com/sivert-io/cs2-server-manager) • [brackets-manager.js](https://github.com/Drarig29/brackets-manager.js) • [brackets-viewer.js](https://github.com/Drarig29/brackets-viewer.js)

---

<div align="center">
  <strong>Made with ❤️ for the CS2 community</strong>
</div>
