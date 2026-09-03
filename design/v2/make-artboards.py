#!/usr/bin/env python3
"""Generates the v2 screen mockups (*.dc.html) and canvas.json for the design canvas.

Tokens and component values are lifted from ~/develop/www/_kit/base.css and
wg.encedo.com/index.html (the encedo web style): system fonts, the sealed /
exposed pair, 5px radii, mono labels. Re-run after editing, then re-seed.
"""
import json, os, random

OUT = os.path.dirname(os.path.abspath(__file__))

CSS = """
    :root {
      --ground: #F1F4F3; --surface: #FFFFFF; --sunken: #E7EBE9;
      --ink: #0F1414; --ink-soft: #3A4746; --muted: #6A7773;
      --rule: #D5DCD9; --rule-firm: #A9B5B1;
      --sealed: #0F5F4B; --sealed-soft: #E0EFE9; --sealed-line: #96C6B5;
      --exposed: #94422A; --exposed-soft: #F5E6E0; --exposed-line: #D9AB98;
      --band-bg: #0E5544; --band-ink: #F2F8F5; --band-soft: #AFD2C5; --band-rule: #2E7A64;
      --shadow-sm: 0 1px 2px rgba(15, 20, 20, .05);
      --shadow-lg: 0 2px 4px rgba(15, 20, 20, .04), 0 18px 44px -22px rgba(15, 20, 20, .30);
      --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      --sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      --serif: Georgia, "Iowan Old Style", "Palatino Linotype", ui-serif, serif;
    }
    * { box-sizing: border-box; min-width: 0; }
    body { margin: 0; background: var(--ground); color: var(--ink); font-family: var(--sans); font-size: 15px; line-height: 1.5; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
    a { color: var(--sealed); text-underline-offset: 3px; text-decoration-thickness: 1px; }
    a:hover { color: var(--band-bg); }
    h1, h2, h3, p, dl, dd, dt, ul { margin: 0; }
    h1 { font-size: 30px; line-height: 1.14; letter-spacing: -.025em; font-weight: 620; text-wrap: balance; }
    h2 { font-size: 18px; font-weight: 620; letter-spacing: -.008em; }
    .eyebrow { font-family: var(--mono); font-size: 11.5px; letter-spacing: .17em; text-transform: uppercase; color: var(--sealed); }
    .lede { font-family: var(--serif); font-size: 19px; line-height: 1.5; color: var(--ink-soft); }
    .soft { color: var(--ink-soft); }
    .muted { color: var(--muted); }
    .mono { font-family: var(--mono); }
    .masthead { display: flex; justify-content: space-between; align-items: baseline; gap: 20px; flex-wrap: wrap; font-family: var(--mono); font-size: 12px; letter-spacing: .04em; color: var(--muted); }
    .masthead b { color: var(--ink); font-weight: 500; letter-spacing: .02em; }
    .button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 12px 20px; border-radius: 5px; font-family: var(--mono); font-size: 13px; letter-spacing: .02em; text-decoration: none; border: 1px solid var(--sealed-line); color: var(--sealed); background: var(--sealed-soft); cursor: pointer; white-space: nowrap; }
    .button.plain { background: none; border-color: var(--rule-firm); color: var(--ink-soft); }
    .button.exposed { background: var(--exposed-soft); border-color: var(--exposed-line); color: var(--exposed); }
    .button.small { min-height: 36px; padding: 8px 14px; font-size: 12px; }
    .card { background: var(--surface); border: 1px solid var(--rule); border-radius: 5px; box-shadow: var(--shadow-sm); overflow: hidden; }
    .card-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 11px 18px; background: var(--sunken); border-bottom: 1px solid var(--rule); font-family: var(--mono); font-size: 11.5px; letter-spacing: .06em; color: var(--muted); }
    .card-head .v { color: var(--ink); }
    .pill { display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--rule); color: var(--muted); background: var(--sunken); white-space: nowrap; }
    .pill.sealed { color: var(--sealed); background: var(--sealed-soft); border-color: var(--sealed-line); }
    .pill.exposed { color: var(--exposed); background: var(--exposed-soft); border-color: var(--exposed-line); }
    .pill i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; display: inline-block; }
    table { border-collapse: collapse; width: 100%; font-size: 15px; font-variant-numeric: tabular-nums; }
    th, td { text-align: left; padding: 14px 20px; border-bottom: 1px solid var(--rule); vertical-align: top; }
    thead th { font-family: var(--mono); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); font-weight: 500; background: var(--sunken); white-space: nowrap; }
    tbody tr:last-child td { border-bottom: 0; }
    td.risk { color: var(--exposed); }
    td.safe { color: var(--sealed); }
    td .mono, th .mono { font-size: 13.5px; }
    .status-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; background: var(--rule); }
    .status-grid div { background: var(--surface); padding: 20px 24px; display: flex; flex-direction: column; gap: 4px; }
    .status-grid dt { font-family: var(--mono); font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
    .status-grid dd { font-size: 15px; color: var(--ink); font-variant-numeric: tabular-nums; }
    .status-grid dd.pending { color: var(--muted); }
    .status-grid dd.risk { color: var(--exposed); }
    .status-note { padding: 18px 24px; border-top: 1px solid var(--rule); color: var(--ink-soft); font-size: 15px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label { font-family: var(--mono); font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
    .field input { height: 44px; padding: 0 14px; border: 1px solid var(--rule-firm); border-radius: 5px; font: inherit; font-size: 15px; background: var(--surface); color: var(--ink); width: 100%; }
    .field input::placeholder { color: var(--muted); }
    .nav { display: flex; flex-direction: column; gap: 4px; }
    .nav a { display: flex; align-items: center; gap: 12px; height: 44px; padding: 0 14px; border-radius: 5px; color: var(--ink-soft); text-decoration: none; font-size: 15px; border: 1px solid transparent; }
    .nav a.active { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-sm); border-color: var(--rule); }
    .nav a:hover { color: var(--ink); }
    .nav svg, .ico { width: 20px; height: 20px; stroke: currentColor; fill: none; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; flex: none; }
    .cline { font-family: var(--mono); font-size: 13px; line-height: 2; white-space: pre; color: var(--ink-soft); overflow: hidden; text-overflow: ellipsis; }
    .cline .k { color: var(--ink); }
    .cline.in { color: var(--sealed); background: var(--sealed-soft); border-radius: 2px; padding: 0 5px; margin: 0 -5px; }
    .cline.out { color: var(--exposed); background: var(--exposed-soft); border-radius: 2px; padding: 0 5px; margin: 0 -5px; }
    .steps { display: flex; flex-direction: column; gap: 18px; }
    .step { display: grid; grid-template-columns: 22px 1fr; gap: 14px; align-items: baseline; }
    .step-n { font-family: var(--mono); font-size: 12px; color: var(--sealed); letter-spacing: .04em; }
    .step p { font-size: 15.5px; color: var(--ink-soft); }
    .step b { color: var(--ink); font-weight: 600; }
    .step.done .step-n { color: var(--muted); }
    .item { display: grid; grid-template-columns: 200px 1fr; gap: 28px; padding: 18px 0; border-top: 1px solid var(--rule); }
    .item:first-child { border-top: 0; padding-top: 0; }
    .item dt { font-family: var(--mono); font-size: 13.5px; color: var(--ink); line-height: 1.5; }
    .item dd { color: var(--ink-soft); font-size: 15px; }
    .bar { height: 8px; border-radius: 999px; background: var(--sunken); overflow: hidden; }
    .bar span { display: block; height: 100%; background: var(--sealed); border-radius: 999px; }
"""

