import * as THREE from './vendor/three/three.module.mjs';
import {OrbitControls} from './vendor/three/OrbitControls.mjs';
import {el} from './ui.js';
// One WebGL context renders all four panes. Geometry/textures are shared.
export function installDirectorViews(d){
 d.quadView=false;d.focusView='normal';d.hoverView='normal';d.viewPanes={};d.orthoCameras={};d.orthoControls={};
 const target=d.orbit.target.clone(),definitions=[['top','顶视图',[0,12,0],[0,0,-1]],['left','左视图',[-12,0,0],[0,1,0]],['right','右视图',[12,0,0],[0,1,0]],['normal','正常视图',null,null]];
 const normalCamera=()=>d.viewMode==='camera'?d.shotCamera:d.camera;
 d.activeViewCamera=()=>{const name=d.quadView?d.hoverView:d.focusView;return name==='normal'?normalCamera():d.orthoCameras[name]||normalCamera();};
 for(const [name,label,position,up]of definitions){
  const pane=el('div','ic-director-pane');pane.dataset.view=name;pane.ariaLabel=label;pane.append(el('span','',label));d.viewport.append(pane);d.viewPanes[name]=pane;
  if(position){const camera=new THREE.OrthographicCamera(-5,5,5,-5,.01,5000);camera.position.copy(target).add(new THREE.Vector3(...position));camera.up.fromArray(up);camera.lookAt(target);camera.userData.orthographicView=true;camera.userData.viewName=name;d.orthoCameras[name]=camera;const controls=new OrbitControls(camera,pane);controls.enableRotate=false;controls.enableDamping=true;controls.mouseButtons.LEFT=THREE.MOUSE.PAN;controls.mouseButtons.RIGHT=THREE.MOUSE.PAN;controls.target.copy(target);controls.update();d.orthoControls[name]=controls;}
  pane.addEventListener('pointerenter',()=>{d.hoverView=name;for(const [key,item]of Object.entries(d.viewPanes))item.dataset.active=String(key===name);});
  pane.addEventListener('pointerdown',event=>{d.hoverView=name;pane.userDataStart={x:event.clientX,y:event.clientY};});
  pane.addEventListener('pointerup',event=>{const start=pane.userDataStart;pane.userDataStart=null;if(event.button!==0||!start||Math.hypot(start.x-event.clientX,start.y-event.clientY)>4||d.transforming||d.gizmo.dragging||d.gizmo.axis)return;const rect=pane.getBoundingClientRect(),camera=name==='normal'?normalCamera():d.orthoCameras[name];d.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);d.ray.setFromCamera(d.pointer,camera);const hit=d.ray.intersectObjects([...d.objectMap.values()].filter(entity=>entity.visible),true).find(hit=>hit.object.isMesh);d.inspectTab='属性';d.select(hit?.object.userData.objectId);});
 }
 d.orbit.disconnect();d.orbit.connect(d.viewPanes.normal);d.orbit.mouseButtons.LEFT=THREE.MOUSE.ROTATE;d.orbit.mouseButtons.MIDDLE=THREE.MOUSE.DOLLY;d.orbit.mouseButtons.RIGHT=THREE.MOUSE.PAN;d.orbit.enableZoom=true;d.orbit.minDistance=.05;d.orbit.maxDistance=3000;
 d.gizmo.disconnect();d.gizmo.connect(d.viewPanes.normal);
 const resize=d.resize.bind(d);d.resize=()=>{
  const width=d.viewport.clientWidth,height=d.viewport.clientHeight;if(!width||!height)return;
  if(!d.quadView&&d.focusView==='normal'){resize();const rect=d.renderRect;for(const [name,pane]of Object.entries(d.viewPanes)){pane.hidden=name!=='normal';if(name==='normal')Object.assign(pane.style,{left:rect.x+'px',top:rect.y+'px',width:rect.w+'px',height:rect.h+'px'});}d.frame.hidden=false;}
  else{d.renderRect={x:0,y:0,w:width,h:height,width,height};d.renderer.setSize(width,height);Object.assign(d.renderer.domElement.style,{left:'0px',top:'0px'});d.frame.hidden=true;
   const widthHalf=width/2,heightHalf=height/2,parts=d.state.ratio.split(':').map(Number),normalAspect=parts.length===2?parts[0]/parts[1]:width/height;definitions.forEach(([name],index)=>{const pane=d.viewPanes[name];let left=d.quadView?(index%2)*widthHalf:0,top=d.quadView?Math.floor(index/2)*heightHalf:0,w=d.quadView?widthHalf:width,h=d.quadView?heightHalf:height;if(d.quadView&&name==='normal'){const cellW=w,cellH=h;h=w/normalAspect;if(h>cellH){h=cellH;w=h*normalAspect;}left+=(cellW-w)/2;top+=(cellH-h)/2;}pane.hidden=!d.quadView&&name!==d.focusView;pane.viewRect={x:left,y:top,w,h};Object.assign(pane.style,{left:left+'px',top:top+'px',width:w+'px',height:h+'px'});const camera=d.orthoCameras[name];if(camera){const aspect=w/h,extent=5;camera.left=-extent*aspect;camera.right=extent*aspect;camera.top=extent;camera.bottom=-extent;camera.aspect=aspect;camera.updateProjectionMatrix();}});
   if(d.quadView){for(const camera of [d.camera,d.shotCamera]){camera.aspect=normalAspect;camera.updateProjectionMatrix();}}
  }
  for(const [name,controls]of Object.entries(d.orthoControls))controls.enabled=d.quadView||d.focusView===name;
  d.orbit.enabled=(d.quadView||d.focusView==='normal')&&d.viewMode==='director'&&!d.transforming;d.gizmo.enabled=d.orbit.enabled&&!!d.gizmo.object;d.gizmo.getHelper().visible=d.gizmo.enabled;
 };
 d.toggleFourViews=()=>{if(d.quadView){d.quadView=false;d.focusView=d.hoverView||'normal';}else{d.quadView=true;}d.resize();d.hint.textContent=d.quadView?'四视图 · 鼠标停在目标视图上，再按快捷键放大该视图':'当前：'+definitions.find(([name])=>name===d.focusView)[1]+' · 再按快捷键回到四视图';d.draw();};
 const select=d.select.bind(d);d.select=id=>{select(id);const enabled=(d.quadView||d.focusView==='normal')&&d.viewMode==='director'&&!!d.gizmo.object;d.gizmo.enabled=enabled;d.gizmo.getHelper().visible=enabled;};d.viewPanes.normal.addEventListener('pointerleave',()=>{if(!d.gizmo.dragging)d.gizmo.axis=null;});
 const setView=d.setView.bind(d);d.setView=mode=>{if(!d.quadView)d.focusView='normal';d.hoverView='normal';setView(mode);d.resize();};
 const wireMaterial=new THREE.MeshBasicMaterial({color:0xabc9dc,wireframe:true});d.prepareView=camera=>{if(!camera.userData.orthographicView)return()=>{};const saved=[],materials=[],gridRotation=d.grid.rotation.clone();if(['left','right'].includes(camera.userData.viewName))d.grid.rotation.z=Math.PI/2;const hide=object=>{if(object){saved.push([object,object.visible]);object.visible=false;}};hide(d.panorama);hide(d.ground);hide(d.gizmo.getHelper());hide(d.marker);hide(d.cameraFrame);for(const entity of d.objectMap.values())entity.traverse(child=>{if(child.userData.label)hide(child);});d.scene.traverse(child=>{if(child.isMesh){materials.push([child,child.material]);child.material=wireMaterial;}});return()=>{d.grid.rotation.copy(gridRotation);for(const [mesh,material]of materials)mesh.material=material;for(const [object,visible]of saved)object.visible=visible;};};
 const draw=d.draw.bind(d);d.draw=()=>{
  if(!d.quadView&&d.focusView==='normal')return draw();const width=d.viewport.clientWidth,height=d.viewport.clientHeight;d.renderer.setRenderTarget(null);d.renderer.setScissorTest(false);d.renderer.setViewport(0,0,width,height);d.renderer.clear();
  for(const [name,pane]of Object.entries(d.viewPanes)){if(pane.hidden)continue;const rect=pane.viewRect,camera=name==='normal'?normalCamera():d.orthoCameras[name];const restore=d.prepareView(camera);try{d.renderer.setScissorTest(true);d.renderer.setScissor(rect.x,height-rect.y-rect.h,rect.w,rect.h);d.renderer.setViewport(rect.x,height-rect.y-rect.h,rect.w,rect.h);d.renderer.render(d.scene,camera);}finally{restore();}}
  d.renderer.setScissorTest(false);
 };
 const tick=d.tick.bind(d);d.tick=time=>{for(const controls of Object.values(d.orthoControls))if(controls.enabled)controls.update();tick(time);};
 const dispose=d.dispose.bind(d);d.dispose=()=>{for(const controls of Object.values(d.orthoControls))controls.dispose();wireMaterial.dispose();dispose();};
 d.resize();
}
