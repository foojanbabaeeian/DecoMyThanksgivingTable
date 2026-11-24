# Deploying DecoThanks

There are two ways to publish. Both run from the same GitHub Actions workflow, and both only publish after the build and smoke test pass.

| | GitHub Pages (default) | Your own server + domain |
|---|---|---|
| Address | `https://<you>.github.io/DecoMyThanksgivingTable/` | e.g. `https://decothanks.fozhan.dev` |
| Needs | Supabase + 2 GitHub secrets | Supabase, a server, Cloudflare DNS, 7 GitHub secrets |
| Setup time | ~10 minutes | ~25 minutes |

## Quick start: GitHub Pages (no domain, no server)

1. Do **step 1 (Supabase)** below.
2. Fork repo → **Settings → Pages → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions → New repository secret**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Push to `main` (or **Actions → Test and deploy → Run workflow**). The `github-pages` job prints the live link.

That's it. Everything below is only for publishing on your own domain as well.

---

# Your own domain: decothanks.fozhan.dev

The site is static files (the `dist/` folder) served by nginx on the Hetzner server, with Cloudflare in front and Supabase for data. GitHub Actions builds and tests every push. A push to `main` deploys only if the tests pass.

```
push to main ─► GitHub Actions: npm ci → build → smoke test ─► tar over SSH as "deploy" ─► /var/www/<domain>/releases/<id>
                                                                                          └─ "current" symlink switched atomically
browser ─► Cloudflare (proxy, cache) ─► nginx on Hetzner ─► /var/www/<domain>/current
browser ─► Supabase (tables, cards, leaderboard)
```

Do these once, in order. Steps 1 and 2 can happen in parallel.

## 1. Supabase (5 minutes)

1. Create a free project at https://supabase.com/dashboard. Pick a region near most of your guests (e.g. East US).
2. **SQL Editor → New query**, paste all of [`supabase/schema.sql`](../supabase/schema.sql), press **Run**. It should finish with "Success. No rows returned". It's safe to run again after future changes.
3. **Project Settings → API**: copy the **Project URL** and the **anon / publishable** key.
4. Locally: copy `.env.example` to `.env.local`, paste both values, run `npm run dev`, create a table, share it, open the link in a private window and leave a card. If that works, the database is right.

## 2. Cloudflare DNS (2 minutes)

In the Cloudflare dashboard for `fozhan.dev` → **DNS → Add record**:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `thanksgiving` | `195.201.39.214` | **DNS only** (grey cloud) for now |

Leave it grey until the certificate exists (step 3). Then switch it to **Proxied** (orange cloud), and under **SSL/TLS → Overview** make sure the mode is **Full (strict)**.

## 3. Server, one time (5 minutes)

Make a key that's only for deploying this site (not your root key):

```bash
ssh-keygen -t ed25519 -f ~/harvest-deploy -C "github-actions harvest-table" -N ""
```

Copy the `deploy/` folder to the server and run the setup with the public key:

```bash
scp -P 443 -i ~/my-hub -r deploy root@195.201.39.214:/root/harvest-deploy
ssh -p 443 -i ~/my-hub root@195.201.39.214 \
  "bash /root/harvest-deploy/server-setup.sh decothanks.fozhan.dev \"$(cat ~/harvest-deploy.pub)\""
```

