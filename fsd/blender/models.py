# Per-vehicle specs for carlib.body(). t = metres from the front bumper; z = height; hw = half width.
import carlib as C

def base_mats():
    C.mat('paint', (0.86, 0.87, 0.88), 0.3); C.mat('glass', (0.012, 0.013, 0.016), 0.12, 0.2); C.mat('trim', (0.03, 0.03, 0.035), 0.6)
    C.mat('tail', (0.7, 0.02, 0.02), 0.4); C.mat('lamp', (0.05, 0.055, 0.06), 0.15, 0.3); C.mat('drl', (1, 1, 1), 0.3); C.mat('tyre', (0.02, 0.02, 0.022), 0.9)
    C.mat('rim', (0.16, 0.165, 0.175), 0.35, 0.6); C.mat('spoke', (0.3, 0.31, 0.33), 0.35, 0.6)
MI = {'paint': 0, 'glass': 1, 'trim': 2, 'tail': 3, 'lamp': 4}
MLIST = ['paint', 'glass', 'trim', 'tail', 'lamp']

def sedan_like(name, L, top, bot, belt, hw, rw, g0, g1, wheels, r, tw, level=2, tail_t=None, head_t=-1, glass_roof=True, n=22):
    tail_t = tail_t or L - 0.18
    def matfn(t, seg, left):
        if seg == -1: return MI['paint']
        if seg == 0: return MI['trim']
        if seg >= 4 and g0 < t < g1: return MI['glass'] if (glass_roof or seg < 6) else MI['paint']
        if seg == 3 and t > tail_t: return MI['tail']
        if seg == 3 and t < head_t: return MI['lamp']
        return MI['paint']
    S = dict(L=L, top=top, bot=bot, belt=belt, hw=hw, rw=rw, matfn=matfn, mats=MLIST, n=n, tb=[x for x in (g0, g1, tail_t, head_t) if 0 < x < L])
    ob = C.body(S, name, level)
    hwm = max(v for _, v in hw)
    zt = C.interp(belt, L - .12) - .02; xt = C.interp(hw, L - .12) * .62
    for sd in (-1, 1):  # rear lamp strips wrapping toward the corners
        C.lamp('taillamp', 'tail', (sd * xt, -(L - .1 - L / 2), zt), (.42, .1, .06), (0, 0, sd * 0.28))
    C.arches(ob, [(t, L) for t in wheels], r)
    for t in wheels:
        C.well(t, L, r, hwm)
        for sd in (-1, 1): C.wheel(t, L, r, tw, sd * (hwm - tw / 2 - 0.02), name='wheel')
    return ob

def mirrors(L, t, z, x):
    for sd in (-1, 1):
        o = C.lamp('mirror', 'paint', (sd * x, -(t - L / 2), z), (0.2, 0.09, 0.1), (0, 0, sd * 0.25))
        o.modifiers['b'].width = 0.04; o.modifiers['b'].segments = 3

def m3(level=2):
    L = 4.72
    ob = sedan_like('m3', L,
        top=[(0, .66), (.08, .75), (.3, .82), (.8, .88), (1.28, .95), (1.6, 1.25), (1.95, 1.46), (2.3, 1.53), (2.9, 1.53), (3.4, 1.43), (3.9, 1.17), (4.25, 1.05), (4.6, 1.0), (4.72, .88)],
        bot=[(0, .24), (.35, .14), (4.3, .14), (4.72, .32)],
        belt=[(0, .6), (.3, .73), (1.0, .82), (1.35, .89), (2.5, .93), (3.9, .97), (4.5, .95), (4.72, .84)],
        hw=[(0, .64), (.25, .86), (.8, .93), (2.4, .94), (4.0, .93), (4.5, .89), (4.72, .76)],
        rw=[(0, .9), (1.4, .88), (1.8, .8), (2.5, .78), (3.5, .78), (4.0, .86), (4.72, .9)],
        g0=1.32, g1=3.92, wheels=[.88, 3.755], r=.34, tw=.235, level=level)
    mirrors(L, 1.45, .96, .92)
    for sd in (-1, 1):  # slim corner headlamps: dark lens + DRL strip, swept up toward the fenders
        C.lamp('lamp', 'lamp', (sd * .56, -(0.2 - L / 2), .74), (.34, .1, .045), (0.2, 0, -sd * 0.3))
        C.lamp('drl', 'drl', (sd * .57, -(0.16 - L / 2), .765), (.28, .03, .012), (0.2, 0, -sd * 0.3))

