//! Comparison port of the k-means in packages/core/src/services/PaletteService.ts
//! (kMeansPlusPlusInit, assignToClusters, updateCentroids, countDistinctColors,
//! kMeansClustering). Audit evidence only.
//!
//! Parity rules kept from the TypeScript:
//! - k is capped at the number of exact distinct triples, counted in input order;
//! - k-means++ caches each sample's distance to its nearest centroid, weights by the
//!   square of that sqrt distance and walks the samples in input order;
//! - nearest centroid uses strict `<`, so the first centroid wins a tie;
//! - centroids are means rounded like JS `Math.round`; an empty cluster keeps its centroid;
//! - convergence is a strict `max movement < threshold`, then one final count-only pass.
//!
//! `Math.random` is replaced by the same 32-bit LCG the harness injects into TypeScript.
//! `kmeans_sq` compares squared distances in the assignment loop only (initialisation
//! and movement keep their square roots).

struct Lcg(u32);

impl Lcg {
    fn next(&mut self) -> f64 {
        self.0 = self.0.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        f64::from(self.0) / 4_294_967_296.0
    }
}

#[inline(always)]
fn sq(px: &[f64], i: usize, c: &[f64; 3]) -> f64 {
    let dr = px[i * 3] - c[0];
    let dg = px[i * 3 + 1] - c[1];
    let db = px[i * 3 + 2] - c[2];
    dr * dr + dg * dg + db * db
}

/// JS `Math.round`: nearest integer, ties toward +infinity. `(x + 0.5).floor()` is not
/// equivalent for values such as 0.49999999999999994.
#[inline(always)]
fn js_round(x: f64) -> f64 {
    let f = x.floor();
    if x - f >= 0.5 { f + 1.0 } else { f }
}

#[no_mangle]
pub extern "C" fn alloc_f64(len: usize) -> *mut f64 {
    let mut v: Vec<f64> = Vec::with_capacity(len);
    let p = v.as_mut_ptr();
    std::mem::forget(v);
    p
}

/// # Safety
/// `p` and `len` must come from one `alloc_f64` call.
#[no_mangle]
pub unsafe extern "C" fn free_f64(p: *mut f64, len: usize) {
    drop(Vec::from_raw_parts(p, 0, len));
}

/// `px`: n interleaved RGB f64 triples. `out`: k*3 centroid channels, then k sizes.
/// Returns the effective k (populated prefix of `out`).
///
/// # Safety
/// `px` must hold `n * 3` f64 values and `out` `k * 4`.
#[no_mangle]
pub unsafe extern "C" fn kmeans(px: *const f64, n: usize, k: usize, max_iter: u32, threshold: f64, seed: u32, out: *mut f64) -> u32 {
    run(px, n, k, max_iter, threshold, seed, out, false)
}

/// # Safety
/// Same contract as [`kmeans`].
#[no_mangle]
pub unsafe extern "C" fn kmeans_sq(px: *const f64, n: usize, k: usize, max_iter: u32, threshold: f64, seed: u32, out: *mut f64) -> u32 {
    run(px, n, k, max_iter, threshold, seed, out, true)
}

#[allow(clippy::too_many_arguments)]
unsafe fn run(ptr: *const f64, n: usize, k: usize, max_iter: u32, threshold: f64, seed: u32, out: *mut f64, squared: bool) -> u32 {
    if n == 0 || k == 0 {
        return 0;
    }
    let px = std::slice::from_raw_parts(ptr, n * 3);
    let out = std::slice::from_raw_parts_mut(out, k * 4);
    let mut rng = Lcg(seed);

    // countDistinctColors: exact triples, stop at k.
    let mut seen: Vec<[f64; 3]> = Vec::with_capacity(k);
    for i in 0..n {
        if seen.len() >= k {
            break;
        }
        let t = [px[i * 3], px[i * 3 + 1], px[i * 3 + 2]];
        if !seen.iter().any(|s| s[0] == t[0] && s[1] == t[1] && s[2] == t[2]) {
            seen.push(t);
        }
    }
    let ek = seen.len();

    // kMeansPlusPlusInit with cached nearest (sqrt) distances.
    let pick = |i: usize| [px[i * 3], px[i * 3 + 1], px[i * 3 + 2]];
    let mut cent: Vec<[f64; 3]> = Vec::with_capacity(ek);
    cent.push(pick((rng.next() * n as f64).floor() as usize));
    let mut nearest: Vec<f64> = (0..n).map(|j| sq(px, j, &cent[0]).sqrt()).collect();
    for _ in 1..ek {
        let mut total = 0.0;
        for d in &nearest {
            total += d * d;
        }
        let mut selected = 0usize;
        if total == 0.0 {
            selected = (rng.next() * n as f64).floor() as usize;
        } else {
            let mut t = rng.next() * total;
            for (j, d) in nearest.iter().enumerate() {
                t -= d * d;
                if t <= 0.0 {
                    selected = j;
                    break;
                }
            }
        }
        let c = pick(selected);
        cent.push(c);
        for (j, d) in nearest.iter_mut().enumerate() {
            let to_new = sq(px, j, &c).sqrt();
            if to_new < *d {
                *d = to_new;
            }
        }
    }

    // assignToClusters as counts and input-order sums (no member arrays).
    let mut counts = vec![0u32; ek];
    let mut sums = vec![[0.0f64; 3]; ek];
    let assign = |cent: &[[f64; 3]], counts: &mut [u32], sums: &mut [[f64; 3]]| {
        counts.iter_mut().for_each(|c| *c = 0);
        sums.iter_mut().for_each(|s| *s = [0.0; 3]);
        for i in 0..n {
            let mut best = f64::INFINITY;
            let mut bi = 0usize;
            for (j, c) in cent.iter().enumerate() {
                let d = if squared { sq(px, i, c) } else { sq(px, i, c).sqrt() };
                if d < best {
                    best = d;
                    bi = j;
                }
            }
            counts[bi] += 1;
            sums[bi][0] += px[i * 3];
            sums[bi][1] += px[i * 3 + 1];
            sums[bi][2] += px[i * 3 + 2];
        }
    };

    for _ in 0..max_iter {
        assign(&cent, &mut counts, &mut sums);
        let mut max_movement = 0.0f64;
        for j in 0..ek {
            if counts[j] == 0 {
                continue;
            }
            let m = f64::from(counts[j]);
            let next = [js_round(sums[j][0] / m), js_round(sums[j][1] / m), js_round(sums[j][2] / m)];
            let (dr, dg, db) = (cent[j][0] - next[0], cent[j][1] - next[1], cent[j][2] - next[2]);
            let movement = (dr * dr + dg * dg + db * db).sqrt();
            if movement > max_movement {
                max_movement = movement;
            }
            cent[j] = next;
        }
        if max_movement < threshold {
            break;
        }
    }
    assign(&cent, &mut counts, &mut sums);

    for j in 0..ek {
        out[j * 3] = cent[j][0];
        out[j * 3 + 1] = cent[j][1];
        out[j * 3 + 2] = cent[j][2];
        out[k * 3 + j] = f64::from(counts[j]);
    }
    ek as u32
}
