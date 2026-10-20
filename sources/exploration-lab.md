# Exploration Lab: review guide

The Lab is a separate, experimental tab alongside the original Practice & Test area. It explores ideas drawn from the [33-product landscape](drawing-app-landscape.md). All exercises are original local implementations. The established four core drills and their progress records remain separate.

## The 34 exercise modes

| Skill area | Modes | What changes |
| --- | --- | --- |
| Control | Contour tracing, ghosted straight lines, circles & ellipses, through-dot route, spiral control, rhythm & pattern, one-stroke silhouette, tangent arcs, radial wheel | Stroke shape, length, cadence, checkpoint order, continuity, and repetition. |
| Observation | Mirror symmetry, grid transfer, proportion transfer, look-hide-draw, blind contour, negative-space shape, gesture action | The reference is visible, hidden, briefly memorized, reflected, or put beside the drawing area. |
| Form | Ellipse in a plane, vanishing-point rays, object construction, rotated silhouette, perspective sketchpad, isometric cube, stacked cylinders, cast-shadow study | Planes, ellipses, perspective convergence, rotation, light direction, and stepwise form building. |
| Value | Parallel hatching, crosshatching, five-step value ladder, line-weight hierarchy, stipple value ladder | Spacing, stroke angle, overlapping stroke sets, line and dot density, and brush width. |
| Ideas | Three idea thumbnails, 20-second speed sketch, your reference studio, three-frame storyboard, constraint remix | Prompt-driven variation, speed, interaction stories, constraint-driven redesign, and study of a personal image. |

## Shared controls and flow

- Search and category filters; favorites; Surprise me; today's deterministic challenge; a five-mode sampler; seven playlists including a timed class ladder, favorite circuit and weak-spot triple.
- A per-mode pinned target can be replayed with the same generated geometry, making comparisons across attempts more meaningful than comparing unrelated random targets. Pinned target geometry is stored locally and included in the JSON export; uploaded reference images are not. Import validates and merges attempts, prompts, favorites and pins with existing Lab data for device transfer.
- A personal prompt deck holds up to 100 short design briefs. Selecting one starts a thumbnail challenge immediately; saved briefs can also feed the thumbnail, storyboard and constraint-remix generators. The deck is included in the JSON export.
- Three challenge levels plus an adaptive Auto setting based on the last five mode scores; optional timer, Pencil-only input, guide opacity, grid, mirror ink, and a three-second ghosting interval. The canvas uses high-density backing pixels and coalesced pointer samples when the browser supplies them.
- Ink color and width, eraser, undo/redo, clear, target demo playback, replay of the user's marks, reveal, a post-score distance heatmap, PNG export, and JSON history export.
- Local XP, streak, badges, recent attempts, per-mode average and score sparkline, a suggestion based on the lowest scored mode or an untried one, and a simple review schedule whose interval is one, two or four days based on the last result. Each completed attempt can carry a short reflection that is saved and exported with the result.
- The reference studio accepts a user-selected image or an optional live camera overlay with opacity, contrast, grayscale and flip controls. It can show an overlay for tracing, a side-by-side view for copying, a small corner reference or a hidden view for memory work. Camera access is requested only when selected, depends on browser permission and a secure context, and stops on leaving the Lab. Nothing is recorded or uploaded.
- Each construction exercise exposes its guide in three steps. Scoring is still done once on the whole drawing.

## Feedback model and limits

For geometric targets, the Lab samples each path at bounded intervals and compares drawing-to-target and target-to-drawing distances. Multiple strokes are assigned to target paths in whichever order matches best; missing or extra marks reduce the score. The through-dot route scores proximity to each numbered dot and the order crossed, without comparing stroke endpoints. Value ladder scoring checks hatch counts by swatch and whether density rises. Line-weight practice also checks chosen brush width.

These are **prototype geometry scores**. They have not been validated against expert judgments or measured learning gains. A score can reward a trace that lacks confident line quality, and the score depends on the generator, screen size and input sampling. Blind contour, perspective sketchpad, thumbnail ideation and personal reference studies therefore use an explicit 1–5 self-review. The Lab does not infer creativity, anatomy knowledge, or design quality from the marks. Compare scores within a mode under similar settings.

The offline page does not include copyrighted course lessons, licensed photo libraries, camera tracking for true AR, 3D reference models, AI recognition, or social sharing. Those are important patterns in the surveyed products but would require content rights, additional device APIs, data infrastructure or separate validation.

## Checks

Run from the project folder:

```text
node sources/test-scoring.js
node sources/test-lab.js
node sources/test-lab-ui.js
```

`test-lab.js` covers all generators, ideal-versus-offset scoring, and through-dot behavior. `test-lab-ui.js` simulates tab switching, pointer drawing, scoring and local history. These automated checks cannot replace visual and Apple Pencil testing on the actual iPad.