def lamps(L, x, t, z, sweep=0.3, w=.34):
    for sd in (-1, 1):
        C.lamp('lamp', 'lamp', (sd * x, -(t - L / 2), z), (w, .1, .045), (0.2, 0, -sd * sweep))
        C.lamp('drl', 'drl', (sd * (x + .01), -(t - .04 - L / 2), z + .025), (w * .82, .03, .012), (0.2, 0, -sd * sweep))

def my(level=2):  # Model Y: crossover fastback
    L = 4.75
    sedan_like('my', L,
        top=[(0, .74), (.08, .84), (.3, .9), (.8, .97), (1.25, 1.04), (1.6, 1.36), (1.95, 1.58), (2.3, 1.64), (3.0, 1.63), (3.6, 1.5), (4.15, 1.24), (4.5, 1.16), (4.68, 1.1), (4.75, .96)],
        bot=[(0, .28), (.35, .18), (4.3, .18), (4.75, .36)],
        belt=[(0, .68), (.3, .82), (1.0, .92), (1.35, 1.0), (2.5, 1.04), (3.9, 1.08), (4.5, 1.06), (4.75, .94)],
        hw=[(0, .68), (.25, .9), (.8, .96), (2.4, .965), (4.0, .955), (4.5, .92), (4.75, .8)],
        rw=[(0, .9), (1.4, .88), (1.8, .8), (2.5, .79), (3.6, .79), (4.1, .86), (4.75, .9)],
        g0=1.3, g1=4.12, wheels=[.9, 3.79], r=.37, tw=.25, level=level)
    mirrors(L, 1.45, 1.06, .97); lamps(L, .6, .2, .84)

def ms(level=2):  # Model S: longer, lower liftback
    L = 4.98
    sedan_like('ms', L,
        top=[(0, .62), (.08, .72), (.3, .8), (.8, .88), (1.4, .96), (1.75, 1.24), (2.1, 1.43), (2.5, 1.48), (3.0, 1.46), (3.55, 1.3), (4.15, 1.06), (4.6, 1.02), (4.88, .98), (4.98, .86)],
        bot=[(0, .24), (.35, .14), (4.6, .14), (4.98, .32)],
        belt=[(0, .58), (.3, .72), (1.0, .82), (1.45, .89), (2.5, .93), (4.1, .97), (4.7, .95), (4.98, .84)],
        hw=[(0, .66), (.25, .9), (.8, .97), (2.4, .98), (4.2, .97), (4.7, .92), (4.98, .78)],
        rw=[(0, .9), (1.5, .88), (1.9, .8), (2.6, .78), (3.6, .78), (4.2, .86), (4.98, .9)],
        g0=1.44, g1=4.12, wheels=[.94, 3.9], r=.35, tw=.245, level=level)
    mirrors(L, 1.6, .96, .97); lamps(L, .62, .2, .76)

def mx(level=2):  # Model X: tall crossover, long canopy
    L = 5.05
    sedan_like('mx', L,
        top=[(0, .76), (.08, .86), (.3, .93), (.8, 1.0), (1.15, 1.06), (1.55, 1.42), (2.0, 1.64), (2.5, 1.69), (3.3, 1.66), (3.9, 1.52), (4.45, 1.24), (4.8, 1.17), (4.98, 1.1), (5.05, .98)],
        bot=[(0, .3), (.35, .2), (4.6, .2), (5.05, .38)],
        belt=[(0, .7), (.3, .84), (1.0, .95), (1.25, 1.02), (2.5, 1.06), (4.2, 1.1), (4.8, 1.08), (5.05, .96)],
        hw=[(0, .7), (.25, .92), (.8, .99), (2.4, 1.0), (4.2, .99), (4.8, .94), (5.05, .82)],
        rw=[(0, .9), (1.3, .9), (1.7, .82), (2.6, .8), (3.9, .8), (4.4, .87), (5.05, .9)],
        g0=1.2, g1=4.42, wheels=[.98, 3.94], r=.39, tw=.26, level=level)
    mirrors(L, 1.35, 1.08, 1.0); lamps(L, .62, .2, .86)

