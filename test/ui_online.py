import sys, time
from playwright.sync_api import sync_playwright

URL = 'http://localhost:8080/?peer=localhost:9000'
out = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/shots'
log = []

def snap(pg):
    return pg.evaluate('window.__suburbia.session && window.__suburbia.session.snapshot()')

def my_turn(pg):
    s = snap(pg)
    v = s and s['view']
    if not v or v['phase'] != 'play':
        return False
    return v['players'][v['current']]['id'] == s['myId']

def take_turn(pg, k):
    # buy rightmost affordable card if possible, otherwise lake
    pg.click('.cards .card[data-slot="6"]')
    if not pg.query_selector('[data-act=mode].primary'):
        pg.click('[data-act=mode][data-mode=lake]')
    pg.click('.slot >> nth=0')
    pg.click('[data-act=confirm]')

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    hc = b.new_context(viewport={'width': 1366, 'height': 860})
    cc = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    host = hc.new_page(); cli = cc.new_page()
    for name, pg in (('host', host), ('client', cli)):
        pg.on('pageerror', lambda e, n=name: log.append(f'{n} pageerror {e}'))
    host.goto(URL)
    host.fill('#name-input', '방장')
    host.click('[data-act=host-online]')
    host.wait_for_function("window.__suburbia.session.snapshot().netStatus === 'online'", timeout=15000)
    code = snap(host)['code']
    print('room', code)
    cli.goto(URL)
    cli.fill('#name-input', '친구')
    cli.fill('#code-input', code)
    cli.click('[data-act=join]')
    host.wait_for_function("window.__suburbia.session.snapshot().lobby.seats.length === 2", timeout=60000)
    host.click('[data-act=add-bot][data-level=normal]')
    cli.wait_for_function("(window.__suburbia.session.snapshot().lobby||{seats:[]}).seats.length === 3", timeout=10000)
    cli.fill('#chat-input', '안녕!')
    cli.press('#chat-input', 'Enter')
    host.wait_for_function("(window.__suburbia.session.snapshot().lobby.chat||[]).length === 1", timeout=10000)
    host.screenshot(path=f'{out}/10_host_lobby.png')
    cli.screenshot(path=f'{out}/11_client_lobby.png')
    host.click('[data-act=start]')
    host.evaluate('window.__suburbia.session.botDelay = 100')
    for pg in (host, cli):
        pg.wait_for_selector('.goal-opt', timeout=10000)
        pg.click('.goal-opt >> nth=0')
    turns = {'host': 0, 'client': 0}
    t0 = time.time()
    reconnected = False
    while time.time() - t0 < 240:
        s = snap(host)
        if s['view']['phase'] == 'over':
            break
        if my_turn(host):
            take_turn(host, turns['host']); turns['host'] += 1
        elif my_turn(cli):
            if turns['client'] == 1:
                cli.screenshot(path=f'{out}/12_client_turn.png')
            take_turn(cli, turns['client']); turns['client'] += 1
            if turns['client'] == 3 and not reconnected:
                # simulate the friend closing the app and rejoining
                cli.close()
                host.wait_for_function("window.__suburbia.session.snapshot().lobby.seats.some(s => s.connected === false)", timeout=30000)
                host.screenshot(path=f'{out}/13_host_disconnected.png')
                cli = cc.new_page()
                cli.goto(URL)
                cli.fill('#name-input', '친구')
                cli.fill('#code-input', code)
                cli.click('[data-act=join]')
                cli.wait_for_function("window.__suburbia.session.snapshot().view !== null", timeout=60000)
                reconnected = True
                print('client rejoined')
        time.sleep(0.15)
    s = snap(host)
    print('phase', s['view']['phase'], 'turns', turns)
    cli.wait_for_function("window.__suburbia.session.snapshot().view.phase === 'over'", timeout=20000)
    cli.screenshot(path=f'{out}/14_client_final.png')
    hv = snap(host)['view']; cv = snap(cli)['view']
    assert [p['pop'] for p in hv['players']] == [p['pop'] for p in cv['players']], 'state mismatch'
    print('final pops', [(p['name'], p['pop']) for p in hv['players']])
    b.close()
print('errors', log)
