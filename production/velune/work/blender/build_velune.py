"""VELUNE — 24 fps / 360-picture editable camera and choreography blockout.

Executed and reviewed in Blender 5.2.1 LTS on 10 September 2026.
This is an editable camera study, not a finished commercial. Human identities
and beauty materials remain provisional. Cut shells, deterministic spread,
timing and camera routes are built locally. No external services are called.

blender --background --python blender/build_velune.py -- --output blender/velune.blend
Add --render-keyframes to inspect the 30 poses; --render-guide for 360 PNGs.
--full-bleed removes the source's side mattes. Otherwise they are preserved.
"""
from __future__ import annotations
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from velune_spread import build_question_spread

BASE = Path(__file__).resolve().parent.parent
FPS, COUNT = 24, 360
ROOT = None
M = {}
POSES = [0,14,41,42,51,60,69,78,79,84,91,94,100,112,113,126,139,140,154,164,174,189,190,207,223,241,242,280,314,359]

def parse_args():
    tail = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output', default=str(BASE/'blender/velune.blend'))
    p.add_argument('--render-keyframes', action='store_true')
    p.add_argument('--render-guide', action='store_true')
    p.add_argument('--full-bleed', action='store_true')
    p.add_argument('--width', type=int, default=960)
    p.add_argument('--samples', type=int, default=24)
    p.add_argument('--poses', default='')
    p.add_argument('--guide-start', type=int, default=1, help='First Blender picture to render; saved scene stays 1–360')
    p.add_argument('--guide-end', type=int, default=360, help='Last Blender picture to render')
    return p.parse_args(tail)

def linear_colour(h):
    rgb = [int(h.lstrip('#')[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in rgb)

def mat(name,hexcode,rough=.4,metal=0,noise=False):
    m=bpy.data.materials.new(name);m.use_nodes=True
    rgb=linear_colour(hexcode);m.diffuse_color=(*rgb,1)
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*rgb,1)
    bs.inputs['Roughness'].default_value=rough
    bs.inputs['Metallic'].default_value=metal
    if noise:
        nt=m.node_tree;tex=nt.nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=140
        bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.00015
        nt.links.new(tex.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],bs.inputs['Normal'])
    return m

def image_mat(name,path,emission=False):
    if not path.is_file():raise FileNotFoundError(f'Missing artwork: {path}')
    m=bpy.data.materials.new(name);m.use_nodes=True;nt=m.node_tree
    tex=nt.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(path),check_existing=True)
    if emission:
        bs=nt.nodes.get('Principled BSDF');nt.nodes.remove(bs)
        e=nt.nodes.new('ShaderNodeEmission');nt.links.new(tex.outputs['Color'],e.inputs['Color'])
        nt.links.new(e.outputs[0],nt.nodes.get('Material Output').inputs['Surface'])
    else:
        bs=nt.nodes.get('Principled BSDF');nt.links.new(tex.outputs['Color'],bs.inputs['Base Color']);bs.inputs['Roughness'].default_value=.48
    return m