ICONS = {
    "home": '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" rx="2.5"></rect><circle cx="10" cy="10" r="2.2"></circle></svg>',
    "keychain": '<svg viewBox="0 0 20 20"><circle cx="7" cy="12" r="3.5"></circle><path d="M9.8 9.8 17 2.6M14 5.6l2 2M11.6 8l1.6 1.6"></path></svg>',
    "drive": '<svg viewBox="0 0 20 20"><rect x="3" y="6" width="14" height="9" rx="1.5"></rect><path d="M6 10.5h5"></path><circle cx="14" cy="10.5" r=".9"></circle></svg>',
    "phones": '<svg viewBox="0 0 20 20"><rect x="6" y="2" width="8" height="16" rx="1.6"></rect><path d="M9 15.2h2"></path></svg>',
    "log": '<svg viewBox="0 0 20 20"><path d="M4 5h12M4 10h12M4 15h7"></path></svg>',
    "hardware": '<svg viewBox="0 0 20 20"><rect x="6" y="6" width="8" height="8" rx="1"></rect><path d="M8 3v3M12 3v3M8 14v3M12 14v3M3 8h3M3 12h3M14 8h3M14 12h3"></path></svg>',
    "software": '<svg viewBox="0 0 20 20"><path d="M10 3v10M6 9l4 4 4-4M4 17h12"></path></svg>',
    "settings": '<svg viewBox="0 0 20 20"><path d="M3 6h14M3 14h14"></path><circle cx="8" cy="6" r="2" fill="#F1F4F3"></circle><circle cx="13" cy="14" r="2" fill="#F1F4F3"></circle></svg>',
}

MARK = ('<svg viewBox="0 0 64 64" width="{s}" height="{s}" role="img" aria-label="Encedo HEM">'
        '<rect width="64" height="64" rx="13" fill="#0F5F4B"></rect>'
        '<rect x="16" y="16" width="32" height="32" rx="7" fill="none" stroke="#AFD2C5" stroke-width="4"></rect>'
        '<circle cx="32" cy="32" r="6" fill="#F2F8F5"></circle></svg>')

