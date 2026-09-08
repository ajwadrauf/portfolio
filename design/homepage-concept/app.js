(async () => {
  const root = document.getElementById('ajwad-home');
  if (!root) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const video = root.querySelector('#ar-film-video');
  const bigPlay = root.querySelector('#ar-film-start');
  const toggle = root.querySelector('#ar-film-toggle');
  const scrub = root.querySelector('#ar-film-scrub');
  const time = root.querySelector('#ar-film-time');
  const fmt = (n) => '00:' + Math.floor(n || 0).toString().padStart(2,'0');
  function videoState() {
    bigPlay.hidden = !video.paused;
    toggle.textContent = video.paused ? (video.ended ? 'Replay ↻' : 'Play ▷') : 'Pause Ⅱ';
    toggle.setAttribute('aria-label', video.paused ? 'Play film' : 'Pause film');
    scrub.value = video.currentTime;
    time.textContent = fmt(video.currentTime) + ' / 00:12';
  }
  async function playFilm() {
    if (!video.paused) { video.pause(); return; }
    if (video.ended) video.currentTime = 0;
    try { await video.play(); } catch { video.controls = true; }
  }
  bigPlay.addEventListener('click', playFilm);
  toggle.addEventListener('click', playFilm);
  video.addEventListener('click', playFilm);
  ['play','pause','ended','timeupdate'].forEach(e=>video.addEventListener(e,videoState));
  scrub.addEventListener('input',()=>{video.currentTime=Number(scrub.value);videoState();});
  root.querySelector('#ar-fullscreen').addEventListener('click',async()=>{
    try { if(video.requestFullscreen) await video.requestFullscreen(); else if(video.webkitEnterFullscreen) video.webkitEnterFullscreen(); } catch { video.controls=true; }
  });
  root.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
    const target=root.querySelector(a.getAttribute('href'));
    if(target){e.preventDefault();target.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});}
  }));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting&&!video.paused)video.pause();}),{threshold:0.08}).observe(video);
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();});

  const assemblyButton=root.querySelector('#ar-assemble');
  const canvas=root.querySelector('#ar-tokens');
  const sculpture=root.querySelector('.ar-sculpture');
  const status=root.querySelector('#ar-3d-status');
  let THREE;
  try { THREE = await import('./vendor/three.module.js'); }
  catch { status.textContent='800 tokens · TOKEN motion study';assemblyButton.hidden=true;return; }
  let renderer;
  try {renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'});}
  catch {status.textContent='3D preview unavailable · watch the film below';assemblyButton.hidden=true;return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.95;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(34,1,0.1,60);
  camera.position.set(0,0,6.6);
  const group=new THREE.Group();scene.add(group);
  scene.add(new THREE.HemisphereLight(0xfff8ec,0x40463f,3.1));
  for(const [color,power,pos] of [[0xfff3e5,5,[3,4,5]],[0xffffff,4,[-4,2,1]],[0xbda9c7,3,[2,-1,-3]]]){
    const light=new THREE.DirectionalLight(color,power);light.position.set(...pos);scene.add(light);
  }
  // Procedural studio environment: broad light panels give the metal its shape.
  const envCanvas=document.createElement('canvas');envCanvas.width=512;envCanvas.height=256;
  const envContext=envCanvas.getContext('2d');envContext.fillStyle='#73736e';envContext.fillRect(0,0,512,256);
  envContext.fillStyle='#f7f3ec';envContext.fillRect(40,22,85,200);envContext.fillRect(280,0,140,70);
  envContext.fillStyle='#222725';envContext.fillRect(210,80,36,176);
  const envTexture=new THREE.CanvasTexture(envCanvas);envTexture.mapping=THREE.EquirectangularReflectionMapping;
  const pmrem=new THREE.PMREMGenerator(renderer);const environment=pmrem.fromEquirectangular(envTexture);
  scene.environment=environment.texture;envTexture.dispose();pmrem.dispose();
  const n=800;
  const geometry=new THREE.BoxGeometry(0.105,0.052,0.074);
  const material=new THREE.MeshStandardMaterial({color:0xffffff,metalness:.82,roughness:.24});
  const tokens=new THREE.InstancedMesh(geometry,material,n);tokens.instanceMatrix.setUsage(THREE.DynamicDrawUsage);tokens.frustumCulled=false;group.add(tokens);
  const dummy=new THREE.Object3D();
  const helix=[],word=[];
  const positions=window.TOKEN_WORDMARK || [];
  const xs=positions.map(p=>p[0]),ys=positions.map(p=>p[1]);
  const centerX=positions.length?(Math.min(...xs)+Math.max(...xs))/2:0;
  const centerY=positions.length?(Math.min(...ys)+Math.max(...ys))/2:0;
  const wordScale=positions.length?4.2/(Math.max(...xs)-Math.min(...xs)):1;
  for(let i=0;i<n;i++){
    const ring=Math.floor(i/32),j=i%32;
    const a=j/32*Math.PI*2+ring*.045;
    const t=(ring/24-.5)*Math.PI*1.8;
    // A folded, open ribbon, rather than a loading-spinner torus.
    const radius=1.08+.16*Math.cos(t*2);
    const x=Math.cos(a)*radius, y=(ring-12)*.069, z=Math.sin(a)*radius;
    helix.push({x:x*Math.cos(t*.32)-y*Math.sin(t*.32),y:x*Math.sin(t*.32)+y*Math.cos(t*.32),z:z*.7,rx:t*.38,ry:-a,rz:t*.32});
    const p=positions[i];word.push(p?{x:(p[0]-centerX)*wordScale,y:(p[1]-centerY)*wordScale,z:(i%3-1)*.008}:{x:(i%40-20)*.1,y:(Math.floor(i/40)-10)*.1,z:0});
    const accent = i%97<8;
    tokens.setColorAt(i,new THREE.Color(accent?0x754364:(i%41<4?0xa0814f:0x596352)));
  }
  tokens.instanceColor.needsUpdate=true;
  const size=()=>{const box=canvas.parentElement.getBoundingClientRect();if(box.width&&box.height){renderer.setSize(box.width,box.height,false);camera.aspect=box.width/box.height;camera.updateProjectionMatrix();draw(performance.now());}};
  let assembled=false,progress=0,targetProgress=0,visible=true,raf=0,previousTime=0;
  let drag=false,startX=0,startY=0,rx=-.38,ry=-.46,wantRx=-.38,wantRy=-.46;
  const lerp=THREE.MathUtils.lerp;
  let initialRotation=performance.now();
  function draw(now){
    raf=0;
    const dt=Math.min(.05,Math.max(.001,(now-previousTime)/1000));previousTime=now;
    progress=reduced?targetProgress:lerp(progress,targetProgress,1-Math.exp(-dt*5));
    if(Math.abs(progress-targetProgress)<.0005)progress=targetProgress;
    const ease=progress*progress*(3-2*progress);
    rx=lerp(rx,wantRx,1-Math.exp(-dt*8));ry=lerp(ry,wantRy,1-Math.exp(-dt*8));
    group.rotation.set(rx*(1-ease),ry*(1-ease),-.27*(1-ease));
    if(!reduced&&!assembled&&!drag&&now-initialRotation<4500)group.rotation.y+=Math.sin((now-initialRotation)/4500*Math.PI)*.12;
    for(let i=0;i<n;i++){
      const a=helix[i],b=word[i];
      dummy.position.set(lerp(a.x,b.x,ease),lerp(a.y,b.y,ease),lerp(a.z,b.z,ease));
      dummy.rotation.set(a.rx*(1-ease),a.ry*(1-ease),a.rz*(1-ease));
      dummy.scale.setScalar(lerp(1,.36,ease));dummy.updateMatrix();tokens.setMatrixAt(i,dummy.matrix);
    }
    tokens.instanceMatrix.needsUpdate=true;renderer.render(scene,camera);
    const changing=progress!==targetProgress||Math.abs(rx-wantRx)>.0001||Math.abs(ry-wantRy)>.0001||(!reduced&&!assembled&&now-initialRotation<4500);
    if(visible&&!document.hidden&&changing)raf=requestAnimationFrame(draw);
  }
  function requestDraw(){if(!raf&&visible&&!document.hidden)raf=requestAnimationFrame(draw);}
  function assemble(){assembled=!assembled;targetProgress=assembled?1:0;assemblyButton.setAttribute('aria-pressed',String(assembled));assemblyButton.innerHTML=assembled?'Explore again <span aria-hidden="true">↻</span>':'Assemble <span aria-hidden="true">↗</span>';status.textContent=assembled?'800 tokens · one signature':'Drag to explore · real-time 3D';initialRotation=-10000;requestDraw();}
  assemblyButton.addEventListener('click',assemble);
  canvas.addEventListener('pointerdown',e=>{if(assembled)return;drag=true;startX=e.clientX;startY=e.clientY;canvas.setPointerCapture(e.pointerId);initialRotation=-10000;});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;wantRy+=(e.clientX-startX)*.009;wantRx=THREE.MathUtils.clamp(wantRx+(e.clientY-startY)*.008,-1.5,1.5);startX=e.clientX;startY=e.clientY;requestDraw();});
  ['pointerup','pointercancel','lostpointercapture'].forEach(e=>canvas.addEventListener(e,()=>{drag=false;}));
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();status.textContent='3D paused · watch the film below';});
  if('ResizeObserver' in window)new ResizeObserver(size).observe(canvas.parentElement);else window.addEventListener('resize',size);
  if('IntersectionObserver' in window)new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible)requestDraw();else if(raf){cancelAnimationFrame(raf);raf=0;}},{threshold:0}).observe(canvas);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestDraw();else if(raf){cancelAnimationFrame(raf);raf=0;}});
  sculpture.classList.add('ready');size();requestDraw();
})();