def empty(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(o);o.parent=parent;o.location=loc;return o

def root(name,x):
    global ROOT
    ROOT=empty(name,(x,0,0));ROOT['status']='PROPOSED_BLOCKOUT_NOT_SOURCE_MEASUREMENT';return ROOT

def attach(o,name,loc,material=None,parent=None):
    o.name=name;o.parent=ROOT if parent is None else parent;o.location=loc
    if material:o.data.materials.append(material)
    return o

def box(name,loc,dims,material,parent=None,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o=attach(bpy.context.object,name,loc,material,parent)
    # Apply dimensions directly to mesh, keeping child transforms simple.
    for v in o.data.vertices:v.co.x*=dims[0];v.co.y*=dims[1];v.co.z*=dims[2]
    if bevel:
        mod=o.modifiers.new('soft_edges','BEVEL');mod.width=bevel;mod.segments=3
        n=o.modifiers.new('weighted_normals','WEIGHTED_NORMAL')
    return o

def ellipsoid(name,loc,scale,material,parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=1)
    o=attach(bpy.context.object,name,loc,material,parent);o.scale=scale
    for p in o.data.polygons:p.use_smooth=True
    return o

def cylinder(name,loc,r,depth,material,parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=r,depth=depth)
    o=attach(bpy.context.object,name,loc,material,parent)
    for p in o.data.polygons:p.use_smooth=True
    return o

def plane_xz(name,loc,w,h,material,parent=None):
    # Image front faces -Y; lower-left UV=(0,0), upper-right=(1,1).
    mesh=bpy.data.meshes.new(name+'_mesh');mesh.from_pydata([(-w/2,0,-h/2),(w/2,0,-h/2),(w/2,0,h/2),(-w/2,0,h/2)],[],[(0,1,2,3)]);mesh.update()
    uv=mesh.uv_layers.new(name='UVMap')
    for loop,xy in zip(mesh.loops,[(0,0),(1,0),(1,1),(0,1)]):uv.data[loop.index].uv=xy
    o=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(o);return attach(o,name,loc,material,parent)

def curve_poly(name,coords,r,material,parent=None):
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.bevel_depth=r;d.bevel_resolution=3
    s=d.splines.new('POLY');s.points.add(len(coords)-1)
    for p,c in zip(s.points,coords):p.co=(*c,1)
    o=bpy.data.objects.new(name,d);bpy.context.scene.collection.objects.link(o);return attach(o,name,(0,0,0),material,parent)

def descendants(o):
    return [o]+[x for c in o.children for x in descendants(c)]

def action_curves(obj):
    action=obj.animation_data.action if obj.animation_data else None
    if not action:return []
    if hasattr(action,'fcurves'):return list(action.fcurves)
    result=[]
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:result.extend(bag.fcurves)
    return result

def window(objs,a,b):
    # Public frame convention [a,b), transformed once to Blender frames.
    for o in objs:
        points={1:True,a+1:False,b:False}
        if a>0:points[a]=True
        if b<COUNT:points[b+1]=True;points[COUNT]=True
        for f,val in sorted(points.items()):
            o.hide_render=val;o.keyframe_insert('hide_render',frame=f)
            o.hide_viewport=val;o.keyframe_insert('hide_viewport',frame=f)
        if o.animation_data and o.animation_data.action:
            for fc in action_curves(o):
                if fc.data_path in ('hide_render','hide_viewport'):
                    for k in fc.keyframe_points:k.interpolation='CONSTANT'

def pose(o,n,loc=None,rot=None,scale=None):
    for prop,val in [('location',loc),('rotation_euler',rot),('scale',scale)]:
        if val is not None:setattr(o,prop,val);o.keyframe_insert(prop,frame=n+1)

def smooth(t):
    t=max(0,min(1,t));return t*t*(3-2*t)

def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()

def cam(name,loc,target,lens=50,ortho=None):
    d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);bpy.context.scene.collection.objects.link(o)
    o.parent=ROOT;o.location=loc;d.sensor_width=36;d.sensor_fit='HORIZONTAL';d.lens=lens;d.clip_start=.001;d.clip_end=40
    if ortho is not None:d.type='ORTHO';d.ortho_scale=ortho
    d.dof.use_dof=False;aim(o,target);o['note']='Proposed projection. Approve against pose references before beauty.';return o

def area(name,loc,target,power,size,colour='#FFFFFF'):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=linear_colour(colour)
    o=bpy.data.objects.new(name,d);bpy.context.scene.collection.objects.link(o);o.parent=ROOT;o.location=loc;aim(o,target);return o

def matte_bars(c):
    depth=.04;w=c.data.ortho_scale if c.data.type=='ORTHO' else depth*c.data.sensor_width/c.data.lens;h=w*9/16;fraction=.0875
    for s in [-1,1]:
        x=s*w*(.5-fraction/2);mesh=bpy.data.meshes.new('matte')
        mesh.from_pydata([(x-w*fraction/2,-h*.51,-depth),(x+w*fraction/2,-h*.51,-depth),(x+w*fraction/2,h*.51,-depth),(x-w*fraction/2,h*.51,-depth)],[],[(0,1,2,3)])
        o=bpy.data.objects.new('SOURCE_SIDE_MATTE',mesh);bpy.context.scene.collection.objects.link(o);o.parent=c;mesh.materials.append(M['black'])

def camera_overlay(c,name,path,a,b):
    material=bpy.data.materials.new(name+'_material');material.use_nodes=True
    nt=material.node_tree;nt.nodes.clear()
    tex=nt.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(path),check_existing=True)
    emission=nt.nodes.new('ShaderNodeEmission');transparent=nt.nodes.new('ShaderNodeBsdfTransparent');mix=nt.nodes.new('ShaderNodeMixShader');out=nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tex.outputs['Color'],emission.inputs['Color']);nt.links.new(tex.outputs['Alpha'],mix.inputs[0]);nt.links.new(transparent.outputs[0],mix.inputs[1]);nt.links.new(emission.outputs[0],mix.inputs[2]);nt.links.new(mix.outputs[0],out.inputs['Surface'])
    depth=.02;w=depth*c.data.sensor_width/c.data.lens;h=w*9/16
    mesh=bpy.data.meshes.new(name+'_mesh');mesh.from_pydata([(-w/2,-h/2,-depth),(w/2,-h/2,-depth),(w/2,h/2,-depth),(-w/2,h/2,-depth)],[],[(0,1,2,3)]);mesh.update()
    uv=mesh.uv_layers.new(name='UVMap')
    for loop,xy in zip(mesh.loops,[(0,0),(1,0),(1,1),(0,1)]):uv.data[loop.index].uv=xy
    obj=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(obj);obj.parent=c;mesh.materials.append(material)
    if hasattr(obj,'visible_shadow'):obj.visible_shadow=False
    window([obj],a,b)
    return obj

