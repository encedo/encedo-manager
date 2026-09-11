# The Encedo product style, so the next interface does not have to invent one

Written 2026-09-03, after the Manager screens were drawn, built and looked
at. It is the product-side companion to `~/develop/www/STYLE.md`, which governs
the marketing sites. Same palette, same voice, same restraint; this one is about
screens people operate rather than pages people read.

**The reference implementations are `encedo-manager/app/style.css`** (tokens
and components, ready to copy) **and `encedo-manager/design/screens/*.dc.html`** (the
screens as drawn). Read one of them before starting. The next interface this
document is for is the **HEM Authenticator**, the phone app; the last section is
about what changes there.

---

## One idea the whole palette carries

**Sealed means inside the module. Exposed means handed to the host**, where
anything running there can read or change it. Green is sealed, rust is exposed,
and nothing else on the screen is allowed to compete with them.

That is the whole colour system. A locked drive is green, an unlocked one is
rust. A key that never leaves the module is green, an imported public key is
rust. A verified log is green, one that fails its checksum is rust. Everything
else — surfaces, rules, text — is a neutral with a slight green cast.

Do not add a third accent for "info" or "primary". If something needs emphasis
and is not about the security boundary, it gets weight, size or position, not
colour. A screen where five things are coloured is a screen where the one that
matters is invisible.

---

## Tokens

Copy this block. It is the same palette as the web kit, with `--exposed-line`
added for controls. The bare `:root` carries the complete light palette; the two
blocks after it redefine tokens only, never components.

```css
:root {
  --ground: #F1F4F3; --surface: #FFFFFF; --sunken: #E7EBE9;
  --ink: #0F1414; --ink-soft: #3A4746; --muted: #6A7773;
  --rule: #D5DCD9; --rule-firm: #A9B5B1;
  --sealed: #0F5F4B; --sealed-soft: #E0EFE9; --sealed-line: #96C6B5;
  --exposed: #94422A; --exposed-soft: #F5E6E0; --exposed-line: #D9AB98;
  --band-bg: #0E5544; --band-ink: #F2F8F5; --band-soft: #AFD2C5; --band-rule: #2E7A64;
  --shadow-sm: 0 1px 2px rgba(15, 20, 20, .05);
  --shadow-lg: 0 2px 4px rgba(15, 20, 20, .04), 0 18px 44px -22px rgba(15, 20, 20, .30);
  --mono:  ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --sans:  system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  --serif: Georgia, "Iowan Old Style", "Palatino Linotype", ui-serif, serif;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground: #0A0E0E; --surface: #121918; --sunken: #060909;
    --ink: #E8F0ED; --ink-soft: #AFBDB8; --muted: #7C8C87;
    --rule: #232D2C; --rule-firm: #3A4644;
    --sealed: #47C6A3; --sealed-soft: #102E27; --sealed-line: #2C6858;
    --exposed: #DE8467; --exposed-soft: #2C1B15; --exposed-line: #5A3226;
    --band-bg: #0D2721; --band-ink: #E6F3ED; --band-soft: #9CBFB4; --band-rule: #2A5A4C;
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, .5);
    --shadow-lg: 0 2px 4px rgba(0, 0, 0, .4), 0 20px 50px -24px rgba(0, 0, 0, .85);
  }
}

:root[data-theme="dark"] { /* the same dark block again, so an explicit toggle wins */ }
```

Three states, not two: an explicit choice stamps `data-theme`, and the default
"system" setting stamps nothing. Define every colour in the bare `:root`, style
components through the tokens only, and give `body` an explicit background from
a token. A colour whose only definition sits inside a media query renders one
theme's text on the other theme's ground.

Both themes are real. The Manager was built and screenshotted in dark first;
neither is an afterthought.

---

## Type

Three system stacks, no web fonts. A product screen must render identically
offline, on a PPA behind an air gap, on the first paint.

- `--sans` for everything a person reads.
- `--mono` for anything the machine said or that is a label: hostnames, key
  ids, scopes, versions, counters, log lines, field labels, button text.
- `--serif` for a lede sentence, sparingly. Most product screens have none.

**The mono/sans split is load-bearing.** Mono means *this is literal* — a value
you could type, copy or compare. It is not decoration, and a screen that sets
body copy in mono has thrown the signal away.

**A byte field is never decoded for display.** A key's description is 128 bytes
and only sometimes text; run a UTF-8 decoder over it and a key whose description
is half text and half key material reads as `WG:pr:���u�l c`, which is not what
is in the device and not anything a person can act on. Show base64, offer hex on
hover, and let the bytes go back to the module exactly as they came. Text may be
*encoded* into such a field when someone types it — that direction loses
nothing. The same rule covers anything else the hardware calls a blob.

