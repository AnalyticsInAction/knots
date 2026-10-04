const NS = 'http://www.w3.org/2000/svg', W = 5;
const measure = document.getElementById('measure');

// Sample a path and return a polyline offset sideways by o, over the range a..b of its length.
function off(d, o, a = 0, b = 1) {
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', d); measure.appendChild(p);
  const L = p.getTotalLength(), n = Math.max(6, Math.ceil(L * (b - a) / 3)), pts = [];
  let end;
  for (let i = 0; i <= n; i++) {
    const s = L * (a + (b - a) * i / n);
    const q = p.getPointAtLength(s), q1 = p.getPointAtLength(Math.max(0, s - .5)), q2 = p.getPointAtLength(Math.min(L, s + .5));
    let tx = q2.x - q1.x, ty = q2.y - q1.y; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
    pts.push([q.x - ty * o, q.y + tx * o]);
    end = { x: q.x, y: q.y, tx, ty };
  }
  p.remove();
  return { pts, end };
}
const toD = pts => 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');
const cas = (d, w) => `<path class="cas" stroke-width="${w}" d="${d}"/>`;
const line = (d, k, x = '') => `<path class="ln ln-${k} ${x}" d="${d}"/>` + (k === 'b' ? `<path class="tex ${x}" d="${d}"/>` : '');

function dbl(it) {
  const o = it.o || 3.5, r = it.r || [[0, 1], [0, 1]];
  const A = off(it.dbl, o, r[0][0], r[0][1]), B = off(it.dbl, -o, r[1][0], r[1][1]);
  let out = it.open ? '' : cas(it.dbl, 2 * o + W + 4);
  if (it.bight) {
    const e = A.end, arc = [];
    for (let i = 1; i < 8; i++) {
      const f = Math.PI * i / 8, c = Math.cos(f) * o, s = Math.sin(f) * o;
      arc.push([e.x - e.ty * c + e.tx * s, e.y + e.tx * c + e.ty * s]);
    }
    return out + line(toD([...A.pts, ...arc, ...B.pts.reverse()]), it.k[0]);
  }
  return out + line(toD(A.pts), it.k[0]) + line(toD(B.pts), it.k[1]);
}

// Coil wraps: front strokes cross the lines; back strokes (drawn earlier) join them behind.
function bars(it) {
  const [x, yT, yB, n, dx, s] = it.bars; let out = '';
  for (let i = 0; i < n; i++) {
    const c = x + i * dx;
    if (it.back) { if (i < n - 1) out += line(`M${c - s},${yB} L${c + dx + s},${yT}`, it.k, 'bk'); }
    else { const d = `M${c + s},${yT} L${c - s},${yB}`; out += cas(d, W + 4) + line(d, it.k); }
  }
  return out;
}

function draw(step) {
  let o = '';
  for (const it of step.items) {
    if (it.s) o += cas(it.s, W + 5) + line(it.s, it.k);
    else if (it.dbl) o += dbl(it);
    else if (it.bars) o += bars(it);
    else if (it.ring) {
      const [x, y] = it.ring;
      const d = it.half === 'L' ? `M${x},${y - 10} A10,10 0 0 0 ${x},${y + 10}`
              : it.half === 'R' ? `M${x},${y - 10} A10,10 0 0 1 ${x},${y + 10}`
              : `M${x - 10},${y} a10,10 0 1 0 20,0 a10,10 0 1 0 -20,0`;
      o += `<path class="hook" d="${d}"/>`;
    }
    else if (it.shank) {
      const [x, y, rot] = it.shank;
      o += `<path class="hook" transform="translate(${x},${y}) rotate(${rot})" d="M0,10 L0,58 C0,86 -36,86 -36,58 L-36,44 M-36,44 l7,9"/>`;
    }
    else if (it.finger) o += `<circle class="finger" cx="${it.finger[0]}" cy="${it.finger[1]}" r="13"/>`;
    else if (it.arrow) o += `<path class="arr" marker-end="url(#ah)" d="${it.arrow}"/>`;
    else if (it.raw) o += it.raw;
    else if (it.brace) o += `<path class="brace" d="${it.brace}"/>`;
  }
  // flip: mirror the drawing left-to-right but keep the labels readable
  const w = step.vb[2] || 360, f = step.flip, swap = { start: 'end', end: 'start', middle: 'middle' };
  if (f) o = `<g transform="translate(${w},0) scale(-1,1)">${o}</g>`;
  for (const [x, y, t, c, a = 'start'] of step.labels || [])
    o += `<text class="lb lb-${c}" x="${f ? w - x : x}" y="${y}" text-anchor="${f ? swap[a] : a}">${t}</text>`;
  return `<svg viewBox="0 ${step.vb[0]} ${w} ${step.vb[1]}" role="img">${o}</svg>`;
}

