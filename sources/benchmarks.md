# Local scoring benchmarks

These are Node.js measurements on the development Windows computer on 2026-10-15. They exclude rendering, pointer delivery, and iPad Safari. Five post-warm-up trials produce a median microseconds-per-call figure. Machine load and JIT state change exact values.

## Current three-drill app (version 5)

Run `node sources/benchmark.js`. A representative uncontended run gave:

| Completed target | Median time |
| --- | ---: |
| Endpoint line | 87.3 µs |
| Through-dot line | 266.5 µs |
| Ellipse | 413.1 µs |
| Nine-edge box, order-independent assignment | 4,246.0 µs |

The through-dot scorer checks each checkpoint against the entire raw stroke and measures straightness separately. The box scorer compares each stroke with candidate target edges, then chooses a maximum-score edge assignment using a 512-state mask. Each stroke is resampled once for all candidate edges. Because the target edges are straight, placement uses direct point-to-segment distance instead of searching every point on a sampled polyline. This reduced an earlier version 5 box run from roughly 26 ms to about 4–5 ms on the same machine; these are single-run observations, not a controlled cross-device claim.

## Historical optimization (version 4)

Run `node sources/benchmark-v4.js` to compare `baseline-app.js` with the frozen `previous-app-v4.js`. This script and both snapshots are preserved because the earlier research included a product-form drill that was removed from the current app. The historical run showed the fixed-budget and squared-distance changes were faster, especially for the product contour. Those numbers do not describe the current version 5 app.

The functional suite `node sources/test-scoring.js` checks current geometry, reversed line direction, through-dot endpoint independence, box order and missing/extra-edge penalties, the frequency controls, Practice progression, and finite Test completion.