Sizes, from the Manager:

| Role | Size | Notes |
|---|---|---|
| Page heading (`h1`) | 30px / 1.14 / -.025em / 620 | A sentence, `text-wrap: balance` |
| Section heading (`h2`) | 18px / 620 | |
| Body | 15px / 1.5 | 16px for the lede under an `h1` |
| Eyebrow | 11.5px mono, `.17em`, uppercase, `--sealed` | One per screen |
| Field label | 10.5px mono, `.14em`, uppercase, `--muted` | |
| Button | 13px mono, `.02em` | |
| Note / footer line | 12px mono, 1.7 | |

Running prose stops at 66ch (`.measure`). Evidence — tables, cards, grids —
does not.

---

## Voice

This matters more than the CSS and is the part most easily lost.

- **Declarative, never promotional.** "The key cannot be taken." Not "Unmatched
  security".
- **British spelling.** *licence*, *recognise*, *behaviour*, *personalisation*.
- **The hardware is the Encedo HEM.** Two versions, EPA and PPA, exposing one
  and the same API. In running prose after the first mention, "the module". Not
  "device", not "HSM", not "hardware module".
- **Headings are sentences that report the current state**, not labels. This is
  the single most distinctive thing about these screens:

  > "The module is sealed and reachable." · "One drive is on the host." ·
  > "Two phones can answer for you." · "Every log file is verified before you
  > read it."

  Not "Overview", "Secure drive", "Paired phones". The eyebrow above carries the
  section name; the heading tells you what is true right now, and changes when
  the state does.
- **Name the cost.** Every screen that hands something over says what that
  costs: "While a drive is unlocked, its contents are as safe as the host."
  A screen that only lists benefits reads as advertising.
- **Say what has not been done.** A page that is not built says so and names
  what it will be built from. An unverified log says which entry failed and why.
  Never hide an absence behind a spinner or a cheerful default.
- **Errors explain and point.** "Word 7 is not a BIP39 word." Not "Invalid
  input". "The phone declined the request." Not "Error 403".
- **Controls say what happens.** "Unlock read-write", then the state line says
  read-write. Not "Submit", not "OK".
- **No exclamation marks, no emoji, no "Oops".** The v1 Manager said "Upsss".
  It is gone.

---

## Screen anatomy

Every screen is the same three moves:

```html
<div class="page-head">
  <p class="eyebrow">Secure drive</p>
  <h1>One drive is on the host.</h1>
  <p>Unlocking hands a drive to the computer the module is plugged into, over USB.</p>
</div>

<!-- the state, at a glance -->
<div class="card"> <dl class="status-grid"> … </dl> <p class="status-note">…</p> </div>

<!-- the evidence and the actions -->
<div class="grid-2"> … </div>

<!-- what it costs, as term-and-explanation pairs -->
<dl> <div class="item"><dt>What unlocking costs</dt><dd>…</dd></div> </dl>
```

The summary comes before the detail. What needs attention reads at a glance,
encoded in form as well as words: a rust pill, a rust value in the status grid,
a "Needs you" card that only exists when something does.

---

## Components worth reusing

All of them are in `app/style.css`.

| Class | For |
|---|---|
| `.card` + `.card-head` | Any bounded thing. The head is a mono strip: what it is on the left, its state on the right |
| `.status-grid` | Six or so term/value pairs, one grid, hairline rules from the background showing through a 1px gap |
| `.status-note` | The sentence under a status grid that says what the words mean |
| `.pill` / `.pill.sealed` / `.pill.exposed` | One word of state with a dot. Never more than one per object |
| `.item` (in a `<dl>`) | Term and explanation, 200px column then prose. The "what it costs" pattern |
| `.steps` / `.step` | An ordered process with mono numbers. Only when the order is real |
| `.button` / `.plain` / `.exposed` / `.small` | Sealed-green default, neutral secondary, rust for anything that hands something over |
| `.field` | Mono uppercase label above a 44px input |
| `table` + `thead th` | Lists of real records. Mono column heads, tabular numerals |
| `th.sortable` + `.card-foot` | A table long enough to sort and page: the head cells are buttons with one arrow, the foot says what is shown and how many fit |
| `tr.detail` + `.detail-body` | One record opened under its own row. Never at the bottom of the page — the eye should not have to travel to find what it just clicked |
| `.blob` | Bytes shown as bytes: base64 or hex, mono, wrapped, on the sunken ground. Never re-typed by hand, so it carries a copy button |
| Read-only field + `Edit` | A record's editable parts sit in their fields, locked, until Edit unlocks them and Save or Cancel closes it again. Nothing on a page that reports state is silently typeable |
| `button.copy` (in `.field-head`) | Anything the reader will want to take elsewhere — a key id, a label, a description — carries a copy control in its label row, mono and quiet, that turns into a tick and "Copied" for two seconds. It reads the value when pressed, so an edited field copies what it now says |
| `figure.qr` | A QR code. **Always dark on white**, whatever the theme: a scanner needs the contrast, and a code inverted by dark mode does not read |

