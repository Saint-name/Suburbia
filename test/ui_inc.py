import time
from playwright.sync_api import sync_playwright

URL = 'file:///home/claude/suburbia/dist/index.html'
OUT = '/home/claude/shots'
errors = []

def my_turn(pg):
    return pg.evaluate("(()=>{const s=window.__suburbia.session.snapshot();const v=s.view;return v.phase==='play'&&v.players[v.current].id===s.myId})()")

def wait_my_turn(pg):
    try:
        pg.wait_for_function("(()=>{const s=window.__suburbia.session.snapshot();const v=s.view;return v.phase!=='play'||v.players[v.current].id===s.myId})()", timeout=60000)
    except Exception:
        print('STUCK', errors[-3:], pg.evaluate("(()=>{const s=window.__suburbia.session; const v=s.state; return {cur:v.current, bot:v.players[v.current].bot, phase:v.phase, turn:v.turn, thinking:s.botThinking}})()"))
        raise
    return my_turn(pg)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1440, 'height': 960})
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL)
    pg.fill('#name-input', '지훈')
    pg.click('[data-act=host-offline]')
    import sys as _s
    ALL = len(_s.argv) > 1 and _s.argv[1] == 'all'
    if ALL:
        for e in ['inc', 'five', 'night', 'promo']:
            pg.click(f'[data-act=toggle-exp][data-exp={e}]')
        for lv in ['easy', 'normal', 'hard', 'normal']:
            pg.click(f'[data-act=add-bot][data-level={lv}]')
    else:
        pg.click('[data-act=toggle-exp][data-exp=inc]')
        pg.click('[data-act=add-bot][data-level=normal]')
        pg.click('[data-act=add-bot][data-level=hard]')
    pg.screenshot(path=f'{OUT}/50_lobby_inc.png')
    assert pg.evaluate('window.__suburbia.session.snapshot().lobby.expansions.inc') is True
    if ALL: assert pg.evaluate('window.__suburbia.session.snapshot().lobby.seats.length') == 5
    pg.click('[data-act=start]')
    pg.click('.goal-opt >> nth=0')
    pg.evaluate('window.__suburbia.session.botDelay = 40')

    # 1) border
    wait_my_turn(pg)
    pg.evaluate("(()=>{const s=window.__suburbia.session; const me=s.state.players.find(p=>p.id===s.myId); me.money=60; s.changed();})()")
    pg.click('.bcard >> nth=0')
    pg.click('[data-act=border-mode][data-lake="0"]')
    pg.click('.slot >> nth=0')
    if pg.query_selector('[data-act=rotate]'):
        pg.click('[data-act=rotate]')
    pg.click('.cards .card[data-slot="6"] [data-act=discard]')
    pg.screenshot(path=f'{OUT}/51_border_preview.png')
    pg.click('[data-act=confirm]')
    snap = pg.evaluate('window.__suburbia.session.snapshot()')
    mine = [x for x in snap['view']['players'] if x['id'] == snap['myId']][0]
    assert len(mine['borders']) == 1, 'border not placed'
    print('border placed:', mine['borders'][0]['id'], mine['borders'][0]['cells'])

    # 2) planner then redevelop
    wait_my_turn(pg)
    pg.evaluate("(()=>{const s=window.__suburbia.session; s.state.market[6]='planner'; const me=s.state.players.find(p=>p.id===s.myId); me.money=Math.max(me.money,40); s.changed();})()")
    pg.click('.cards .card[data-slot="6"]')
    pg.click('.slot >> nth=0')
    pg.click('[data-act=confirm]')
    wait_my_turn(pg)
    pg.click('[data-act=pick-redevelop]')
    pg.click('.cards .card[data-slot="6"]')
    pg.screenshot(path=f'{OUT}/52_redevelop.png')
    pg.click('[data-act=confirm]')
    snap = pg.evaluate('window.__suburbia.session.snapshot()')
    mine = [x for x in snap['view']['players'] if x['id'] == snap['myId']][0]
    assert not any(t['id'] == 'planner' for t in mine['tiles'].values()), 'planner not replaced'
    print('redeveloped ok')

    # 3) play out the game
    turns = 0
    while True:
        if not wait_my_turn(pg):
            break
        pg.click('.cards .card[data-slot="6"]')
        if not pg.query_selector('[data-act=mode].primary'):
            pg.click('[data-act=mode][data-mode=lake]')
        pg.click('.slot >> nth=0')
        btn = pg.query_selector('[data-act=confirm]')
        if not btn:  # e.g. requirement not met for this tile → make a lake instead
            pg.click('[data-act=mode][data-mode=lake]')
            pg.click('.slot >> nth=0')
        pg.click('[data-act=confirm]')
        turns += 1
        print('turn', turns, flush=True)
        if turns == 6:
            pg.screenshot(path=f'{OUT}/53_midgame{"_all" if ALL else ""}.png')
    pg.wait_for_selector('table.final', timeout=60000)
    pg.screenshot(path=f'{OUT}/54_final.png')
    log = pg.evaluate("window.__suburbia.session.snapshot().view.log.map(e=>e.text).filter(t=>/보너스|챌린지/.test(t))")
    print('bonus/challenge log:', log)
    b.close()
print('errors:', errors)