/* ---------- geometry shared between steps ---------- */

// Figure-8 dropper: a loop with two twists in its neck (crossings at 175,160 and 175,120)
const F8 = {
  a:  'M20,188 L125,188 C150,188 163,175 175,160 C181,152.5 184,146.25 184,140',
  b1: 'M184,140 C184,133.75 181,127.5 175,120 C155,95 135,80 135,62 C135,46 155,38 175,38',
  b2: 'M175,38 C195,38 215,46 215,62 C215,80 195,95 175,120 C169,127.5 166,133.75 166,140',
  c:  'M166,140 C166,146.25 169,152.5 175,160 C187,175 200,188 225,188 L340,188',
};
const LF = ['f', 'l'];
// Forceps through the loop, gripping both ends: handles pass behind the loop, jaws in front
const FORCEPS_BACK = '<path class="hook" d="M112,-12 L184,75 M142.5,-21 L198,75"/>' +
  '<circle class="hook" cx="104" cy="-22" r="13"/><circle class="hook" cx="136" cy="-32" r="13"/>';
const FORCEPS_FRONT = '<path class="cas" stroke-width="13" d="M191,75 L232,133 L262,178"/>' +
  '<path class="hook" d="M184,75 L232,133 M198,75 L232,133"/><path class="hook" stroke-width="7" d="M232,133 L268,187"/>' +
  '<circle cx="232" cy="133" r="3.5" style="fill:var(--hook)"/>';

// Palomar: loose overhand in the doubled line, hook hanging on the bottom of the loop
const PAL = [
  { dbl: 'M215,45 C233,62 205,80 185,100', k: ['b', 'b'] },
  { ring: [160, 140], half: 'L' },
  { dbl: 'M12,60 L160,60 A40,40 0 1 1 120,100', k: ['b', 'b'], r: [[0.14, 1], [0, 1]] },
  { ring: [160, 140], half: 'R' }, { shank: [160, 140, 0] },
  { dbl: 'M120,100 C120,75 110,62 118,46 C126,26 192,24 215,45', k: ['b', 'b'] },
  { dbl: 'M185,100 C170,118 200,150 250,150 L292,150', k: ['b', 'b'], bight: 1 },
];

// 16/20: line through the eye, tag back along the main line
const P_LEG = 'M264,121 C264,126 258,128 250,128 L130,128 C105,128 70,118 70,88 C70,60 116,60 118,86 ';
const P_FORCEPS = '<path class="cas" stroke-width="12" d="M312,139 L366,139"/><path class="hook" stroke-width="7" d="M312,139 L368,139"/>' +
  '<path class="hook" d="M368,139 L405,130 M368,139 L405,150"/><circle cx="368" cy="139" r="3.5" style="fill:var(--hook)"/>' +
  '<circle class="hook" cx="415" cy="126" r="11"/><circle class="hook" cx="415" cy="154" r="11"/>';
const P_EYE = [{ ring: [258, 121] }, { shank: [258, 121, -90] }, { raw: P_FORCEPS },{ s: 'M14,114 L250,114 C258,114 264,116 264,121', k: 'f' }];

// Albright: fluoro loop on the right, braid coming in from the left
const A_LOOP = { dbl: 'M346,125 L120,125', k: ['f', 'f'], o: 13, bight: 1, open: 1, r: [[0, 1], [0.3, 1]] };
const A_WRAPS = [247, 100, 150, 6, -16, 5];

