"""Read-only structural/animation QA of the actual saved VELUNE Blender file.

Run Blender with the saved .blend followed by --python this_file.py.
Writes JSON and Markdown beside this validator; never saves or edits the blend.
"""
import bpy
import bmesh
import hashlib
import json
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parent
scene = bpy.context.scene
source = Path(bpy.data.filepath)
hash_before = hashlib.sha256(source.read_bytes()).hexdigest()
checks = []
observations = []


def check(name, passed, details):
    checks.append({'check': name, 'passed': bool(passed), 'details': details})


def values(matrix):
    return [float(value) for row in matrix for value in row]


def stable(seq, tolerance=1e-6):
    return all(max(abs(a-b) for a, b in zip(seq[0], item)) <= tolerance for item in seq[1:])


def bounds(obj):
    points = [obj.matrix_world @ Vector(co) for co in obj.bound_box]
    return ([min(p[i] for p in points) for i in range(3)],
            [max(p[i] for p in points) for i in range(3)])


def children(obj):
    return [obj] + [desc for child in obj.children for desc in children(child)]


def inside(point, lo, hi):
    return all(lo[i] < point[i] < hi[i] for i in range(3))


markers = sorted([m for m in scene.timeline_markers if m.camera], key=lambda m:m.frame)
expected_markers = [1, 43, 52, 61, 70, 114, 141, 191, 208, 224, 243, 315]
check('15 seconds / 360 pictures / 24 fps',
      scene.frame_start == 1 and scene.frame_end == 360 and scene.render.fps == 24 and scene.render.fps_base == 1,
      {'start':scene.frame_start, 'end':scene.frame_end, 'fps':scene.render.fps, 'fps_base':scene.render.fps_base})
check('Twelve exact camera markers', [m.frame for m in markers] == expected_markers,
      [{'frame':m.frame, 'camera':m.camera.name, 'name':m.name} for m in markers])

targets = ['CARTON_pis','CARTON_ras','CARTON_car','CAM_MACRO','PISTACHIO_HALF',
           'OBSERVER_A','OBSERVER_B','CAM_LAB','HOST_A','HOST_A_eye-1','HOST_A_eye1','TASTE_FORK']
question_roots = sorted([o for o in scene.objects if o.type == 'EMPTY' and o.name.startswith('QUESTION_BONBON_')], key=lambda o:o.name)
stack_roots = sorted([o for o in scene.objects if o.type == 'EMPTY' and o.name.startswith('LAB_STACK_')], key=lambda o:o.name)
spread_objects = [o for o in scene.objects if o.type == 'MESH' and o.name.startswith('S05_CHOCOLATE_SPREAD_n')]
targets += [o.name for o in stack_roots]
snapshots = []
camera_body_intersections = []
chocolatier_meshes = [o for root_name in ['CHOCOLATIER_A','CHOCOLATIER_B'] for o in children(bpy.data.objects[root_name]) if o.type == 'MESH']
for n in range(360):
    scene.frame_set(n+1)
    bpy.context.view_layer.update()
    active = max((m for m in markers if m.frame <= n+1), key=lambda m:m.frame).camera
    item = {'n':n, 'camera':active.name,
            'matrices':{name:values(bpy.data.objects[name].matrix_world) for name in targets},
            'local_matrices':{name:values(bpy.data.objects[name].matrix_local) for name in targets},
            'positions':{name:list(bpy.data.objects[name].matrix_world.translation) for name in targets},
            'lab_lens':bpy.data.objects['CAM_LAB'].data.lens,
            'question_count':sum(not bpy.data.objects[o.name+'_shell'].hide_render for o in question_roots),
            'spreads':[o.name for o in spread_objects if not o.hide_render],
            'opening_title':not bpy.data.objects['OPENING_REPORT_TITLE'].hide_render,
            'closing_title':not bpy.data.objects['CLOSING_WONDER_WITHIN'].hide_render,
            'taste_fork_visible':not bpy.data.objects['taste_handle'].hide_render,
            'mouth':[list(p.co) for p in bpy.data.objects['HOST_A_mouth'].data.splines[0].points]}
    snapshots.append(item)
    if 164 <= n <= 189:
        camera_position = bpy.data.objects['CAM_LAB'].matrix_world.translation
        for obj in chocolatier_meshes + [bpy.data.objects['tasting_console']]:
            lo, hi = bounds(obj)
            if inside(camera_position, lo, hi):
                camera_body_intersections.append({'n':n, 'object':obj.name})