NAV = [("home", "Overview"), ("keychain", "Keychain"), ("drive", "Secure drive"), ("phones", "Paired phones"),
       ("log", "Operation log"), ("hardware", "Hardware"), ("software", "Software"), ("settings", "Settings")]


def page(body, width=1440, height=900, title="Encedo HEM Manager"):
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <title>{title}</title>
  <style>{CSS}  </style>
</helmet>
<div style="width: {width}px; min-height: {height}px; background: #F1F4F3; display: flex; flex-direction: column;">
{body}
</div>
</x-dc>
</body>
</html>
"""


def shell(active, inner, masthead_right="firmware 2.4.1 &middot; PPA &middot; broker reachable"):
    links = []
    for key, label in NAV:
        cls = ' class="active"' if key == active else ""
        links.append(f'      <a href="#"{cls}>{ICONS[key]}<span>{label}</span></a>')
    nav = "\n".join(links)
    return f"""  <div style="display: flex; flex: 1; min-height: 0;">
    <aside style="width: 248px; flex: none; border-right: 1px solid #D5DCD9; padding: 28px 16px 24px; display: flex; flex-direction: column; gap: 28px;">
      <div style="display: flex; align-items: center; gap: 12px; padding: 0 6px;">
        {MARK.format(s=36)}
        <div style="display: flex; flex-direction: column; line-height: 1.2;">
          <span style="font-weight: 620; font-size: 15px; letter-spacing: -.01em;">Encedo HEM</span>
          <span class="mono" style="font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #6A7773;">Manager</span>
        </div>
      </div>
      <nav class="nav">
{nav}
      </nav>
      <div style="margin-top: auto; display: flex; flex-direction: column; gap: 6px; padding: 14px; border-top: 1px solid #D5DCD9; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.6; color: #6A7773;">
        <span style="color: #0F1414;">my.ence.do</span>
        <span>192.168.7.1 &middot; LAN</span>
        <span>Ann &middot; <a href="#">Sign out</a></span>
      </div>
    </aside>
    <main style="flex: 1; display: flex; flex-direction: column; gap: 32px; padding: 26px 48px 56px;">
      <div class="masthead">
        <span><b>Encedo HEM Manager</b> &nbsp;2.0.0-dev</span>
        <span>{masthead_right}</span>
      </div>
{inner}
    </main>
  </div>
"""


def heading(eyebrow, h1, lede=None):
    l = f'\n        <p class="soft" style="max-width: 66ch; font-size: 16px;">{lede}</p>' if lede else ""
    return f"""      <div style="display: flex; flex-direction: column; gap: 10px;">
        <p class="eyebrow">{eyebrow}</p>
        <h1>{h1}</h1>{l}
      </div>"""


def qr_svg(size=224, seed=7):
    """A QR-looking placeholder: finder patterns plus a deterministic module field."""
    n = 29
    cell = size / n
    rng = random.Random(seed)
    rects = []
    def finder(x, y):
        rects.append(f'<rect x="{x*cell:.1f}" y="{y*cell:.1f}" width="{7*cell:.1f}" height="{7*cell:.1f}" fill="#0F1414"></rect>')
        rects.append(f'<rect x="{(x+1)*cell:.1f}" y="{(y+1)*cell:.1f}" width="{5*cell:.1f}" height="{5*cell:.1f}" fill="#FFFFFF"></rect>')
        rects.append(f'<rect x="{(x+2)*cell:.1f}" y="{(y+2)*cell:.1f}" width="{3*cell:.1f}" height="{3*cell:.1f}" fill="#0F1414"></rect>')
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7)
    for y in range(n):
        for x in range(n):
            in_finder = (x < 8 and y < 8) or (x >= n - 8 and y < 8) or (x < 8 and y >= n - 8)
            if in_finder:
                continue
            if rng.random() < 0.46:
                rects.append(f'<rect x="{x*cell:.1f}" y="{y*cell:.1f}" width="{cell:.1f}" height="{cell:.1f}" fill="#0F1414"></rect>')
    return (f'<svg viewBox="0 0 {size} {size}" width="{size}" height="{size}" role="img" aria-label="Pairing QR code (placeholder)">'
            f'<rect width="{size}" height="{size}" fill="#FFFFFF"></rect>' + "".join(rects) + '</svg>')


# ---------------------------------------------------------------- Login (desktop)
login_card = f"""      <div class="card" style="width: 520px; box-shadow: var(--shadow-lg);">
        <div class="card-head"><span>my.ence.do</span><span class="v">firmware 2.4.1 &middot; PPA</span></div>
        <div style="display: flex; flex-direction: column; gap: 24px; padding: 32px 32px 28px;">
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <p class="eyebrow">The module answered</p>
            <h1>Unlock the Manager.</h1>
            <p class="soft" style="font-size: 15.5px;">Your password never leaves this browser. It derives a key here; the module only sees a signed challenge.</p>
          </div>
          <div class="field">
            <label for="pw">Password</label>
            <input id="pw" type="password" placeholder="">
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 12px 14px; align-items: center;">
            <a class="button" href="#">Unlock</a>
            <a class="button plain" href="#">Ask my phone instead</a>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px; border-top: 1px solid #D5DCD9; padding-top: 18px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.7; color: #6A7773;">
            <span>2 phones paired &middot; broker reachable &middot; clock in sync</span>
            <span>Forgotten the password? The master passphrase from your Proof of Personalization also unlocks the module.</span>
          </div>
        </div>
      </div>"""

login_body = f"""  <div style="display: flex; flex: 1; align-items: center; justify-content: center; padding: 48px;">
    <div style="display: flex; flex-direction: column; gap: 28px; align-items: center;">
      <div style="display: flex; align-items: center; gap: 12px;">
        {MARK.format(s=40)}
        <div class="masthead" style="gap: 12px;"><span><b>Encedo HEM Manager</b> &nbsp;2.0.0-dev</span></div>
      </div>
{login_card}
    </div>
  </div>
