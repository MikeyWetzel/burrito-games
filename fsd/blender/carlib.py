# FSD Mad Max vehicle generator (Blender 4.2, headless). Our own geometry: subdivision-surface cages
# built from side/plan profiles, smooth shaded, exported as glTF. Run: blender -b -P build.py -- out_dir
import bpy, bmesh, math
from mathutils import Vector

def interp(keys, t):
    if t <= keys[0][0]: return keys[0][1]
    for (a, va), (b, vb) in zip(keys, keys[1:]):
        if t <= b:
            u = (t - a) / max(b - a, 1e-6); u = u * u * (3 - 2 * u)  # smoothstep between keys
            return va + (vb - va) * u
    return keys[-1][1]

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

MATS = {}
def mat(name, rgb, rough=0.5, metal=0.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    MATS[name] = m; return m

def body(S, name='body', level=2):
    """S: dict of profile key lists over t in [0, L] (t=0 front):
    top, bot, belt, hw (half width at shoulder), rw (roof half-width / hw), sh (shoulder height above belt fraction)
    glass: function(t, seg) -> material name or None; seg = ring segment index (0 bottom .. 6 roof centre)"""
    L = S['L']; n = S.get('n', 22)
    ts = [L * (0.5 * (0.5 - 0.5 * math.cos(math.pi * i / (n - 1))) + 0.5 * i / (n - 1)) for i in range(n)]  # half cosine, half uniform
    for k in S.get('tb', []):  # extra stations at material boundaries
        ts.append(k)
    ts = sorted(set(round(t, 4) for t in ts))
    bm = bmesh.new(); rings = []
    for i, t in enumerate(ts):
        top, bot, belt, hw = interp(S['top'], t), interp(S['bot'], t), interp(S['belt'], t), interp(S['hw'], t)
        rw = interp(S['rw'], t) * hw; top = max(top, belt + 0.03)
        e = 1.0
        if i == 0 or i == len(ts) - 1: e = S.get('endE', 0.55)  # pinched end rings round the nose/tail
        w = hw * e
        mid = belt + (top - belt) * 0.45
        half = [(0.0, bot + 0.02), (0.84 * w, bot), (w * 0.96, bot + (belt - bot) * 0.3), (w, belt - 0.04),
                (w * 0.94, belt + 0.03), (min(rw * 1.14, w * 0.92) * (0.5 + 0.5 * e), mid), (rw * 0.9 * e, top - 0.04), (0.0, top)]
        ring = []
        # left side (x<0) from bottom centre up to roof centre, then right side back down
        pts = [(-x, z) for x, z in half] + [(x, z) for x, z in reversed(half[1:-1])]
        for x, z in pts:
            ring.append(bm.verts.new((x, -(t - L / 2), z)))  # Blender +Y = forward (front at +Y)
        rings.append(ring)
    m = len(rings[0]); faces = []
    cr = bm.edges.layers.float.get('crease_edge') or bm.edges.layers.float.new('crease_edge')
    for vi, val in S.get('crease', {3: 0.6, 4: 0.4}).items():  # longitudinal feature lines (shoulder, beltline)
        for idx in (vi, m - vi):
            for i in range(len(rings) - 1):
                e = bm.edges.get((rings[i][idx], rings[i + 1][idx])) or bm.edges.new((rings[i][idx], rings[i + 1][idx]))
                e[cr] = val
    ec = S.get('endcrease', 0)
    if ec:
        for ring in (rings[0], rings[-1]):
            for j in range(m):
                e = bm.edges.get((ring[j], ring[(j + 1) % m])) or bm.edges.new((ring[j], ring[(j + 1) % m])); e[cr] = ec
    for i in range(len(rings) - 1):
        for j in range(m):
            a, b = rings[i][j], rings[i][(j + 1) % m]; c, d = rings[i + 1][(j + 1) % m], rings[i + 1][j]
            f = bm.faces.new((a, b, c, d)); seg = j if j < 7 else (m - 1 - j)  # 0..6 symmetric segment id
            f.material_index = S['matfn']((ts[i] + ts[i + 1]) / 2, seg, j < 7)
            faces.append(f)
    for ring, flip in ((rings[0], True), (rings[-1], False)):
        f = bm.faces.new(ring if not flip else list(reversed(ring)))
        f.material_index = S['matfn'](0 if flip else L, -1, True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    for mname in S['mats']: me.materials.append(MATS[mname])
    md = ob.modifiers.new('sub', 'SUBSURF'); md.levels = level; md.render_levels = level
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.modifier_apply(modifier='sub')
    return ob

def arches(ob, wheels, r, clear=0.05, width=3.0):
    for (t, L) in wheels:
        bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=r + clear, depth=width, location=(0, -(t - L / 2), r), rotation=(0, math.pi / 2, 0))
        cyl = bpy.context.active_object
        md = ob.modifiers.new('arch', 'BOOLEAN'); md.object = cyl; md.operation = 'DIFFERENCE'; md.solver = 'EXACT'
        bpy.context.view_layer.objects.active = ob; bpy.ops.object.modifier_apply(modifier='arch')
        bpy.data.objects.remove(cyl)

def well(t, L, r, hw, clear=0.05):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=r + clear - 0.01, depth=hw * 2 - 0.12, location=(0, -(t - L / 2), r), rotation=(0, math.pi / 2, 0), end_fill_type='NOTHING')
    o = bpy.context.active_object; o.data.materials.append(MATS['trim']); o.name = 'well'
    for p in o.data.polygons: p.use_smooth = True
    return o