The script creates a `deploy` user that can only write to `/var/www/decothanks.fozhan.dev`, adds an nginx site (it doesn't touch your other sites), runs `nginx -t` before reloading, and asks certbot for a certificate. At the end it prints the server's host key line for the next step.

**One thing to check, because SSH and HTTPS share port 443 through sslh:** nginx may listen for HTTPS on a different internal port than 443. Compare the new site with an existing one:

```bash
grep -h "listen" /etc/nginx/sites-enabled/decothanks.fozhan.dev /etc/nginx/sites-enabled/<your travelhub site>
```

If travelhub uses something like `listen 127.0.0.1:4443 ssl;` and the new file says `listen 443 ssl;`, change the new file to match, then `nginx -t && systemctl reload nginx`.

Now switch the Cloudflare record to **Proxied**.

## 4. GitHub secrets (3 minutes)

Fork repo → **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `VITE_SUPABASE_URL` | Project URL from step 1 |
| `VITE_SUPABASE_ANON_KEY` | anon key from step 1 |
| `DEPLOY_HOST` | `195.201.39.214` |
| `DEPLOY_PORT` | `443` (sslh shares the port with HTTPS) |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | contents of `~/harvest-deploy` (the private key) |
| `DEPLOY_KNOWN_HOSTS` | the line the setup script printed, e.g. `[195.201.39.214]:443 ssh-ed25519 AAAA…` |

Also add the **variable** (not secret) `SITE_DOMAIN` = `decothanks.fozhan.dev`, so link previews point at your domain instead of the GitHub Pages address.

## 5. Deploy and check

Push to `main`, or run **Actions → Test and deploy → Run workflow**. The deploy job checks that `https://decothanks.fozhan.dev` answers with the new page and fails the run if it doesn't.

Then run through this checklist on a real phone before posting the link anywhere:

- [ ] Home page loads quickly on mobile data
- [ ] Create a table, add food, drag it around, press **Share table**, name it, copy the link
- [ ] Open the link in another browser or private window: the table looks the same and **Write a thank-you card** works
- [ ] The card shows on the host's table after reloading
- [ ] Turn on the leaderboard in the share sheet; the table shows under **Menu → Leaderboard**
- [ ] Pasting the link into iMessage/WhatsApp/LinkedIn shows the preview image (LinkedIn caches previews; use https://www.linkedin.com/post-inspector/ to refresh)

## Rolling back

Each deploy keeps the last five releases. To roll back on the server:

```bash
ls -1t /var/www/decothanks.fozhan.dev/releases
ln -sfn /var/www/decothanks.fozhan.dev/releases/<older-id> /var/www/decothanks.fozhan.dev/current
```

## Alternative: Cloudflare Pages

If you'd rather not use the server, Cloudflare Pages can host the same `dist/` folder: connect the repo, build command `npm run build`, output `dist`, add the two `VITE_SUPABASE_*` variables, and set the custom domain `decothanks.fozhan.dev`. The GitHub Actions test job still guards pull requests.

## Pipeline security

Already built into the repo:

- Every GitHub Action is pinned to a full commit SHA, and Dependabot (`.github/dependabot.yml`) opens weekly PRs to update actions and npm packages.
- `npm ci --ignore-scripts` installs exactly the lockfile without running package install scripts, then `npm audit` fails the build on high-severity issues in production dependencies.
- Build, smoke test and five real-browser tests (`tests/e2e.spec.js`) must pass before anything publishes. Browser tests run against a build without database keys, so they never touch real data.
- The workflow token is read-only; only the Pages job gets `pages: write`. Pull requests, including ones from forks, never receive secrets and never deploy.
- Secrets reach scripts only through environment variables. The server key is deleted from the runner after use, the server's host key is pinned, and deploys log in as a `deploy` user that can only write the site folder.
- CodeQL scans the JavaScript and the workflows on every PR and weekly.
- In the database, table edit keys are stored only as SHA-256 hashes, and anyone can only reach the data through Row Level Security and three functions.

Turn these on once in the fork's **Settings** (they're account settings, so they can't live in the repo):

1. **Rules → Rulesets → New branch ruleset** for `main`: require a pull request, require the status checks `test` and `analyze`, block force pushes and deletions.
2. **Environments → production** (and **github-pages**): under *Deployment branches*, allow only `main`. Optionally add yourself as a required reviewer for `production`.
3. **Code security**: turn on Dependabot alerts, Dependabot security updates, secret scanning and push protection.
4. **Actions → General**: set *Workflow permissions* to "Read repository contents", and require approval for workflows from first-time contributors.