"""

# ---------------------------------------------------------------- Login states (column)
def state_card(head, eyebrow, h, body, actions, foot):
    return f"""    <div class="card" style="width: 100%;">
      <div class="card-head"><span>{head[0]}</span><span class="v">{head[1]}</span></div>
      <div style="display: flex; flex-direction: column; gap: 16px; padding: 22px 24px 20px;">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <p class="eyebrow">{eyebrow}</p>
          <h2 style="font-size: 20px;">{h}</h2>
          <p class="soft">{body}</p>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 10px 12px; align-items: center;">{actions}</div>
        <p class="mono" style="font-size: 12px; color: #6A7773; line-height: 1.7;">{foot}</p>
      </div>
    </div>"""

states_body = f"""  <div style="display: flex; flex-direction: column; gap: 24px; padding: 32px;">
    <div style="display: flex; flex-direction: column; gap: 6px;">
      <p class="eyebrow">Sign-in states</p>
      <p class="soft">Three moments the login screen has to hold before the password form.</p>
    </div>
{state_card(("my.ence.do", "no answer yet"), "Waiting", "Looking for the module.",
            "The Manager asks the module for its version every two seconds. Plug the PPA in, or check that this browser is on its network.",
            '<a class="button plain" href="#">Change address</a>',
            "192.168.7.1 &middot; attempt 4 &middot; last error: no route to host")}
{state_card(("my.ence.do", "firmware 2.4.1"), "Air-gapped", "The module answered. The broker did not.",
            "Nothing that needs the Encedo backend will work in this session: phone sign-in, pairing, software downloads, domain changes. Everything on the module itself will.",
            '<a class="button" href="#">Continue with password</a>',
            "broker: api.encedo.com unreachable &middot; clock: not confirmed")}
{state_card(("my.ence.do", "phone request sent"), "Ask my phone", "Confirm on your phone.",
            "A request went to the two phones paired with this module. Approving it on either one signs you in here. It expires in 3 minutes.",
            '<a class="button plain" href="#">Use password instead</a><span class="mono" style="font-size: 12px; color: #6A7773;">2:41 left</span>',
            "event 8f1c&hellip; &middot; scope keymgmt:list &middot; cancelling withdraws it from both phones")}
  </div>
"""

# ---------------------------------------------------------------- Phone login (390 wide)
phone_body = f"""  <div style="display: flex; flex-direction: column; gap: 28px; padding: 64px 20px 32px;">
    <div style="display: flex; align-items: center; gap: 12px;">
      {MARK.format(s=36)}
      <div class="masthead" style="gap: 8px;"><span><b>Encedo HEM Manager</b></span></div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px;">
      <p class="eyebrow">The module answered</p>
      <h1 style="font-size: 28px;">Unlock the Manager.</h1>
      <p class="soft" style="font-size: 15px;">Your password never leaves this browser.</p>
    </div>
    <div class="field">
      <label for="pw2">Password</label>
      <input id="pw2" type="password" placeholder="">
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px;">
      <a class="button" href="#" style="width: 100%;">Unlock</a>
      <a class="button plain" href="#" style="width: 100%;">Ask my phone instead</a>
    </div>
    <div style="display: flex; flex-direction: column; gap: 4px; border-top: 1px solid #D5DCD9; padding-top: 16px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.7; color: #6A7773;">
      <span>my.ence.do &middot; firmware 2.4.1</span>
      <span>2 phones paired &middot; broker reachable</span>
    </div>
  </div>