def bonbon(name,loc,scale=1,parent=None,half=False,filling='pis'):
    p=empty(name,loc,ROOT if parent is None else parent)
    if half:
        # Solid shell with an open cut annulus, curved back and inset dense filling.
        def outline(rx,rz,i):
            t=2*math.pi*i/64
            return (rx*math.copysign(abs(math.cos(t))**.66,math.cos(t)),rz*math.copysign(abs(math.sin(t))**.66,math.sin(t)))
        vv=[];ff=[]
        for y,rx,rz in [(-.0075,.015,.009),(.002,.0146,.0085),(.0067,.011,.0065),(.0075,.004,.002)]:
            for i in range(64):
                x,z=outline(rx,rz,i);vv.append((x,y,z))
        for ring in range(3):
            for i in range(64):ff.append((ring*64+i,ring*64+(i+1)%64,(ring+1)*64+(i+1)%64,(ring+1)*64+i))
        ff.append(tuple(range(192,256)))
        for i in range(64):
            x,z=outline(.012,.006,i);vv.append((x,-.00755,z))
        for i in range(64):ff.append((i,256+i,256+(i+1)%64,(i+1)%64))
        mesh=bpy.data.meshes.new(name+'_shell_mesh');mesh.from_pydata(vv,[],ff);mesh.update()
        shell=bpy.data.objects.new(name+'_shell',mesh);bpy.context.scene.collection.objects.link(shell);attach(shell,name+'_shell',(0,0,0),M['shell'],p)
        for face in mesh.polygons:face.use_smooth=True
        fillverts=[(0,-.0077,0)]+[(x,-.00758,z) for i in range(64) for x,z in [outline(.01198,.00598,i)]]
        fillfaces=[(0,1+i,1+(i+1)%64) for i in range(64)]
        fm=bpy.data.meshes.new(name+'_filling_mesh');fm.from_pydata(fillverts,[],fillfaces);fm.update()
        fo=bpy.data.objects.new(name+'_cut_centre',fm);bpy.context.scene.collection.objects.link(fo);attach(fo,name+'_cut_centre',(0,0,0),M['filling_'+filling],p)
        p['note']='Modelled cut shell with annulus and contained centre; artistic dimensions, appearance still provisional.'
    else:
        box(name+'_shell',(0,0,0),(.030,.030,.018),M['shell'],p,.005)
        curve_poly(name+'_V_mark',[(-.006,-.004,.0092),(0,.005,.0092),(.006,-.004,.0092)],.00025,M['groove'],p)
    p.scale=(scale,)*3;return p

