# Mossgit

Watch a git repository grow as a tiny island garden.

Press play and the history replays commit by commit. Files sprout as plants, the people who committed hop around as little moss creatures, merged pull requests sail in as boats, and bug-fix commits bring a bug that has to be bonked.

## What you see

| On the island | In the repo |
|---|---|
| Trees, tinted by language | Source code |
| Pines | Tests |
| Shrubs | HTML and templates |
| Flowers | Stylesheets |
| Mushrooms | Docs and text |
| Stones | Config, data, lockfiles |
| Crystals | Images, fonts, media, models |
| Patches of land with footpaths | Top-level folders |
| Mosslings | The people who committed (bots get a little antenna) |
| Boats with leaf sails | Merged pull requests. The leaf colour shows the branch type: `feat` green, `fix` orange, `chore` gold, `ci` teal, `refactor` red |
| A bug and a storm | A commit whose message says fix, bug, revert, crash… |

Plants grow with their line count and wilt when the file is deleted.

**Sky and weather follow the history.** The sky matches the local hour of each commit, so late-night commits play out under the stars. Big commits bring rain, bursts of commits bring wind, early mornings bring mist, and winter commits bring snow. The Weather button overrides it.

**Sound.** A cozy generative music loop plays while the garden grows, and a slow, serious theme takes over during bug fights. All of it is synthesised in the browser with the Web Audio API, so there are no audio files.

## Things to do

- **Tap a plant** to fly to it and read its life story: lines over time and every commit that touched it.
- **Tap a mossling** to pet it and follow it. Everyone else's files fade, and its card shows when they usually commit.
- **Find a file** with the search box, or press `/`.
- **Hot spots** colours files from quiet to busy by how often they changed.
- **Tap the lantern** to let a bug loose for a practice fight.
- **Tap a boat** to say hi.

## Plant your own repo

Click **+ your repo** on the page, or do it by hand:

1. Inside your repo, run:

   ```bash
   git log --reverse --no-renames --raw --numstat --format="%x1e%H%x1f%at%x1f%an%x1f%ae%x1f%ai%x1f%s" --output=garden.txt
   ```

2. Drop `garden.txt` onto the page.

The page reads the log in your browser. Nothing is uploaded, and email addresses are only used to merge author aliases. They are never shown or stored.

## Add a garden to the built-in list

```bash
node scripts/extract.mjs ../path/to/repo data/my-repo.json
```

Then add `{ id: "my-repo", owner: "you/my-repo" }` to `REPOS` at the top of `main.js`.

## Run it locally

It's a static site with no build step:

```bash
npx serve .
```

Add `#capproof`, `#snapfind` and so on to the URL to open a specific garden.

## Built with

- [three.js](https://threejs.org): instanced meshes for the plants, a custom low-poly wave shader, and its post-processing add-ons for bloom, a two-pass tilt-shift blur and film grain
- [GSAP](https://gsap.com) for camera moves
- The Web Audio API for every sound and both music tracks
