# Daily blog article (n8n + Gemini + Pexels)

`daily-blog-workflow.json` publishes one article a day to `content/blog/`. Vercel redeploys and the post goes live.

```
07:00 ─▶ Config ─▶ Pick today's topic ─▶ Already published? ─▶ Gemini writes ─▶ Quality check
      ─▶ Pexels photo ─▶ Markdown file ─▶ PR for review  (or)  commit straight to master
```

## Why it sells
- **Every article leads to a real hunt.** The topic plan is generated from `scripts/seed-data`, so each post is about a city and one of its hunts. It carries two buy buttons: the hunt (after section 2) and the city (at the end). Both link to pages with "your first hunt is free".
- **The topics are search queries with buying intent**: "things to do in Utrecht", "Delft day trip from Amsterdam", "Haarlem with kids", "Leiden self-guided walking tour", and a themed story per hunt. That makes 82 topics, rotating across cities, before anything repeats.
- **Gemini gets your house voice and rules.** It writes in first person plural, uses no clichés and invents no prices, dates or business names. It may only use facts from the hunt description.
- **The workflow rejects bad drafts.** It checks length, sections and banned words, and refuses any price other than €5. A rejected run fails visibly in n8n instead of publishing.

## Setup (about 10 minutes)
1. **API keys**
   - Gemini: https://aistudio.google.com/apikey
   - Pexels (free, commercial use allowed): https://www.pexels.com/api/
   - GitHub: a fine-grained token on `spacj/tourist-utr` with **Contents: read & write** and **Pull requests: read & write**.
2. **Create three credentials in n8n**, all of type *Header Auth*:
   | Credential name | Header name | Value |
   |---|---|---|
   | `GitHub token` | `Authorization` | `Bearer <github token>` |
   | `Gemini API key` | `x-goog-api-key` | `<gemini key>` |
   | `Pexels API key` | `Authorization` | `<pexels key>` |
3. **Import the workflow:** in n8n, Workflows → Import from file → `daily-blog-workflow.json`. Open each red HTTP node and select the matching credential.
4. **Check the settings in the `Config` node:**
   - `publishMode: 'pr'` (default) opens a pull request each morning. You read it, merge it, and it's live.
   - `publishMode: 'direct'` publishes without review.
   - Start with `pr` for a week or two, then switch once you trust the output.
5. **Test it:** click *Execute workflow* once, then turn the workflow **Active**.

## Changing topics
Topics come from your hunts. After adding hunts or cities, run:

```
node automation/n8n/build-workflow.mjs
```

Then re-import the JSON. The angles per hunt are listed in `anglesFor()` in `build-workflow.mjs`; edit them there.

## Notes
- AI can still get facts wrong. With `pr` mode, skim each article before merging, especially anything about history.
- Pexels photos are free for commercial use. The workflow adds a photo credit at the end of each article.
- If today's slug already exists in the repo, the run stops without doing anything.