def rs(level=2):  # Roadster (2nd gen): low, wide, long nose, glass targa
    L = 4.2
    sedan_like('rs', L,
        top=[(0, .5), (.08, .58), (.3, .64), (.9, .72), (1.45, .82), (1.75, 1.0), (2.05, 1.12), (2.45, 1.14), (2.9, 1.06), (3.4, .9), (3.9, .86), (4.12, .8), (4.2, .7)],
        bot=[(0, .2), (.35, .12), (3.9, .12), (4.2, .3)],
        belt=[(0, .46), (.3, .58), (1.0, .7), (1.45, .78), (2.4, .8), (3.4, .84), (3.9, .82), (4.2, .68)],
        hw=[(0, .7), (.25, .9), (.8, .98), (2.0, .96), (3.2, 1.01), (3.8, .98), (4.2, .82)],
        rw=[(0, .9), (1.4, .86), (1.8, .72), (2.4, .68), (3.0, .7), (3.6, .86), (4.2, .9)],
        g0=1.5, g1=3.25, wheels=[.86, 3.3], r=.35, tw=.27, level=level)
    lamps(L, .6, .22, .6, 0.45, .3)

# ---------- traffic (mono-grey FSD visualization style) ----------
def tsedan(level=1):  # generic notchback sedan
    L = 4.8
    sedan_like('sedan', L,
        top=[(0, .66), (.1, .76), (.4, .82), (1.0, .88), (1.45, .95), (1.8, 1.22), (2.15, 1.42), (2.55, 1.45), (3.0, 1.42), (3.45, 1.2), (3.75, 1.07), (4.4, 1.05), (4.7, 1.0), (4.8, .88)],
        bot=[(0, .3), (.35, .18), (4.4, .18), (4.8, .34)],
        belt=[(0, .62), (.3, .76), (1.0, .84), (1.45, .9), (2.5, .93), (3.7, .99), (4.5, .97), (4.8, .86)],
        hw=[(0, .7), (.25, .88), (.8, .93), (2.4, .935), (4.0, .93), (4.5, .9), (4.8, .78)],
        rw=[(0, .9), (1.4, .88), (1.8, .78), (2.5, .76), (3.3, .78), (3.8, .9), (4.8, .9)],
        g0=1.48, g1=3.6, wheels=[.95, 3.8], r=.34, tw=.23, level=level, glass_roof=False, n=20)
    mirrors(L, 1.6, .98, .95)

def suv(level=1):
    L = 4.9
    sedan_like('suv', L,
        top=[(0, .86), (.1, .96), (.4, 1.02), (1.0, 1.08), (1.3, 1.12), (1.65, 1.5), (2.0, 1.72), (2.5, 1.76), (4.1, 1.74), (4.55, 1.68), (4.8, 1.5), (4.9, 1.2)],
        bot=[(0, .36), (.35, .24), (4.5, .24), (4.9, .4)],
        belt=[(0, .8), (.3, .94), (1.0, 1.04), (1.35, 1.1), (2.5, 1.13), (4.2, 1.16), (4.8, 1.12), (4.9, 1.04)],
        hw=[(0, .78), (.25, .93), (.8, .98), (2.4, .985), (4.3, .98), (4.75, .95), (4.9, .86)],
        rw=[(0, .92), (1.4, .9), (1.8, .86), (2.5, .85), (4.3, .86), (4.8, .9), (4.9, .92)],
        g0=1.36, g1=4.75, wheels=[.98, 3.88], r=.39, tw=.26, level=level, glass_roof=False, n=20)
    mirrors(L, 1.5, 1.15, 1.02)

def cop(level=1):
    suv(level)
    C.lamp('barbase', 'trim', (0, -(2.05 - 2.45), 1.8), (1.25, .3, .06))

def pickup(level=1):
    L = 5.9
    ob = sedan_like('pickup', L,
        top=[(0, .96), (.1, 1.06), (.4, 1.12), (1.35, 1.2), (1.6, 1.24), (1.95, 1.7), (2.3, 1.88), (3.15, 1.88), (3.3, 1.84), (3.38, 1.32), (5.75, 1.3), (5.9, 1.18)],
        bot=[(0, .44), (.35, .34), (5.5, .36), (5.9, .5)],
        belt=[(0, .9), (.3, 1.06), (1.0, 1.14), (1.6, 1.2), (3.3, 1.24), (5.8, 1.26), (5.9, 1.12)],
        hw=[(0, .86), (.3, .97), (.8, 1.0), (5.6, 1.0), (5.9, .94)],
        rw=[(0, .95), (1.5, .94), (2.0, .86), (3.2, .86), (3.4, .97), (5.9, .97)],
        g0=1.62, g1=3.3, wheels=[1.0, 4.65], r=.42, tw=.28, level=level, glass_roof=False, n=24)
    C.lamp('bed', 'trim', (0, -(4.6 - L / 2), 1.28), (1.78, 2.35, .06))
    mirrors(L, 1.75, 1.32, 1.08)