const KNOTS = [
{
  id: 'fig8', tab: 'Fig-8', sub: 'Dropper',
  name: 'Figure-8 Dropper', aka: 'Figure-of-eight dropper tag knot (Orvis tippet knot family)',
  use: 'Dropper',
  when: 'Adding tippet and leaving a <b>dropper tag</b> for Euro-nymphing or any multi-fly rig. Stronger at the tag than a surgeon’s knot.',
  rig: [['l', 'Leader from rod'], ['f', 'New tippet']],
  steps: [
    { vb: [80, 122], text: 'Lay the new tippet alongside the end of your leader, overlapping 15–20 cm, and pinch them together. The <b>leader end</b> will become the dropper tag.',
      items: [{ s: 'M14,112 L250,112', k: 'l' }, { s: 'M95,128 L346,128', k: 'f' }, { brace: 'M95,160 v8 H250 v-8' }],
      labels: [[14, 100, 'LEADER ← from rod', 'l'], [346, 100, 'end becomes DROPPER TAG', 'l', 'end'],
               [95, 148, 'tippet tag', 'f'], [346, 148, 'NEW TIPPET → point fly', 'f', 'end'], [172, 188, 'overlap 15–20 cm', 'note', 'middle']] },
    { vb: [-50, 290],
      list: ['Form a loop pointing <b>up</b> and twist it <b>twice</b> (anticlockwise looking down).',
             'Push the forceps through the loop, grip <b>both ends</b> — the dropper tag and the tippet — and pull them right back through.',
             'Wet it, let it close into a neat <b>figure-8</b>, then pull all four ends tight.',
             'Trim the tippet tag (the one pointing back up the leader). <b>Keep</b> the leader end as your dropper.'],
      items: [{ raw: FORCEPS_BACK }, { dbl: F8.c, k: LF, r: [[0, 1], [0, 0.7]] }, { dbl: F8.b1, k: LF }, { dbl: F8.b2, k: LF },
              { dbl: F8.a, k: LF, r: [[0.25, 1], [0, 1]] }, { raw: FORCEPS_FRONT }, { arrow: 'M322,152 L266,50' }],
      labels: [[122, 58, 'LOOP', 'note', 'end'], [122, 74, 'twist ×2', 'note', 'end'],
               [352, 22, 'pull both ends', 'note', 'end'], [352, 38, 'through the loop', 'note', 'end'],
               [14, 172, 'LEADER ← rod', 'l'], [14, 212, '✂ tippet tag — trim', 'f'],
               [346, 212, 'DROPPER TAG — keep', 'l', 'end'], [346, 230, 'TIPPET → point fly', 'f', 'end'],
               [96, -2, 'forceps', 'note', 'end']] },
  ],
  tips: ['<b>Forceps make it easier:</b> put the forceps in the loop instead of your finger and spin them to make the two twists.',
         'The dropper must be the <b>leader end</b> (the line already on your rod), not the piece you added — it then pulls in line instead of shearing the knot open.',
         'Leave 10–15 cm of dropper tag.'],
},
{
  id: 'p1620', tab: '16/20', sub: 'Fluoro to hook',
  name: '16/20 Knot', aka: 'Pitzen knot / Eugene bend',
  use: 'Fluoro to hook',
  when: 'Tying <b>fluorocarbon or mono tippet to a fly or hook</b>. Small, very strong, and seats with a click.',
  rig: [['f', 'Fluoro tippet'], ['h', 'Fly or hook']],
  steps: [
    { vb: [26, 146, 432], flip: 1, text: 'Wind the tag <b>4 times</b> around both lines, working toward the hook. Then pass the tag back through the small loop your finger was holding.',
      items: [{ s: 'M100,100 L100,40', k: 'f' }, { bars: [136, 105, 138, 4, 20, -4], k: 'f', back: 1 },
              { s: P_LEG + 'C119,98 124,104 132,105', k: 'f' }, ...P_EYE,
              { bars: [136, 105, 138, 4, 20, -4], k: 'f' },
              { s: 'M200,138 C204,162 150,160 124,154 C106,150 100,138 100,100', k: 'f' },
              { arrow: 'M140,92 L204,92' }],
      labels: [[108, 46, 'TAG END through loop', 'f'], [172, 84, '4 wraps', 'note', 'middle'], [14, 152, 'MAIN → rod', 'f'], [372, 118, 'forceps', 'note', 'middle']] },
  ],
  tips: ['<b>Forceps make it easier:</b> clamp them onto the fly. The extra weight keeps the tippet taut so the wraps go on quickly and neatly.',
         'Tighten by pulling the main line — you should feel it pop into place. If it doesn’t click, retie.',
         '3 wraps is enough on heavy tippet; use 4–5 on very fine tippet.'],
},
{
  id: 'albright', tab: 'Albright', sub: 'Braid to fluoro',
  name: 'Albright', aka: 'Albright special',
  use: 'Braid to fluoro',
  when: 'Joining <b>braid main line to a fluorocarbon leader</b>. Slim enough to run through the rod guides.',
  rig: [['b', 'Braid'], ['f', 'Fluoro leader']],
  steps: [
    { vb: [70, 108], flip: 1, text: 'Pass the braid tag back through the loop so it comes out the <b>same side it went in</b>, next to the braid main line.',
      items: [{ bars: A_WRAPS, k: 'b', back: 1 }, { s: 'M162,150 C150,150 142,133 128,133 L50,150', k: 'b' }, { s: 'M14,125 L262,125', k: 'b' }, A_LOOP,
              { s: 'M262,125 C275,125 275,101 252,100', k: 'b' }, { bars: A_WRAPS, k: 'b' }],
      labels: [[14, 112, 'BRAID → reel', 'b'], [50, 170, 'BRAID TAG', 'b', 'middle'], [346, 100, 'fly ← FLUORO', 'f', 'end'], [180, 84, '10 wraps', 'note', 'middle']] },
  ],
  tips: ['The loop is always made in the <b>thicker, stiffer line</b> (the fluoro); the braid does the wrapping.',
         'Keep the wraps pinched and side by side — one crossed wrap is where it fails.',
         'Give it a hard test pull before you fish it.'],
},
{
  id: 'palomar', tab: 'Palomar', sub: 'Braid to hook',
  name: 'Palomar', aka: 'Doubled-line knot',
  use: 'Braid to hook or tippet ring',
  when: 'Tying <b>braid to a hook, lure, swivel or tippet ring</b>. The doubled line stops slippery braid from pulling through.',
  rig: [['b', 'Braid'], ['h', 'Hook or tippet ring']],
  steps: [
    { vb: [12, 240],
      list: ['Double about 15 cm of braid and push the loop through the eye (or ring).',
             'Tie a loose <b>overhand knot</b> with the doubled line, hook hanging at the bottom.',
             'Pass the <b>loop</b> right over the whole hook (or ring).',
             'Wet it, pull the main line and tag <b>together</b> until it seats above the eye, then trim the tag.'],
      items: [...PAL, { arrow: 'M306,154 C336,215 215,248 124,236' }],
      labels: [[14, 86, 'MAIN + TAG', 'b'], [292, 136, 'LOOP', 'b', 'middle'], [114, 241, 'over the hook', 'note', 'end']] },
  ],
  tips: ['On a <b>tippet ring</b> it is the same knot — the loop just passes over the ring.',
         'Make sure the loop seats <b>above</b> the eye, not caught on the shank.',
         'Braid cuts skin under load — snug it down with the line wrapped round forceps or a gloved hand.'],
},
];