def head(name,loc,parent=None,colour='coat'):
    p=empty(name,loc,ROOT if parent is None else parent)
    ellipsoid(name+'_face',(0,0,0),(.22,.17,.28),M['skin'],p)
    ellipsoid(name+'_hair',(0,.035,.16),(.24,.18,.19),M['hair'],p)
    ellipsoid(name+'_nose',(0,-.166,-.028),(.025,.045,.039),M['skin'],p)
    for s in [-1,1]:
        ellipsoid(name+'_ear'+str(s),(s*.214,.005,-.02),(.026,.038,.052),M['skin'],p)
        ellipsoid(name+'_eye'+str(s),(s*.073,-.164,.025),(.018,.014,.011),M['hair'],p)
    curve_poly(name+'_mouth',[(-.055,-.164,-.09),(0,-.174,-.10),(.055,-.164,-.09)],.007,M['groove'],p)
    box(name+'_shoulders',(0,.015,-.46),(.66,.28,.45),M[colour],p,.08)
    if name.endswith('_B'):
        bpy.data.objects[name+'_hair'].scale=(.245,.20,.255)
        bpy.data.objects[name+'_face'].scale.z=.31
    p['status']='NON-LIKENESS PROXY: replace with approved fictional character rig'
    return p

def person_back(name,loc):
    p=empty(name,loc,ROOT)
    ellipsoid(name+'_head',(0,0,1.58),(.18,.16,.22),M['hair'],p)
    box(name+'_jacket',(0,0,1.07),(.56,.30,.77),M['coat'],p,.06)
    for s in [-1,1]:
        box(name+'_arm'+str(s),(s*.33,.06,1.05),(.13,.15,.64),M['coat'],p,.04)
        box(name+'_leg'+str(s),(s*.15,0,.37),(.18,.21,.75),M['plum'],p,.03)
    return p

