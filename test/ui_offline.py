import sys, time
from playwright.sync_api import sync_playwright

URL = 'file:///home/claude/suburbia/dist/index.html'
out = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/shots'
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append('console:' + m.text) if m.type == 'error' else None)
    pg.goto(URL)
    pg.screenshot(path=f'{out}/01_home.png')
    pg.fill('#name-input', '지훈')
    pg.click('[data-act=host-offline]')
    pg.click('[data-act=add-bot][data-level=easy]')
    pg.click('[data-act=add-bot][data-level=hard]')
    pg.screenshot(path=f'{out}/02_lobby.png')
    pg.click('[data-act=start]')
    pg.wait_for_selector('.goal-opt')
    pg.screenshot(path=f'{out}/03_goal.png')
    pg.click('.goal-opt >> nth=0')
    pg.evaluate('window.__suburbia.session.botDelay = 50')
    played = 0
    for step in range(200):
        snap = pg.evaluate('window.__suburbia.session.snapshot()')
        v = snap['view']
        if v['phase'] == 'over':
            break
        me = [i for i, pl in enumerate(v['players']) if pl['id'] == snap['myId']][0]
        if v['current'] != me:
            time.sleep(0.1)
            continue
        # my turn: try affordable market card from the right, else lake
        money = v['players'][me]['money']
        cards = pg.query_selector_all('.cards .card[data-slot]')
        pg.click(f'.cards .card[data-slot="{6 if played % 3 else 5}"]')
        if played % 4 == 3:
            pg.click('[data-act=mode][data-mode=lake]')
        btn = pg.query_selector('[data-act=mode][data-mode=build].primary') or pg.query_selector('[data-act=mode][data-mode=lake].primary')
        if not btn:
            pg.click('[data-act=mode][data-mode=lake]')
        pg.click('.slot >> nth=0')
        if played == 2:
            pg.screenshot(path=f'{out}/04_preview.png')
        pg.click('[data-act=confirm]')
        played += 1
        if played == 1:
            # basic tile + discard next time
            pass
        time.sleep(0.05)
    pg.wait_for_selector('table.final', timeout=60000)
    pg.screenshot(path=f'{out}/05_final.png')
    pg.click('[data-act=close-modal]')
    pg.screenshot(path=f'{out}/06_board_end.png', full_page=True)
    m = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    m.goto(URL)
    m.screenshot(path=f'{out}/07_mobile_home.png')
    b.close()
print('turns played by human:', played)
print('errors:', errors[:10])