"""

# ---------------------------------------------------------------- Overview (Main)
overview_inner = heading("Overview", "The module is sealed and reachable.",
                         "One drive is unlocked for the host. Firmware 2.5.0 is ready to install.") + f"""
      <div class="card">
        <dl class="status-grid">
          <div><dt>Module</dt><dd>PPA &middot; my.ence.do</dd></div>
          <div><dt>Firmware</dt><dd>2.4.1 <span class="muted">&middot; 2.5.0 available</span></dd></div>
          <div><dt>Broker</dt><dd>reachable &middot; clock in sync</dd></div>
          <div><dt>Secure drive</dt><dd class="risk">disk0 unlocked, read-write &middot; disk1 locked</dd></div>
          <div><dt>Paired phones</dt><dd>2</dd></div>
          <div><dt>Operation log</dt><dd>14 files &middot; last verified 09:41</dd></div>
        </dl>
        <p class="status-note">Sealed means inside the module: keys, locked drives, verified logs. Exposed means handed to the host, where anything running there can read it. This page uses no other colours for state.</p>
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px;">
        <div class="card">
          <div class="card-head"><span>Recent operations</span><span class="v">today</span></div>
          <table>
            <thead><tr><th>Time</th><th>Operation</th><th>By</th></tr></thead>
            <tbody>
              <tr><td class="mono">09:41</td><td>Unlocked disk0 read-write</td><td>Ann, password</td></tr>
              <tr><td class="mono">09:12</td><td>Signed with <span class="mono">wg-peer-03</span></td><td>encedo-wg</td></tr>
              <tr><td class="mono">08:58</td><td>Signed in</td><td>Ann, phone</td></tr>
              <tr><td class="mono">Yesterday</td><td>Verified log file 0x0e</td><td>Manager</td></tr>
            </tbody>
          </table>
        </div>
        <div class="card">
          <div class="card-head"><span>Needs you</span><span class="v">2</span></div>
          <div style="display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 18px 20px; border-bottom: 1px solid #D5DCD9;">
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <b style="font-weight: 600;">Firmware 2.5.0 is ready</b>
                <span class="soft" style="font-size: 14px;">Downloaded and verified. Installing reboots the module.</span>
              </div>
              <a class="button small" href="#">Install</a>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 18px 20px;">
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <b style="font-weight: 600;">disk0 has been unlocked for 3 hours</b>
                <span class="soft" style="font-size: 14px;">Lock it when the host is done with it.</span>
              </div>
              <a class="button small exposed" href="#">Lock</a>
            </div>
          </div>
        </div>
      </div>"""

# ---------------------------------------------------------------- Secure drive
def disk_card(name, kind, size, state):
    if state == "rw":
        pill = '<span class="pill exposed"><i></i>Unlocked &middot; read-write</span>'
        body = "The host can read and write this drive over USB. Anything running there can change it."
        actions = '<a class="button exposed" href="#">Lock</a>'
        head_v = "on the host"
    else:
        pill = '<span class="pill sealed"><i></i>Locked</span>'
        body = "Sealed inside the module. The host sees no drive until you unlock it."
        actions = '<a class="button" href="#">Unlock read-only</a><a class="button plain" href="#">Unlock read-write</a>'
        head_v = "sealed"
    return f"""        <div class="card">
          <div class="card-head"><span>{name}</span><span class="v">{head_v}</span></div>
          <div style="display: flex; flex-direction: column; gap: 18px; padding: 22px 24px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <h2>{kind}</h2>
                <span class="mono muted" style="font-size: 13px;">{size}</span>
              </div>
              {pill}
            </div>
            <p class="soft">{body}</p>
            <div style="display: flex; flex-wrap: wrap; gap: 12px;">{actions}</div>
          </div>
        </div>"""

drive_inner = heading("Secure drive", "One drive is on the host.",
                      "Unlocking hands a drive to the computer the module is plugged into, over USB. Read-only keeps the contents; read-write trusts that computer.") + f"""
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px;">
{disk_card("disk0", "Primary drive", "58.2 GB of 64 GB used &middot; exFAT", "rw")}
{disk_card("disk1", "Hidden drive", "8 GB &middot; not mounted since personalisation", "locked")}
      </div>
      <dl style="display: flex; flex-direction: column; max-width: 860px;">
        <div class="item"><dt>What unlocking costs</dt><dd>While a drive is unlocked, its contents are as safe as the host. Lock it before you walk away; the module locks both on reboot.</dd></div>
        <div class="item"><dt>Who can unlock</dt><dd>A token for <span class="mono">storage:disk0:rw</span> or <span class="mono">storage:disk1:rw</span>. Your password issues one; so does a paired phone.</dd></div>
      </dl>"""

# ---------------------------------------------------------------- Paired phones
phones_inner = heading("Paired phones", "Two phones can answer for you.",
                       "A paired phone approves sign-ins and key operations instead of the password. Each one is a key in the keychain and a subscriber at the broker; unpairing removes both.") + f"""
      <div style="display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 24px; align-items: start;">
        <div class="card">
          <div class="card-head"><span>Paired</span><span class="v">2 phones</span></div>
          <table>
            <thead><tr><th>Phone</th><th>Paired</th><th>Last used</th><th></th></tr></thead>
            <tbody>
              <tr><td><b style="font-weight: 600;">Ann's Pixel</b><br><span class="mono muted" style="font-size: 12px;">pid 3f9a&hellip;c21e</span></td><td>12 Jun 2026</td><td>today, 08:58</td><td style="text-align: right;"><a class="button small plain" href="#">Unpair</a></td></tr>
              <tr><td><b style="font-weight: 600;">Work iPhone</b><br><span class="mono muted" style="font-size: 12px;">pid 7b02&hellip;9d4f</span></td><td>3 Mar 2026</td><td>28 Aug 2026</td><td style="text-align: right;"><a class="button small plain" href="#">Unpair</a></td></tr>
            </tbody>
          </table>
          <p class="status-note">Phone sign-in is offered first while at least one phone is paired. The password always works.</p>
        </div>
        <div class="card" style="box-shadow: var(--shadow-lg);">
          <div class="card-head"><span>Pair a phone</span><span class="v">58 s left</span></div>
          <div style="display: flex; flex-direction: column; gap: 18px; padding: 22px 24px 24px; align-items: center;">
            <div style="padding: 12px; background: #FFFFFF; border: 1px solid #D5DCD9; border-radius: 5px;">{qr_svg(224)}</div>
            <div class="steps" style="width: 100%;">
              <div class="step"><span class="step-n">01</span><p><b>Install Encedo Mobile Authenticator</b> from Google Play or the App Store.</p></div>
              <div class="step"><span class="step-n">02</span><p><b>Scan this code</b> in the app. It carries a one-time link and a hash of the module's challenge.</p></div>
              <div class="step"><span class="step-n">03</span><p><b>Confirm on the phone.</b> The module checks the phone's reply before the pairing is kept.</p></div>
            </div>
            <a class="button plain" href="#" style="align-self: stretch;">Cancel</a>
          </div>
        </div>
      </div>"""

# ---------------------------------------------------------------- Keychain
keychain_inner = heading("Keychain", "Keys stay inside; the module answers for them.",
                         "Private keys are generated in the module and never exported. Apps ask the module to sign or agree a secret; you decide which of them may, and for how long.") + f"""
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
        <div class="field" style="width: 360px;">
          <label for="q">Search by description</label>
          <input id="q" type="text" placeholder="wg-peer">
        </div>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <a class="button" href="#">Create key pair</a>
          <a class="button plain" href="#">Import public key</a>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><span>Keys in the module</span><span class="v">6 of 6</span></div>
        <table>
          <thead><tr><th>Label</th><th>Type</th><th>Key id</th><th>Created</th><th>Where</th><th></th></tr></thead>
          <tbody>
            <tr><td><b style="font-weight: 600;">wg-peer-03</b><br><span class="soft" style="font-size: 13.5px;">WireGuard identity, laptop</span></td><td class="mono">CURVE25519</td><td class="mono">kid 8a41&hellip;</td><td>2 Feb 2026</td><td class="safe">Sealed</td><td style="text-align: right;"><a class="button small plain" href="#">Open</a></td></tr>
            <tr><td><b style="font-weight: 600;">git-signing</b><br><span class="soft" style="font-size: 13.5px;">Commits and tags</span></td><td class="mono">ED25519</td><td class="mono">kid c07d&hellip;</td><td>2 Feb 2026</td><td class="safe">Sealed</td><td style="text-align: right;"><a class="button small plain" href="#">Open</a></td></tr>
            <tr><td><b style="font-weight: 600;">backup-kem</b><br><span class="soft" style="font-size: 13.5px;">Post-quantum wrap for the backup set</span></td><td class="mono">ML-KEM-768</td><td class="mono">kid 5e2b&hellip;</td><td>19 May 2026</td><td class="safe">Sealed</td><td style="text-align: right;"><a class="button small plain" href="#">Open</a></td></tr>
            <tr><td><b style="font-weight: 600;">bob (imported)</b><br><span class="soft" style="font-size: 13.5px;">Public key from bob@example.com</span></td><td class="mono">ED25519</td><td class="mono">kid 11f0&hellip;</td><td>7 Jul 2026</td><td class="risk">Public only</td><td style="text-align: right;"><a class="button small plain" href="#">Open</a></td></tr>
            <tr><td><b style="font-weight: 600;">Ann's Pixel</b><br><span class="soft" style="font-size: 13.5px;">Paired phone</span></td><td class="mono">CURVE25519</td><td class="mono">kid 9c3a&hellip;</td><td>12 Jun 2026</td><td class="safe">Sealed</td><td style="text-align: right;"><a class="button small plain" href="#">Open</a></td></tr>
            <tr><td><b style="font-weight: 600;">Work iPhone</b><br><span class="soft" style="font-size: 13.5px;">Paired phone</span></td><td class="mono">CURVE25519</td><td class="mono">kid 2d77&hellip;</td><td>3 Mar 2026</td><td class="safe">Sealed</td><td style="text-align: right;"><a class="button small plain" href="#">Open</a></td></tr>
          </tbody>
        </table>
      </div>"""

# ---------------------------------------------------------------- Operation log
log_inner = heading("Operation log", "Every log file is verified before you read it.",
                    "The module signs each file's key line and seals every entry with it. The Manager checks the chain in your browser; a file that fails says where.") + f"""
      <div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 24px; align-items: start;">
        <div class="card">
          <div class="card-head"><span>Log files</span><span class="v">14</span></div>
          <table>
            <thead><tr><th>File</th><th>Entries</th><th>Integrity</th></tr></thead>
            <tbody>
              <tr><td class="mono">0x0e &middot; 1 Sep &ndash; today</td><td>412</td><td class="safe">Verified</td></tr>
              <tr><td class="mono">0x0d &middot; 12 &ndash; 31 Aug</td><td>1 006</td><td class="safe">Verified</td></tr>
              <tr><td class="mono">0x0c &middot; 3 &ndash; 12 Aug</td><td>988</td><td class="risk">Fails at entry 0x1a3 &middot; hmac</td></tr>
              <tr><td class="mono">0x0b &middot; 20 Jul &ndash; 3 Aug</td><td>1 010</td><td class="safe">Verified</td></tr>
              <tr><td class="mono">0x0a &middot; 4 &ndash; 20 Jul</td><td>1 002</td><td class="safe">Verified</td></tr>
            </tbody>
          </table>
          <p class="status-note">A failed file is still shown, marked as unverified from the failing entry on. Nothing is hidden and nothing is repaired.</p>
        </div>
        <div class="card" style="box-shadow: var(--shadow-lg);">
          <div class="card-head"><span>0x0e &middot; 412 entries</span><span class="v">verified 09:41</span></div>
          <div style="display: flex; flex-direction: column; padding: 16px 18px 20px; overflow-x: auto;">
            <div class="cline"># encedo audit log &middot; logger key 4b9e&hellip;</div>
            <div class="cline in">0001|1756710000|0|0|<span class="k">nonce</span> Rk9x&hellip;|<span class="k">signature</span> ok</div>
            <div class="cline">0002|1756710412|3|1|auth ok user &middot; scope keymgmt:list|hmac ok</div>
            <div class="cline">0003|1756710780|5|0|storage unlock disk0 rw|hmac ok</div>
            <div class="cline">0004|1756711201|4|2|exdsa sign kid 8a41&hellip;|hmac ok</div>
            <div class="cline">0005|1756712630|4|2|exdsa sign kid c07d&hellip;|hmac ok</div>
            <div class="cline">0006|1756713002|3|1|auth ok ext &middot; phone 3f9a&hellip;|hmac ok</div>
            <div class="cline muted">&hellip; 406 more entries</div>
          </div>
          <div style="display: flex; gap: 12px; padding: 0 18px 20px;">
            <a class="button plain small" href="#">Download file</a>
            <a class="button plain small" href="#">Export as PDF</a>
          </div>
        </div>
      </div>"""

# ---------------------------------------------------------------- Software
software_inner = heading("Software", "Firmware 2.5.0 is ready to install.",
                         "Updates come from the Encedo backend when the module checks in, signed for this module. Installing reboots it and locks both drives.") + f"""
      <div class="card">
        <dl class="status-grid">
          <div><dt>Firmware installed</dt><dd>2.4.1</dd></div>
          <div><dt>Firmware available</dt><dd>2.5.0 <span class="muted">&middot; published 28 Aug 2026</span></dd></div>
          <div><dt>Bootloader</dt><dd>1.3.0</dd></div>
          <div><dt>Manager installed</dt><dd>2.0.0-dev</dd></div>
          <div><dt>Manager available</dt><dd class="pending">none newer</dd></div>
          <div><dt>Last check-in</dt><dd>today, 08:57</dd></div>
        </dl>
      </div>
      <div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; align-items: start;">
        <div class="card">
          <div class="card-head"><span>Install firmware 2.5.0</span><span class="v">step 2 of 4</span></div>
          <div style="display: flex; flex-direction: column; gap: 22px; padding: 22px 24px 24px;">
            <div class="steps">
              <div class="step done"><span class="step-n">01</span><p><b>Downloaded</b> from the backend, 1.9 MB.</p></div>
              <div class="step"><span class="step-n">02</span><p><b>Uploading to the module</b> over the LAN.</p></div>
              <div class="step"><span class="step-n">03</span><p><b>Verify</b> the image on the module.</p></div>
              <div class="step"><span class="step-n">04</span><p><b>Install and reboot.</b> Both drives lock. About 40 seconds.</p></div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div class="bar"><span style="width: 62%;"></span></div>
              <div class="masthead" style="font-size: 12px;"><span>1.2 MB of 1.9 MB</span><span>62 %</span></div>
            </div>
            <div style="display: flex; gap: 12px;"><a class="button plain" href="#">Cancel upload</a></div>
          </div>
        </div>
        <dl style="display: flex; flex-direction: column;">
          <div class="item"><dt>What 2.5.0 changes</dt><dd>ML-DSA signatures, a faster storage unlock, and the audit log key line format described in the Operation log.</dd></div>
          <div class="item"><dt>What it costs you</dt><dd>A reboot. Sessions end, drives lock, and the module is unreachable for about 40 seconds. Nothing in the keychain changes.</dd></div>
          <div class="item"><dt>Without the backend</dt><dd>Upload a firmware file you obtained elsewhere. The module verifies its signature either way.</dd></div>
        </dl>
      </div>"""

# ---------------------------------------------------------------- write files
files = {
    "Login.dc.html": page(login_body, 1440, 900, "Sign in"),
    "SignInStates.dc.html": page(states_body, 560, 780, "Sign-in states"),
    "PhoneSignIn.dc.html": page(phone_body, 390, 844, "Sign in, phone"),
    "Main.dc.html": page(shell("home", overview_inner), 1440, 900, "Overview"),
    "SecureDrive.dc.html": page(shell("drive", drive_inner), 1440, 900, "Secure drive"),
    "PairedPhones.dc.html": page(shell("phones", phones_inner), 1440, 900, "Paired phones"),
    "Keychain.dc.html": page(shell("keychain", keychain_inner), 1440, 900, "Keychain"),
    "OperationLog.dc.html": page(shell("log", log_inner), 1440, 900, "Operation log"),
    "Software.dc.html": page(shell("software", software_inner), 1440, 900, "Software"),
}
for name, html in files.items():
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(html)

canvas = {
    "artboards": [
        {"file": "Login.dc.html", "x": 0, "y": 0, "w": 1440, "h": 900, "title": "Sign in"},
        {"file": "SignInStates.dc.html", "x": 1520, "y": 0, "w": 560, "h": 780, "title": "Sign-in states"},
        {"file": "PhoneSignIn.dc.html", "x": 2160, "y": 0, "w": 390, "h": 844, "title": "Sign in, phone"},
        {"file": "Main.dc.html", "x": 0, "y": 1040, "w": 1440, "h": 900, "title": "Overview"},
        {"file": "SecureDrive.dc.html", "x": 1520, "y": 1040, "w": 1440, "h": 900, "title": "Secure drive"},
        {"file": "PairedPhones.dc.html", "x": 3040, "y": 1040, "w": 1440, "h": 900, "title": "Paired phones"},
        {"file": "Keychain.dc.html", "x": 0, "y": 2080, "w": 1440, "h": 900, "title": "Keychain"},
        {"file": "OperationLog.dc.html", "x": 1520, "y": 2080, "w": 1440, "h": 900, "title": "Operation log"},
        {"file": "Software.dc.html", "x": 3040, "y": 2080, "w": 1440, "h": 900, "title": "Software"},
    ],
    "annotations": [
        {"id": "style", "x": 0, "y": -200, "w": 460,
         "text": "Style: encedo web kit (wg.encedo.com). System fonts, 5 px radii, mono for anything literal.\nThe palette carries one idea: sealed green = inside the module, exposed rust = handed to the host. No other colour means state."},
        {"id": "sample", "x": 520, "y": -200, "w": 420,
         "text": "Sample values. Names, versions, counts and log lines are examples for layout; every field maps to a hem-sdk-js call (see docs/SDK-MAPPING.md)."},
        {"id": "decision", "x": 1000, "y": -200, "w": 440,
         "text": "Open decision before Settings and Personalisation are drawn: keep the BIP39 master passphrase (Proof of Personalization PDF) or move to the SDK's two-password model."},
        {"id": "order", "x": 1520, "y": -200, "w": 420,
         "text": "Row 1 is the first milestone: sign-in against the personalised device. Row 2: overview and the simple operations (drive unlock, phones). Row 3: keychain, log, software."},
    ],
    "launch": {"view": "canvas"},
}
with open(os.path.join(OUT, "canvas.json"), "w", encoding="utf-8") as f:
    json.dump(canvas, f, indent=2)
print("wrote", len(files), "artboards + canvas.json to", OUT)