**Not everything is a card.** Border, fill, radius and shadow each say
"separate object". The Manager uses one radius (5px), one small shadow for
resting surfaces and one large shadow for the single thing being asked about —
the sign-in card, the QR panel. Stamping the large shadow on everything
flattens the hierarchy.

---

## Icons

Inline stroke SVG on a 20px grid: `fill: none`, `stroke: currentColor`,
`stroke-width: 1.6`, round caps and joins. Eight of them cover the whole
Manager. They inherit colour, so they work in both themes and in a disabled
state without a second asset.

**No emoji, ever**, and no icon fonts. The v1 Manager used fontello; it is gone.
If an icon is missing, draw a plain placeholder rather than approximating a real
mark badly.

The family mark is the green rounded square with the module outline and the key
inside it — `www/wg.encedo.com/favicon.svg`. Reuse it as is, or keep the
geometry and change only the glyph.

---

## Layout and interaction

- Flex or grid with `gap`, never margins between siblings and never whitespace
  text nodes.
- `min-width: 0` on every grid and flex child. One unwrapped mono string drags
  the whole document wider than the screen, and `overflow-x` on the block itself
  does not save you.
- Hit targets never below 44px. Buttons are 44px, inputs are 44px, nav rows are
  44px. `.small` is 36px and is only for a control inside a row of records.
- Visible focus: `outline: 2px solid var(--sealed); outline-offset: 3px`.
- Motion is for state changes only, guarded by `prefers-reduced-motion`. No
  entrance animations. The v1 Manager animated every element into place on every
  page change; it made the app feel slow and it is gone.
- Wide content scrolls inside its own container. The page body never scrolls
  sideways.

---

## What this style deliberately does not do

Worth stating, because each of these was in v1 and each was removed:

- No gradients. v1 had gradient buttons with an infinite background animation.
- No purple. The v1 palette (`#6E358C`, `#2A225E`, `#AD348B`) belonged to an
  older brand and carried no meaning.
- No pill-shaped buttons with rotating circular icons.
- No dark mode that switches itself on after 19:00.
- No emoji, no icon font, no lorem ipsum. A screen with nothing to say says so.
- No decorative numbers. A count appears only when a person acts on it.

---

## For the HEM Authenticator specifically

The phone app is the other half of every flow the Manager draws: it is what
answers when the Manager says "Confirm on your phone", what scans the QR code
when the Manager says "Pair a phone", and what reads the QR of a share code off
the Manager's keychain page. Same palette, same voice, same
mono-means-literal rule. What changes:

- **One decision per screen, and it is a security decision.** The approve/deny
  moment is the whole product. It shows who is asking, for what scope, and from
  which module — in mono, because every one of those is a literal value — and
  two controls: approve in sealed green, deny in rust. Nothing else on that
  screen.
- **Show the request, not a notification.** "my.ence.do wants to unlock disk0
  read-write" is the heading. The scope string is visible, not summarised away.
- **No fake chrome.** No painted iOS status bar, no drawn keyboard. The real
  ones render on top of the layout.
- **The pairing QR is the Manager's, not yours.** The Manager renders it; the
  app reads it and checks the hash it carries against the request it later
  fetches. Draw the camera view plain: a frame, the four corners, no skeuomorph.
- **Offline is a state, not an error.** A phone with no network cannot answer a
  request. Say that, with the same "Air-gapped" tone the Manager uses.
- **The state colours still mean the same thing.** Green is what stays on the
  module or in the secure element. Rust is what leaves.
- **Type scale shifts, the ramp does not.** Headings drop to ~26px, body stays
  15px, mono labels stay 10.5–12px. Hit targets stay 44px and matter more.

Do not transplant the Manager's sidebar shell. A phone app is a stack of single
purposes: the request, the list of paired modules, the settings. What transfers
is the palette, the voice, the components and the sealed/exposed idea.
