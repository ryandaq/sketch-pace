# Sketch Pace

A local, dependency-free app for repeatable design sketching control drills: endpoint lines, through-dot lines, ellipses, arcs, and perspective boxes. Open `index.html` in Chrome, Edge, or Safari. It accepts mouse, touch, and stylus pointer input.

## Exploration Lab

The **Exploration Lab** tab is a separate experimental drawing gym. It adds **34 modes** across control, observation, form, value, and ideation. Try contour and spiral tracing; ghosted lines; symmetry, memory, blind contour, grid and proportion copy; gesture; perspective and form construction; hatching, value and line weight; quick thumbnails; or an uploaded reference image. The original Practice & Test tab and its data remain independent.

Search and filter modes, favorite them, or use **Today's challenge**, **Surprise me**, a five-mode sampler, or a themed playlist, including a favorite circuit and a three-attempt weak-spot set. You can **pin a generated target** and repeat its exact geometry later to compare attempts, or add your own product briefs to the **prompt deck** for thumbnail, storyboard and constraint exercises. Difficulty can be set manually or to **Auto**, which uses the mode's last five geometry scores. Timing, input mode, guide opacity, grid, mirrored ink, and a ghosting interval can be changed. The Lab includes ink color and width, eraser, undo/redo, a target demo, replay of your marks, reveal, a post-score distance heatmap, PNG export, local XP/streak/badges, per-mode progress sparklines, a simple review-due suggestion, attempt reflections, and JSON export/import for moving Lab data between devices.

Lab geometry scores are prototypes based on how closely your strokes cover generated paths. Creative and reference modes use a 1–5 self-review instead. See [the Lab review guide](sources/exploration-lab.md) for all modes and limits, and [the app landscape](sources/drawing-app-landscape.md) for the research behind them. The Reference Studio accepts a local image or an optional live camera overlay, with overlay, side-by-side, corner-reference, and hidden-memory views. Camera use requires browser permission and usually HTTPS on iPad; it stops when you leave the Lab. Neither source is recorded or uploaded, and an image stays only in the current browser session. Save your drawing as PNG if needed.

## Sessions

- **Practice** runs indefinitely. Each target is randomly chosen from the enabled drill types. Lines, ellipses, and arcs advance as soon as a stroke ends; boxes advance when you select **Score box**. The score and feedback for the previous target stay above the canvas. **Stop Practice** ends the session. Only average accuracy and average target time for each type are shown; an internal count and totals support those averages.
- **Test** contains 6, 12, or 18 targets. Enabled drill types are distributed as evenly as possible and shuffled. The selection is fixed for that test; guide visibility can still be changed. An overall accuracy score and total target time appear at the end. Test results are saved in the Test history for progress tracking. Skipping targets is disabled during a test.
- The scoring scale is the same in both modes. Time is tracked separately from accuracy. A target's timer begins when it appears and ends when its completed drawing is scored.

The **Drills & Guides** card holds each type's on/off switch and guide switch together. Endpoint and through-dot lines share the line-length controls; ellipse size and arc variant have their own controls. Each size or arc variant has a frequency weight from **0 to 5**. Zero means it is off. The values are relative weights, not percentages: `2, 4, 2` makes medium targets twice as likely as either other size. At least one option in each mix and one drill type remain enabled. Guide switches change only what is drawn on screen; target dots and the scoring target remain in place. Tangent stubs remain visible when the optional dotted arc is hidden because they define the tangency target.

## What is scored

| Drill | Your action | Accuracy components |
| --- | --- | --- |
| Lines | Connect two unlabeled dots in either direction with one stroke. | 50% endpoint control, 50% straightness. The closest endpoint assignment is used, so drawing direction does not change the score. |
| Through-dot lines | Make one straight stroke through two open checkpoint dots; start and finish wherever you like. | 70% proximity to the weaker of the two dot crossings, 30% straightness. Missing either dot is costly; stroke endpoints are never compared with the dots. |
| Ellipses | Draw one smooth loop through four open axis dots. | 50% axis-dot proximity, 50% curve quality including target-relative shape, coverage, closure, excess travel, and wobble. |
| Three-point arcs | Draw one arc between two endpoint dots and through a middle dot, in either direction. | 50% endpoint and middle-dot placement, 50% curve control. The curve score compares the mark with the intended circular arc and penalizes excess length and wobble. |
| Tangent arcs | Draw one arc between the endpoint dots, matching the short tangent guides at each end, in either direction. | 50% endpoint placement and tangency, 50% curve control. The same target-relative curve check penalizes the wrong branch or a straight chord. |
| Boxes | Draw nine edges in any order, one stroke per edge, then select **Score box**. | A whole-box match assigns strokes to target edges in whichever order gives the best score. Missing and extra edges lower accuracy. Each matched edge checks placement and straightness. |

Boxes vary in location, vanishing points, depth, and height. The generator intentionally produces tall, wide, and balanced silhouettes; a tall box has greater vertical than horizontal span on the canvas. **Undo last** removes a box edge before submission. **New target** rerolls an unfinished Practice target without saving a score. Through-dot lines use a guide that extends beyond both dots when enabled, but the guide's endpoints are not scored.

These percentages are heuristic feedback for practice, not a validated assessment of design sketching skill. Scores can vary with screen size, input sampling, and device, so compare tests under similar conditions.

## Data and iPad use

Practice averages, test results, and settings are stored locally in this browser under a version 5 key. Older Sketch Pace storage is left intact but is not mixed with the new scoring scale. **Export data** creates a JSON backup; **Import backup** accepts version 5 backups. Export before switching devices. There is no automatic sync.

The iPad layout puts the canvas before the longer progress and Lab library panels. **Drills & guides** and **Choose exercise** open those panels when needed. Controls are sized for touch, and the canvas supports pointer events. Select **Pencil only** to ignore finger touches when using Apple Pencil. The core app has been tried on an iPad; the new arc targets still need an on-device check.

### Install and update on iPad

1. Host the root of this folder at a stable HTTPS address. For GitHub Pages, put the files in a repository, then choose **Settings → Pages → Deploy from a branch → main → /(root)**. Keep `.nojekyll` in the root. Do not upload personal progress JSON backups to the public repository.
2. Open the published URL in iPad Safari. Use **Share → Add to Home Screen**, turn on **Open as Web App**, and tap **Add**. Use that icon for practice. Safari tabs and the Home Screen web app can have separate local data.
3. If moving existing progress, export **both** the Practice/Test backup and the Lab backup from the computer and import each in the iPad Home Screen app.
4. Update the same repository and URL to publish new app code. The service worker fetches current files while online and keeps an offline copy for times without a connection. Reopen the app online to receive updates; if it is already open, close and reopen it.

Progress is kept in browser storage, separate from the app files. Do not rename `sketch-pace-v5` or `sketch-pace-lab-v1` without a data migration. Clearing website data, uninstalling the Home Screen app, or changing hostnames can remove or strand local progress, so export both JSON backups periodically. GitHub Pages hosts the app but does not sync progress across devices.

## Research and checks

The [sources folder](sources/README.md) contains the GitHub method review, geometry rationale, current drawing-app research, benchmark notes, and automated checks. Run `node sources/test-scoring.js`, `node sources/test-lab.js`, and `node sources/test-lab-ui.js` from this folder to verify the core drills and Lab. No third-party code or runtime package is required.