def van(level=1):  # high-roof delivery van
    L = 5.4
    sedan_like('van', L,
        top=[(0, .96), (.1, 1.08), (.45, 1.2), (.72, 1.26), (1.45, 2.08), (1.75, 2.2), (5.25, 2.2), (5.4, 2.08)],
        bot=[(0, .44), (.4, .32), (5.1, .32), (5.4, .46)],
        belt=[(0, .9), (.6, 1.15), (1.0, 1.24), (5.4, 1.28)],
        hw=[(0, .84), (.5, .97), (1.2, 1.01), (5.4, 1.01)],
        rw=[(0, .9), (1.2, .92), (1.6, .95), (5.4, .96)],
        g0=.74, g1=2.3, wheels=[.92, 4.45], r=.37, tw=.26, level=level, glass_roof=False, n=22)
    mirrors(L, .95, 1.4, 1.08)

def boxbody(name, L, H, bot, hw, z0=0.0, level=1):
    def matfn(t, seg, left): return MI['trim'] if seg == 0 else MI['paint']
    S = dict(L=L, top=[(0, H), (L, H)], bot=[(0, bot), (L, bot)], belt=[(0, H * .55 + bot * .45), (L, H * .55 + bot * .45)], hw=[(0, hw), (L, hw)], rw=[(0, .985), (L, .985)],
             matfn=matfn, mats=MLIST, n=6, endE=1.0, endcrease=.85, crease={1: .85, 2: .85, 3: .85, 4: .85, 5: .85, 6: .85})
    return C.body(S, name, level)

def cab(name, L, H, hood, wsb, wst, hw, bot, level=1, glass_to=None):
    # truck cab: short hood, steep screen; glass on the upper part (side windows + windscreen)
    gt = glass_to or L - .1
    def matfn(t, seg, left):
        if seg == 0: return MI['trim']
        if seg >= 4 and wsb - .02 < t < gt: return MI['glass'] if seg < 6 or t < wst + .1 else MI['paint']
        return MI['paint']
    S = dict(L=L, top=[(0, hood - .12), (.12, hood), (wsb, hood + .06), (wst, H - .05), (wst + .25, H), (L, H)], bot=[(0, bot), (L, bot)],
             belt=[(0, hood - .2), (wsb * .8, hood - .02), (L, hood + .04)], hw=[(0, hw * .92), (.4, hw), (L, hw)], rw=[(0, .95), (wsb, .93), (wst, .9), (L, .92)],
             matfn=matfn, mats=MLIST, n=14, tb=[wsb, wst + .1, gt], crease={3: .5, 4: .5})
    return C.body(S, name, level)

def box(level=1):
    L = 7.6; h = L / 2
    c = cab('cab', 2.2, 2.78, 1.62, .8, 1.4, 1.16, .55, level); c.location.y = -(1.1 - h)
    b = boxbody('box', L - 2.25, 3.45, .95, 1.22, level=level); b.location.y = -((2.25 + (L - 2.25) / 2) - h)
    C.lamp('chassis', 'trim', (0, 0, .78), (1.5, L - .6, .3))
    for t in (.9, 6.5):
        for sd in (-1, 1): C.wheel(t, L, .46, .32, sd * (1.15 - .2), name='wheel')

def semi(level=1):
    L = 17.4; h = L / 2
    c = cab('cab', 3.6, 3.95, 2.05, 1.45, 1.95, 1.27, .62, level, glass_to=2.45); c.location.y = -(1.8 - h)
    C.lamp('fairing', 'paint', (0, -(3.0 - h), 3.75), (2.4, 1.1, .6))
    t = boxbody('trailer', L - 3.9, 4.1, 1.12, 1.29, level=level); t.location.y = -((3.9 + (L - 3.9) / 2) - h)
    C.lamp('chassis', 'trim', (0, -(7.5 - h), .85), (1.6, 12, .35))
    for tw in (.8, 3.5, 4.4, 14.7, 15.9):
        for sd in (-1, 1): C.wheel(tw, L, .5, .4, sd * (1.25 - .25), name='wheel')