carton_samples = [[snapshots[start+i]['local_matrices']['CARTON_'+code] for i in range(9)] for code,start in [('pis',42),('ras',51),('car',60)]]
check('Three cartons share the nine-frame rigid motion', all(stable([carton_samples[0][i], carton_samples[1][i], carton_samples[2][i]]) for i in range(9)),
      {'carton_count':3, 'sample_count_each':9})
check('Exactly twelve bonbon roots',len(question_roots)==12,[o.name for o in question_roots])
check('Empty fork through n78 and one bonbon birth each n79..90',
      all(snapshots[n]['question_count']==0 for n in range(69,79)) and
      all(snapshots[n]['question_count']==n-78 for n in range(79,91)),
      {str(n):snapshots[n]['question_count'] for n in range(78,93)})
check('Twelve visible bonbons at n91 and n92',snapshots[91]['question_count']==12 and snapshots[92]['question_count']==12,
      {'n91':snapshots[91]['question_count'], 'n92':snapshots[92]['question_count']})
check('Bonbon solids hidden from n100', all(snapshots[n]['question_count']==0 for n in range(100,113)), 'n100..112')
check('Exactly one spread mesh visible per picture n93..112', all(len(snapshots[n]['spreads'])==1 and snapshots[n]['spreads'][0].endswith(f'{n:03}') for n in range(93,113)) and all(not snapshots[n]['spreads'] for n in [92,113]),
      {str(n):snapshots[n]['spreads'] for n in [92,93,94,100,112,113]})
spread_geometry=[]
for obj in spread_objects:
    bm=bmesh.new();bm.from_mesh(obj.data)
    unseen=set(bm.verts);components=0
    while unseen:
        components+=1;todo=[unseen.pop()]
        while todo:
            vertex=todo.pop()
            for edge in vertex.link_edges:
                other=edge.other_vert(vertex)
                if other in unseen:unseen.remove(other);todo.append(other)
    spread_geometry.append({'object':obj.name,'components':components,'nonmanifold':sum(not e.is_manifold for e in bm.edges)})
    bm.free()
check('Saved spread geometry is connected and manifold',all(x['components']==1 and x['nonmanifold']==0 for x in spread_geometry),spread_geometry)
for name in ['CAM_MACRO','PISTACHIO_HALF']:
    check(name+' remains stationary throughout S06',stable([s['matrices'][name] for s in snapshots[113:140]]),'n113..139')
for name in ['OBSERVER_A','OBSERVER_B']:
    check(name+' moves during S06',not stable([s['matrices'][name] for s in snapshots[113:140]]),
          {str(n):snapshots[n]['positions'][name] for n in [113,126,139]})
scene.frame_set(141)
left=[o for o in stack_roots if o.location.x <0];right=[o for o in stack_roots if o.location.x>0]
check('Laboratory contains three left / two right specimens',len(left)==3 and len(right)==2,
      {'left':[o.name for o in left],'right':[o.name for o in right]})
check('Laboratory products stay fixed',all(stable([s['matrices'][o.name] for s in snapshots[140:190]]) for o in stack_roots),'n140..189')
column = bpy.data.objects.get('plinth_pedestal_column')
if column:
    column_lo, column_hi = bounds(column)
    plinth_lo, plinth_hi = bounds(bpy.data.objects['specimen_plinth'])
    check('Specimen pedestal meets the plinth underside',
          abs(column_lo[2]) < 1e-6 and abs(column_hi[2] - .9) < 1e-6 and abs(column_hi[2] - plinth_lo[2]) < 1e-6,
          {'column_bottom_z':column_lo[2], 'column_top_z':column_hi[2], 'plinth_bottom_z':plinth_lo[2]})
else:
    check('Specimen pedestal meets the plinth underside',False,'Missing plinth_pedestal_column')
check('Lab camera holds through n164',stable([s['matrices']['CAM_LAB'] for s in snapshots[140:165]]),'n140..164')
lab_y=[s['positions']['CAM_LAB'][1] for s in snapshots[164:190]]
check('Lab camera physically dollies n164..189 at 50 mm',all(abs(s['lab_lens']-50)<1e-6 for s in snapshots[140:190]) and all(b<a for a,b in zip(lab_y,lab_y[1:])),
      {str(n):{'position':snapshots[n]['positions']['CAM_LAB'],'lens':snapshots[n]['lab_lens']} for n in [164,174,189]})
check('Lab camera centre remains outside foreground bodies/console',not camera_body_intersections,
      {'sampled_every_picture':True,'scope':'Conservative world-space object bounds at n164..189; not a general mesh collision certificate','intersections':camera_body_intersections})