def tunnel():
    root('SET_TUNNEL',0)
    # Sculptural folded toroidal ribbons: editable starting geometry, not food-final.
    for i in range(8):
        radius=2.95-i*.33;depth=i*.50;verts=[];faces=[]
        for j in range(120):
            a=2*math.pi*j/120;wave=1+.028*math.sin(a*7+i*.5)+.018*math.sin(a*13)
            for k in range(12):
                b=2*math.pi*k/12;r=radius*wave+.24*math.cos(b)
                verts.append((r*math.cos(a),depth+.15*math.sin(b)+.05*math.sin(a*5),1.5+r*math.sin(a)))
        for j in range(120):
            for k in range(12):faces.append((j*12+k,((j+1)%120)*12+k,((j+1)%120)*12+(k+1)%12,j*12+(k+1)%12))
        me=bpy.data.meshes.new('fold');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(f'chocolate_fold_{i}',me);bpy.context.scene.collection.objects.link(o);o.parent=ROOT;me.materials.append(M['shell'])
        for p in me.polygons:p.use_smooth=True
        coords=[((radius+.09)*math.cos(2*math.pi*j/120),depth-.10,1.5+(radius+.09)*math.sin(2*math.pi*j/120)) for j in range(121)]
        curve_poly('thin_caramel_vein',coords,.012,M['car'])
    box('plum_rear',(0,5.2,1.6),(12,.10,8),M['plum'])
    actor=head('HOST_A',(0,4.45,1.5),colour='plum');actor.scale=(1.2,)*3
    for n in range(42):
        t=smooth(n/41);pose(actor,n,rot=(0,.045*t,-.13*t),loc=(.025*t,4.45,1.5+.025*t))
    mouth=bpy.data.objects['HOST_A_mouth'].data.splines[0]
    for n in list(range(42))+list(range(314,360)):
        u=smooth(n/41) if n<42 else smooth((n-314)/45)
        for j,point in enumerate(mouth.points):
            point.co.z=(-.10 if j==1 else -.092+.025*u);point.keyframe_insert('co',frame=n+1)
        for side in [-1,1]:
            eye=bpy.data.objects['HOST_A_eye'+str(side)]
            gaze=.010*math.sin(math.pi*min(n,41)/41) if n<42 else .003*math.sin(u*math.pi)
            pose(eye,n,loc=(side*.073,-.164,.025+gaze))
    fork=empty('TASTE_FORK',(-.10,4.17,1.39),ROOT)
    box('taste_handle',(-.14,0,0),(.26,.012,.012),M['metal'],fork,.003)
    for z in [-.012,0,.012]:box('taste_tine',(.03,0,z),(.09,.007,.006),M['metal'],fork,.002)
    piece=bonbon('taste_piece',(.045,-.004,0),1.2,fork)
    window(descendants(fork),314,360)
    # Small withdrawal and settling, not a full chewing performance.
    for n in range(314,360):
        u=smooth((n-314)/24);pose(fork,n,loc=(-.10-.11*u,4.17,1.39-.025*u))
        pose(actor,n,rot=(0,.02*math.sin((n-314)/45*math.pi),-.04*u))
    area('tunnel_key',(-1.8,1.1,4),(0,3.4,1.5),650,3,'#FFF0DB')
    area('tunnel_fill',(2.5,1.8,1.5),(0,4.2,1.5),260,3)
    return cam('CAM_S01',(0,2.3,1.5),(0,4.45,1.5),50),cam('CAM_S12',(0,-2.2,1.5),(0,4.45,1.5),30)

def stage():
    box('plum_backdrop',(0,.8,.30),(3,.03,2),M['plum'])
    cylinder('plum_pedestal',(0,0,.06),.11,.12,M['plum'])
    cylinder('pedestal_gold_edge',(0,0,.117),.111,.004,M['gold'])
    area('product_key',(-.4,-.6,.75),(0,0,.22),8,.5,'#FFF0DB')
    area('product_fill',(.4,-.2,.35),(0,0,.20),3,.5)

def cartons():
    root('SET_CARTONS',50);stage()
    c=cam('CAM_BOX',(0,-1.30,.27),(0,0,.205),75)
    for code,a,b in [('pis',42,51),('ras',51,60),('car',60,69)]:
        p=empty('CARTON_'+code,(0,0,.21),ROOT)
        box('rigid_carton_'+code,(0,0,0),(.12,.04,.18),M[code],p,.0015)
        plane_xz('exact_front_'+code,(0,-.0202,0),.119,.179,image_mat('label_'+code,BASE/f'artwork/box_{code}_front.png'),p)
        window(descendants(p),a,b)
        for n in range(a,b):pose(p,n,rot=(0,0,math.radians(-9+18*(n-a)/(b-a-1))))
    return c

def question():
    root('SET_QUESTION',100);box('pistachio_action_plane',(0,0,-.08),(9,6,.12),M['pis'])
    # Normal-to-plane view: fork/hand are symbolic proxies aligned in XY.
    box('fork_handle',(0,-1.31,.02),(.035,.72,.025),M['metal'],bevel=.008)
    for x in [-.064,0,.064]:box('fork_tine',(x,-.91,.025),(.018,.23,.020),M['metal'],bevel=.005)
    ellipsoid('hand_proxy',(.16,-1.52,.02),(.16,.26,.10),M['skin'])
    px=[(319,267),(323,235),(321,207),(336,186),(359,168),(381,149),(385,124),(370,97),(342,85),(314,83),(290,98),(265,112)]
    pts=[((x/640-.5)*5.5,(.5-y/360)*5.5*9/16) for x,y in px]
    for j,(x,y) in enumerate(pts):
        p=bonbon(f'QUESTION_BONBON_{j:02}',(x,y,.115),7.0)
        window(descendants(p),79+j,100)
        for n in range(93,100):
            u=smooth((n-93)/6);pose(p,n,loc=(x,y,.115-.075*u),scale=(7+1.5*u,7+1.5*u,7-6.2*u))
    build_question_spread(ROOT, M['shell'], pts, window_fn=window)
    area('spread_key',(-3,3,4.5),(0,0,0),600,2,'#FFF0DB');area('spread_fill',(2,-2,4),(0,0,0),100,4)
    return cam('CAM_QUESTION',(0,0,6),(0,0,0),50,5.5)