def bus(level=1):
    L = 12.2
    def matfn(t, seg, left):
        if seg == 0: return MI['trim']
        if seg in (4, 5) and 1.4 < t < L - .3 and ((t - 1.4) % 1.2) > .12: return MI['glass']
        if seg in (4, 5) and .2 < t < 1.4 and not (.95 < t < 1.4 and seg == 4): return MI['glass']
        if seg >= 4 and t < .35: return MI['glass']
        return MI['paint']
    S = dict(L=L, top=[(0, 2.9), (.3, 3.15), (.8, 3.2), (L - .3, 3.2), (L, 3.05)], bot=[(0, .5), (L, .5)], belt=[(0, 1.2), (.6, 1.5), (L, 1.55)],
             hw=[(0, 1.2), (.4, 1.275), (L, 1.275)], rw=[(0, .96), (L, .96)], matfn=matfn, mats=MLIST, n=26, endE=0.94, endcrease=.6, tb=[.2, .35, .95, 1.4, L - .3] + [1.4 + k * 1.2 + d for k in range(10) for d in (0, .12) if 1.4 + k * 1.2 + d < L - .3], crease={1: .8, 2: .7, 3: .7, 4: .6, 5: .8, 6: .8})
    ob = C.body(S, 'bus', level); C.arches(ob, [(2.6, L), (9.7, L)], .5)
    for t in (2.6, 9.7):
        C.well(t, L, .5, 1.275)
        for sd in (-1, 1): C.wheel(t, L, .5, .32, sd * (1.275 - .2), name='wheel')

def school(level=1):
    L = 11.4; h = L / 2; nose = 1.75
    def nfn(t, seg, left): return MI['trim'] if seg <= 1 or t < .12 else MI['paint']
    S = dict(L=nose + .2, top=[(0, 1.42), (.12, 1.62), (.5, 1.72), (nose + .2, 1.8)], bot=[(0, .6), (nose + .2, .6)], belt=[(0, 1.25), (nose + .2, 1.3)],
             hw=[(0, 1.05), (.3, 1.13), (nose + .2, 1.16)], rw=[(0, .9), (nose + .2, .92)], matfn=nfn, mats=MLIST, n=10, endcrease=.5, crease={1: .6, 3: .6, 5: .6})
    n = C.body(S, 'hood', level); n.location.y = -((nose + .2) / 2 - h)
    bL = L - nose
    def bfn(t, seg, left):
        if seg == 0: return MI['trim']
        if seg == 4 and .9 < t < bL - .5 and ((t - .9) % .82) > .14: return MI['glass']
        if seg == 4 and .3 < t < .9: return MI['glass']
        if seg in (4, 5) and t < .2: return MI['glass']
        if seg >= 4 and t < .2: return MI['glass']
        return MI['paint']
    S2 = dict(L=bL, top=[(0, 2.95), (.15, 3.08), (bL, 3.1)], bot=[(0, .55), (bL, .55)], belt=[(0, 1.62), (bL, 1.62)], hw=[(0, 1.22), (bL, 1.225)], rw=[(0, .95), (bL, .95)],
              matfn=bfn, mats=MLIST, n=24, endE=0.98, endcrease=.8, tb=[.2, .3, .9, bL - .5] + [.9 + k * .82 + d for k in range(12) for d in (0, .14) if .9 + k * .82 + d < bL - .5], crease={1: .85, 2: .8, 3: .8, 4: .8, 5: .85, 6: .85})
    b = C.body(S2, 'body', level); C.arches(b, [(9.0 - nose, bL)], .5); b.location.y = -((nose + bL / 2) - h)
    C.well(9.0, L, .5, 1.22)
    for t in (1.2, 9.0):
        for sd in (-1, 1): C.wheel(t, L, .5, .32, sd * (1.2 - .2), name='wheel')
    for z in (.95, 1.3):  # black rub rails
        for sd in (-1, 1): C.lamp('rail', 'trim', (sd * 1.225, -((nose + bL / 2) - h), z), (.03, bL - .3, .06))
    C.lamp('grille', 'trim', (0, -(.04 - h), 1.05), (1.3, .06, .6))
    C.lamp('bumper', 'trim', (0, -(-.05 - h), .62), (2.3, .16, .2))
