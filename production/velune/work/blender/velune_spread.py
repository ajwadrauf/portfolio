"""Deterministic baked implicit-union spread for VELUNE S05.

Call from question() after creating the twelve bonbons::

    from velune_spread import build_question_spread
    spread = build_question_spread(ROOT, M['shell'], pts, window_fn=window)

The helper does not create or animate the bonbons. Keep births n79..90, leave
the readable mark alone through n92, flatten/lower bonbons n93..99 and hide
them at n100. It creates the bridge/pool surface only, one baked mesh for each
picture n93..112. All coordinates are local to root. No fluid simulation,
randomness, external assets or third-party Python packages are used.

Each frame is the boundary of one scalar implicit field. Overlapping source
elements are combined before meshing, not left as crossing visible shells.
After conversion, no metaball evaluator is needed at render time.
"""

import math
import bpy


def _smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def _default_window(obj, n):
    for frame, hidden in [(1, True), (n, True), (n + 1, False), (n + 2, True), (360, True)]:
        obj.hide_render = hidden
        obj.hide_viewport = hidden
        obj.keyframe_insert('hide_render', frame=frame)
        obj.keyframe_insert('hide_viewport', frame=frame)
    action = obj.animation_data.action
    curves = []
    if hasattr(action, 'fcurves'):
        curves = list(action.fcurves)
    else:
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    curves.extend(bag.fcurves)
    for curve in curves:
        for key in curve.keyframe_points:
            key.interpolation = 'CONSTANT'


def _element(data, position, axes, stiffness=2.0):
    element = data.elements.new()
    element.type = 'ELLIPSOID'
    element.co = position
    element.radius = 1.0
    element.size_x, element.size_y, element.size_z = axes
    element.stiffness = stiffness
    return element


def _nearest_on_path(x, y, pts):
    nearest, best = pts[0], float('inf')
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        dx, dy = bx - ax, by - ay
        length_sq = dx * dx + dy * dy
        t = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / length_sq)) if length_sq else 0.0
        point = (ax + t * dx, ay + t * dy)
        distance = (point[0] - x) ** 2 + (point[1] - y) ** 2
        if distance < best:
            nearest, best = point, distance
    return nearest


def build_question_spread(root, material, pts, window_fn=None, resolution=0.025, ground_z=-0.02):
    """Return 20 baked mesh objects for zero-based pictures 93..112.

    root: Blender parent object; material: chocolate material; pts: exactly
    twelve ordered local XY question anchors; window_fn: optional existing
    helper accepting ([objects], first_picture, exclusive_end_picture).

    The source hand/fork and bonbon roots remain caller-owned. Resolution is
    the implicit mesh grid spacing in the same local units as the 5.5-wide
    action plane. Default is appropriate for a 1280-wide motion guide.
    ground_z is the top of that plane: the finished mesh touches it exactly.
    """
    if len(pts) != 12:
        raise ValueError('S05 requires exactly twelve ordered bonbon anchors')
    if resolution <= 0:
        raise ValueError('Resolution must be positive')
    meshes = []
    for n in range(93, 113):
        # Filling happens early, then the last twelve pictures only settle.
        fill = _smooth((n - 93) / 7.0)
        settle = _smooth((n - 100) / 12.0)
        data = bpy.data.metaballs.new(f'VELUNE_IMPLICIT_SOURCE_{n}')
        data.resolution = resolution
        data.render_resolution = resolution
        data.threshold = 0.60
        source = bpy.data.objects.new(f'VELUNE_IMPLICIT_SOURCE_{n}', data)
        bpy.context.scene.collection.objects.link(source)

        # Ordered narrow pools link adjacent chocolates before the interior
        # fills. Dense samples create connected bridges without tube folds.
        for j in range(len(pts) - 1):
            ax, ay = pts[j]
            bx, by = pts[j + 1]
            distance = math.hypot(bx - ax, by - ay)
            count = max(2, math.ceil(distance / 0.08))
            for k in range(count):
                t = k / count
                x, y = ax + (bx - ax) * t, ay + (by - ay) * t
                r = 0.088 + 0.050 * fill + 0.010 * settle
                _element(data, (x, y, 0.025 + 0.011 * fill),
                         (r, r, 0.032 + 0.020 * fill - 0.009 * settle))
        x, y = pts[-1]
        _element(data, (x, y, 0.035), (0.14, 0.14, 0.05))

        # Irregular, broad centre assembled as one field. The support points
        # are fixed; growth closes the mark's negative space by picture 100.
        # Unequal radii and lateral offsets avoid a regular circle or capsule.
        lobes = [
            (0.02, -0.61, 0.29, 0.39),
            (0.14, -0.26, 0.50, 0.47),
            (0.21, 0.15, 0.60, 0.51),
            (0.13, 0.54, 0.59, 0.47),
            (-0.01, 0.80, 0.47, 0.31),
            (0.47, 0.34, 0.26, 0.36),
            (-0.32, 0.67, 0.25, 0.27),
        ]
        # At n93/94, no central seed is visible yet: only clear bridges.
        grow = _smooth((n - 94) / 6.0)
        if grow > 0:
            for x, y, rx, ry in lobes:
                scale = 0.12 + 0.88 * grow
                # Each lobe advances from the existing chocolate boundary,
                # so isolated pools do not suddenly appear in empty space.
                start_x, start_y = _nearest_on_path(x, y, pts)
                centre_x = start_x + (x - start_x) * grow
                centre_y = start_y + (y - start_y) * grow
                _element(data, (centre_x, centre_y, 0.038),
                         (rx * scale * (1 + 0.035 * settle),
                          ry * scale * (1 + 0.022 * settle),
                          0.078 - 0.022 * settle))

        # A few chocolate remnants contribute raised highlights to the same
        # field instead of sitting as intersecting separate meshes on top.
        for j in [1, 4, 7, 10]:
            x, y = pts[j]
            _element(data, (x, y, 0.043 + 0.014 * (1 - settle)),
                     (0.14 + 0.035 * fill, 0.13 + 0.035 * fill,
                      0.053 - 0.012 * settle))

        bpy.ops.object.select_all(action='DESELECT')
        source.select_set(True)
        bpy.context.view_layer.objects.active = source
        bpy.context.view_layer.update()
        bpy.ops.object.convert(target='MESH')
        obj = bpy.context.object
        obj.name = f'S05_CHOCOLATE_SPREAD_n{n:03}'
        contact_shift = ground_z - min(vertex.co.z for vertex in obj.data.vertices)
        for vertex in obj.data.vertices:
            vertex.co.z += contact_shift
        obj.parent = root
        obj.data.materials.append(material)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        obj['source_picture'] = n
        obj['geometry_method'] = 'Baked implicit union; deterministic; no live physics'
        obj['role'] = 'Adjacent bridges' if n < 95 else ('Fill opening' if n < 101 else 'Settled irregular thick spread')
        obj['editable_source'] = 'velune_spread.py build_question_spread()'
        if window_fn:
            window_fn([obj], n, n + 1)
        else:
            _default_window(obj, n)
        meshes.append(obj)
        if data.users == 0:
            bpy.data.metaballs.remove(data)
    return meshes