def wheel(t, L, r, w, x, tyre='tyre', rim='rim', spokes=5, name='wheel'):
    # rounded tyre: lathe of a rounded-rect profile; rim: dished disc + raised spokes (aero style)
    bm = bmesh.new(); prof = []
    rr = min(w * 0.42, r * 0.3)
    prof.append((r * 0.7, -w / 2))
    for i in range(5):
        a = -math.pi / 2 + i / 4 * math.pi / 2; prof.append((r - rr + math.cos(a) * rr, -w / 2 + rr + math.sin(a) * rr))
    for i in range(5):
        a = i / 4 * math.pi / 2; prof.append((r - rr + math.cos(a) * rr, w / 2 - rr + math.sin(a) * rr))
    prof.append((r * 0.7, w / 2))
    N = 24; vs = []
    for k in range(N):
        ang = 2 * math.pi * k / N
        vs.append([bm.verts.new((y, math.cos(ang) * R, math.sin(ang) * R)) for R, y in prof])
    for k in range(N):
        A, B = vs[k], vs[(k + 1) % N]
        for i in range(len(prof) - 1): bm.faces.new((A[i], A[i + 1], B[i + 1], B[i]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); me.materials.append(MATS[tyre])
    for p in me.polygons: p.use_smooth = True
    o.location = (x, -(t - L / 2), r)
    side = 1 if x > 0 else -1
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=r * 0.72, depth=w * 0.7, location=(x + side * 0.0, -(t - L / 2), r), rotation=(0, math.pi / 2, 0))
    hub = bpy.context.active_object; hub.data.materials.append(MATS[rim]); hub.name = name + '_rim'
    bev = hub.modifiers.new('b', 'BEVEL'); bev.width = 0.02; bev.segments = 2
    for p in hub.data.polygons: p.use_smooth = True
    parts = [o, hub]
    for s in range(spokes):
        a = 2 * math.pi * s / spokes
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x + side * w * 0.36, -(t - L / 2) + math.cos(a) * r * 0.38, r + math.sin(a) * r * 0.38), rotation=(a + math.pi / 2, 0, 0))
        sp = bpy.context.active_object; sp.scale = (0.03, 0.05, r * 0.62); sp.data.materials.append(MATS['spoke']); parts.append(sp)
    return parts

def lamp(name, mname, loc, size, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot); o = bpy.context.active_object; o.scale = size; o.name = name
    bev = o.modifiers.new('b', 'BEVEL'); bev.width = min(size) * 0.45; bev.segments = 2
    o.data.materials.append(MATS[mname]); return o

def smooth_all(angle=40):
    for o in bpy.data.objects:
        if o.type != 'MESH': continue
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
        for p in o.data.polygons: p.use_smooth = True
        try: o.data.set_sharp_from_angle(angle=math.radians(angle))
        except Exception: pass

def export(path):
    smooth_all()
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_materials='EXPORT', export_yup=True,
                              export_normals=True, export_texcoords=False, export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=6, export_draco_position_quantization=12, export_draco_normal_quantization=8)
    tris = sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == 'MESH' for p in o.data.polygons)
    import mathutils; mn = [min(min((o.matrix_world @ mathutils.Vector(c))[i] for c in o.bound_box) for o in bpy.data.objects if o.type == 'MESH') for i in range(3)]; mx = [max(max((o.matrix_world @ mathutils.Vector(c))[i] for c in o.bound_box) for o in bpy.data.objects if o.type == 'MESH') for i in range(3)]
    print('EXPORT', path, 'tris', tris, 'W L H', [round(b - a, 3) for a, b in zip(mn, mx)])