def macro():
    root('SET_MACRO',150);box('dark_macro_back',(0,3,1.4),(12,.10,8),M['black'])
    # Enlarged product has a fixed upright support; observers alone follow the arc.
    box('upright_fork_handle',(0,-.10,.60),(.025,.025,.90),M['metal'],bevel=.004)
    for x in [-.14,0,.14]:box('macro_tine',(x,-.08,1.10),(.018,.022,.16),M['metal'],bevel=.004)
    box('macro_fork_collar',(0,-.08,1.045),(.30,.025,.027),M['metal'],bevel=.004)
    hero=bonbon('PISTACHIO_HALF',(0,-.07,1.37),24,half=True,filling='pis')
    a=head('OBSERVER_A',(-.80,1.0,1.02),colour='plum');b=head('OBSERVER_B',(.80,1.1,1.75))
    for n in range(113,140):
        t=(n-113)/26;angle=math.radians(-24+48*t)
        pose(a,n,loc=(-.77*math.cos(angle),1.0,1.38+.82*math.sin(angle)))
        pose(b,n,loc=(.77*math.cos(angle),1.12,1.38-.82*math.sin(angle)))
    area('macro_key',(-1,-2,3),(0,0,1.37),340,1.1,'#FFF0DB');area('metal_strip',(1,-1,2.5),(0,0,1.1),100,.6)
    return cam('CAM_MACRO',(0,-4.3,1.30),(0,0,1.30),85)

def lab():
    root('SET_LAB',200);box('lab_back',(0,3,2.7),(15,.15,8),M['plum']);box('lab_floor',(0,0,-.03),(15,15,.05),M['plum'])
    box('plinth_pedestal_column',(0,0,.45),(.55,.46,.90),M['plum'],bevel=.025)
    box('specimen_plinth',(0,0,1.0),(1.45,.8,.20),M['plum'],bevel=.03)
    for x,count in [(-.30,3),(.30,2)]:
        for j in range(count):bonbon(f'LAB_STACK_{x}_{j}',(x,0,1.10+.108+.216*j),12)
    a=person_back('CHOCOLATIER_A',(-.74,-3.3,0));b=person_back('CHOCOLATIER_B',(.74,-3.25,0));b.scale=(1.04,)*3
    box('tasting_console',(0,-2.78,.9),(2.25,.65,.23),M['coat'],bevel=.04)
    for x in [-.8,-.5,-.2,.2,.5,.8]:cylinder('console_control',(x,-2.8,1.04),.025,.04,M['metal'])
    for s in [-1,1]:
        cylinder('desk_lamp_base',(s*1.08,-2.75,1.05),.09,.025,M['gold'])
        cylinder('desk_lamp_stem',(s*1.08,-2.75,1.28),.012,.45,M['metal'])
        area('desk_light',(s*1.08,-2.75,1.50),(0,-2.5,1.05),25,.2,'#FFF0DB')
    for n in range(140,190):
        t=(n-140)/49;pose(a,n,rot=(0,0,.008*math.sin(t*math.pi)));pose(b,n,rot=(0,0,-.008*math.sin(t*math.pi)))
    area('specimen_spot',(0,-.1,4.3),(0,0,1.3),1000,1.0,'#FFF0DB');area('lab_fill',(0,-5,3),(0,-2,1.2),100,4)
    c=cam('CAM_LAB',(0,-2.5,1.65),(0,0,1.45),50)
    route=json.loads((BASE/'blender/lab_camera_route.json').read_text())['samples']
    for r in route:
        c.location=r['position'];aim(c,r['target']);pose(c,r['frame'],loc=tuple(c.location),rot=tuple(c.rotation_euler))
    return c

