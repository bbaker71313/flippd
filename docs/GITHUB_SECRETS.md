# GitHub Repository Secrets

Secrets are set at: GitHub → Repository → Settings → Secrets and variables → Actions

## Required for Phase 4 Step 8 (EAS Mobile Build)

| Secret | Where to get it | When to add |
|---|---|---|
| `EXPO_TOKEN` | expo.dev → Account Settings → Access Tokens → Create token | Phase 4 Step 8 |

After adding `EXPO_TOKEN`, update `mobile.yml` to restore the push trigger:
Replace `on: workflow_dispatch:` with the original push trigger targeting
`apps/mobile/**` and `packages/shared/**` on main.

## Vercel Deployment

Vercel deploys via native Git integration — no GitHub secrets required.
The `web.yml` workflow has been deleted (it was redundant with Vercel native).
Do NOT recreate it.

## n8n Automation

n8n connects to Supabase directly via stored credentials in n8n dashboard.
No GitHub secrets needed.