report_pictures=[s['n'] for s in snapshots if s['camera']=='CAM_REPORT']
check('Report gets exactly 72 consecutive pictures',report_pictures==list(range(242,314)),{'count':len(report_pictures),'first':report_pictures[0],'last':report_pictures[-1]})
check('Opening title visible only n0..41',all(s['opening_title']==(s['n']<42) for s in snapshots),'exact visibility sequence')
check('Closing title visible only n314..359',all(s['closing_title']==(314<=s['n']<=359) for s in snapshots),'exact visibility sequence')
check('Taste fork absent opening, present ending',all(not s['taste_fork_visible'] for s in snapshots[:314]) and all(s['taste_fork_visible'] for s in snapshots[314:]),'n0..313 hidden / n314..359 shown')
for name in ['HOST_A','TASTE_FORK']:
    check(name+' has final-shot movement',not stable([s['matrices'][name] for s in snapshots[314:]]),
          {str(n):snapshots[n]['positions'][name] for n in [314,338,359]})
for name in ['HOST_A_eye-1','HOST_A_eye1']:
    check(name+' has subtle final local eye response',not stable([s['local_matrices'][name] for s in snapshots[314:]],1e-7),'n314..359; small positional gaze response, not a blink rig')
check('Host mouth changes in ending',snapshots[314]['mouth']!=snapshots[359]['mouth'],{'n314':snapshots[314]['mouth'],'n359':snapshots[359]['mouth']})
check('Same host object used by both tunnel views',bpy.data.objects['CAM_S01'].parent==bpy.data.objects['CAM_S12'].parent==bpy.data.objects['HOST_A'].parent,
      {'host':'HOST_A','shared_parent':bpy.data.objects['HOST_A'].parent.name})
hash_after=hashlib.sha256(source.read_bytes()).hexdigest()
check('Validator left the source blend unchanged',hash_before==hash_after,{'sha256':hash_after})
observations.extend([
    'Inspected rendered n91: twelve distinct bonbons form the question; fork remains below them and the hand is deliberately cropped.',
    'Inspected rendered n112: the question interior is filled and the spread remains connected over the fork; this is a motion-guide surface, not final food beauty.',
    'Inspected rendered n189: the foreground people frame the five fixed specimens without hiding their count. Intended shoulder/arm construction overlaps are proxy modelling joints.',
    'Inspected updated rendered n174/n189: the plum pedestal column now supports the specimen plinth, replacing the previous floating appearance. Its upper face meets the underside of the plinth; all five specimens remain visible.',
    'Inspected rendered n113/n139: macro observers exchange lower/upper positions around a fixed cut chocolate and fork. Their eyes remain camera-forward rather than dynamically tracking the product. No unintended product/body overlap is visible.',
    'Inspected rendered n42: carton is supported by the pedestal; the label stays on its front face and the intended side mattes remain.',
    'Inspected rendered n314: host sits in the central tunnel aperture; tasting fork is at mouth height; closing tagline remains legible. Mouth/fork contact is deliberate.',
    'Characters, eyes and facial response are intentionally stylized proxy geometry. This test establishes rig motion and visibility, not photoreal performance or final identity quality.',
    'No broad all-object intersection scan was run: nested shell/filling, fork contact and assembled proxy anatomy contain intended overlaps. The targeted lab-camera check is scoped explicitly above.'
])
result={'file':str(source),'blender_version':bpy.app.version_string,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'checks':checks,'visual_observation_scope':'Historical manual review of the 2026-09-10 camera checkpoint; not performed by this validator','visual_observations':observations}
(OUT/'saved-scene-validation.json').write_text(json.dumps(result,indent=2))
lines=['# Saved VELUNE scene validation','',f"Source: `{source.name}`. Blender {bpy.app.version_string}.",'',f"**{result['passed']} checks passed; {result['failed']} failed.**",'', 'The validator opened the saved file and never saved or changed it. All picture indices below are zero-based.','']
lines += [f"- {'PASS' if c['passed'] else 'FAIL'} — {c['check']}" for c in checks]
lines += ['', '## Historical manual inspection — 10 September 2026; not repeated by this script', '']+[f'- {item}' for item in observations]
lines += ['', 'Detailed values, marker bindings, visibility counts and source SHA-256 are in `saved-scene-validation.json`.']
(OUT/'saved-scene-validation.md').write_text('\n'.join(lines)+'\n')
print('SAVED_SCENE_VALIDATION',json.dumps({'passed':result['passed'],'failed':result['failed'],'failed_checks':[c for c in checks if not c['passed']]}))