def ingredients():
    root('SET_INGREDIENTS',250);stage();c=cam('CAM_INGREDIENT',(0,-1.15,.245),(0,0,.19),75)
    berry=empty('RASPBERRY',(0,0,.128),ROOT)
    for layer in range(5):
        z=layer*.009;rad=.024*(1-.14*layer)
        for j in range(max(5,10-layer)):
            a=2*math.pi*j/max(5,10-layer)
            ellipsoid('raspberry_drupelet',(rad*math.cos(a),rad*math.sin(a),z),(.009,.009,.008),M['berry'],berry)
    window(descendants(berry),190,207)
    nut=empty('OPEN_PISTACHIO',(0,0,.135),ROOT)
    for s in [-1,1]:
        o=ellipsoid('shell_half',(s*.019,0,.006),(.022,.034,.012),M['nutshell'],nut);o.rotation_euler.y=s*.45
    ellipsoid('kernel',(0,-.004,.016),(.014,.026,.012),M['pis'],nut);window(descendants(nut),207,223)
    serve=empty('SERVING',(0,0,.128),ROOT);cylinder('cream_dish',(0,0,0),.055,.013,M['cream'],serve)
    bonbon('whole_serving',(-.018,.008,.0155),1.0,serve)
    bonbon('caramel_half',(.018,-.023,.0164),1.1,serve,half=True,filling='car');window(descendants(serve),223,242)
    for ob,a,b in [(berry,190,207),(nut,207,223),(serve,223,242)]:
        for n in range(a,b):pose(ob,n,rot=(0,0,math.radians(-7+14*(n-a)/(b-a-1))))
    return c

def report():
    root('SET_REPORT',300)
    # The complete printed image is ONE surface, not separate animated products.
    p=plane_xz('PRINTED_CENTRE_REPORT',(0,0,0),1.7777778,1.0,image_mat('report_art',BASE/'artwork/centre_report.png',emission=True))
    # Art is letterboxed to the source active width by a dedicated camera crop.
    for n in range(242,314):
        t=min(1,(n-242)/12);r=math.radians(1.1)*(1-smooth(t));pose(p,n,rot=(0,0,r))
    p['status']='Flat concept print with placeholder illustrations; replace image with approved art only.'
    return cam('CAM_REPORT',(0,-3,0),(0,0,0),50,1.7777778)