/* ---------- page ---------- */
const app = document.getElementById('app'), nav = document.getElementById('nav');
app.innerHTML = KNOTS.map(k => `
<section class="knot" id="k-${k.id}">
  <div class="head">
    <h1>${k.name}</h1>
    <p class="use">Use: ${k.use}</p>
  </div>
  ${k.steps.map(s => `<div class="step">${draw(s)}</div>`).join('')}
</section>`).join('');
nav.innerHTML = KNOTS.map(k => `<button data-id="${k.id}"><b>${k.tab}</b><small>${k.sub}</small></button>`).join('');

function show(id) {
  if (id === 'all') { document.body.classList.add('all'); return; }
  if (!KNOTS.some(k => k.id === id)) id = KNOTS[0].id;
  document.querySelectorAll('section.knot').forEach(s => s.classList.toggle('on', s.id === 'k-' + id));
  nav.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.id === id));
  try { localStorage.setItem('knot', id); } catch (e) {}
}
nav.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  history.replaceState(null, '', '#' + b.dataset.id); show(b.dataset.id); scrollTo(0, 0);
});
let start = location.hash.slice(1);
if (!start) { try { start = localStorage.getItem('knot'); } catch (e) {} }
show(start);

// Keep the screen on while tying (ignored where unsupported)
async function wake() { try { await navigator.wakeLock.request('screen'); } catch (e) {} }
wake(); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wake(); });

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