def main():
    args=parse_args()
    if args.width<320 or args.width%16:raise ValueError('--width must be >=320 and divisible by 16')
    if not 1<=args.guide_start<=args.guide_end<=COUNT:raise ValueError('Guide range must lie within Blender frames 1–360')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.fps=FPS;scene.render.fps_base=1
    scene.eevee.taa_render_samples=args.samples
    scene.frame_start=1;scene.frame_end=COUNT;scene.render.resolution_x=args.width;scene.render.resolution_y=args.width*9//16;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.film_transparent=False
    scene.unit_settings.system='METRIC';scene.view_settings.view_transform='AgX'
    if hasattr(scene.render,'use_motion_blur'):scene.render.use_motion_blur=False
    world=bpy.data.worlds.new('Studio world');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.02,.015,.012,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.25
    M.update(shell=mat('Dark chocolate','#352018',.28,noise=True),groove=mat('Emboss groove','#5C3525',.4),pis=mat('Pistachio','#A9BB82',.55),ras=mat('Raspberry','#A74662',.44),car=mat('Caramel','#CA9558',.2),plum=mat('Plum','#3F1E30',.72),cream=mat('Cream','#F5ECD9',.6),coat=mat('Ivory work jacket','#E7DFCF',.82),skin=mat('Human proxy','#BA8163',.68),hair=mat('Hair proxy','#231710',.82),gold=mat('Brushed gold','#C8A46B',.3,.78),metal=mat('Stainless steel','#B9C0C1',.21,1),nutshell=mat('Pistachio shell','#D4C0A0',.88),black=mat('Black matte','#000000',1))
    M['berry']=mat('Natural raspberry','#861E3B',.52,noise=True)
    for code,hexcode in [('pis','#85975B'),('ras','#93354F'),('car','#AF7236')]:
        material=mat('Dense centre '+code,hexcode,.36 if code!='car' else .23,noise=True)
        nodes=material.node_tree.nodes;links=material.node_tree.links;bs=nodes.get('Principled BSDF')
        tex=nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=75;tex.inputs['Detail'].default_value=3
        ramp=nodes.new('ShaderNodeValToRGB');rgb=linear_colour(hexcode)
        ramp.color_ramp.elements[0].position=.3;ramp.color_ramp.elements[0].color=(*[c*.52 for c in rgb],1)
        ramp.color_ramp.elements[1].position=.66;ramp.color_ramp.elements[1].color=(*rgb,1)
        links.new(tex.outputs['Fac'],ramp.inputs[0]);links.new(ramp.outputs[0],bs.inputs['Base Color'])
        M['filling_'+code]=material
    opening,ending=tunnel();pack=cartons();q=question();m=macro();l=lab();i=ingredients();r=report()
    if not args.full_bleed:
        for c in [pack,m,r]:matte_bars(c)
    camera_overlay(opening,'OPENING_REPORT_TITLE',BASE/'artwork/opening_title.png',0,42)
    camera_overlay(ending,'CLOSING_WONDER_WITHIN',BASE/'artwork/closing_tagline.png',314,360)
    cameras=[opening,pack,pack,pack,q,m,l,i,i,i,r,ending]
    timeline=json.loads((BASE/'shot_timeline.json').read_text())['shots']
    for shot,c in zip(timeline,cameras):
        marker=scene.timeline_markers.new(shot['id']+' '+shot['title'],frame=shot['blender_start']);marker.camera=c
    scene.camera=opening;scene.frame_set(1)
    note=bpy.data.texts.new('READ_ME_FIRST')
    note.write('VELUNE camera/blocking prototype. Exact 360 frames / 24 fps. All dimensions/lenses are proposals. Characters are non-likeness proxies. Spread is a deterministic baked surface and cross-sections are modelled. New title overlays are included. This is a camera animatic, not generated beauty. See production brief and validation report.')
    output=Path(args.output).expanduser().resolve();output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(output))
    stats={'blender_version':bpy.app.version_string,'objects':len(scene.objects),'cameras':len([o for o in scene.objects if o.type=='CAMERA']),'markers':[{'name':x.name,'frame':x.frame,'camera':x.camera.name if x.camera else None} for x in scene.timeline_markers],'frame_count':scene.frame_end-scene.frame_start+1,'fps':scene.render.fps,'note':'Successful execution is not visual approval.'}
    (output.parent/'execution_report.json').write_text(json.dumps(stats,indent=2))
    out=output.parent/'renders';out.mkdir(exist_ok=True)
    if args.render_keyframes:
        kd=out/'keyframes';kd.mkdir(exist_ok=True)
        for n in ([int(x) for x in args.poses.split(',')] if args.poses else POSES):scene.frame_set(n+1);scene.render.filepath=str(kd/f'pose_{n:03}.png');bpy.ops.render.render(write_still=True)
    if args.render_guide:
        gd=out/'guide';gd.mkdir(exist_ok=True);scene.render.filepath=str(gd/'frame_')
        scene.frame_start=args.guide_start;scene.frame_end=args.guide_end
        bpy.ops.render.render(animation=True)
        scene.frame_start=1;scene.frame_end=COUNT
    print('VELUNE blockout saved:',output)

if __name__=='__main__':main()
