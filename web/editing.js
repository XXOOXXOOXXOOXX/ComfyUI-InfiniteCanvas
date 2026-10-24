import {el,control} from "./ui.js";
import {ContentHistory,segmentsCross} from "./content_history.js";
const SETTINGS="infinite-canvas.editing.v1";
const inputTarget=target=>target?.closest?.("input,textarea,select,[contenteditable]");
const svg=(tag,attributes={})=>{const item=document.createElementNS("http://www.w3.org/2000/svg",tag);for(const [key,value]of Object.entries(attributes))item.setAttribute(key,value);return item;};
export function installEditing(ui){
    let saved={};try{saved=JSON.parse(localStorage.getItem(SETTINGS)||"{}");}catch{}
    ui.undoLimit=Number.isInteger(saved.undoLimit)?Math.max(1,Math.min(500,saved.undoLimit)):50;
    ui.contentHistories=new Map();
    const history=()=>{if(!ui.board)return null;let value=ui.contentHistories.get(ui.board.id);if(!value){value=new ContentHistory(ui.board,ui.undoLimit);ui.contentHistories.set(ui.board.id,value);}return value;};
    const load=ui.load.bind(ui);ui.load=(board,dirty)=>{ui.endCut?.();ui.setCutMode(false);load(board,dirty);const entry=history();entry.current=JSON.stringify({nodes:board.nodes,links:board.links,assets:board.assets,styles:board.styles});entry.breakGroup();};
    const changed=ui.changed.bind(ui);ui.changed=()=>{history()?.record(ui.board,ui.inputHistoryKey);changed();};
    ui.shell.addEventListener("input",event=>{ui.inputHistoryKey=event.target;queueMicrotask(()=>ui.inputHistoryKey=null);},true);
    ui.shell.addEventListener("focusout",()=>history()?.breakGroup(),true);
    ui.undoContent=()=>{
        if(!ui.board)return;
        if(ui.board.nodes.some(node=>ui.controllers.has(node.id))||[...ui.runner.jobs.values()].some(job=>job.board===ui.board.id&&!job.finished)){ui.notice("请先停止当前画布的生成任务，再撤销。",true);return;}
        ui.endGesture?.();ui.endCut?.();ui.endConnection?.();ui.closeDialog();ui.closeMenu();
        if(!history()?.undo(ui.board)){ui.notice("没有可回退的画布操作。");return;}
        ui.closeEditor();if(!ui.board.nodes.some(node=>node.id===ui.selected))ui.selected=null;
        changed();ui.render();ui.notifySelection(ui.board.nodes.find(node=>node.id===ui.selected)||null);ui.notice(`已回退上一步 · 剩余 ${history().entries.length} 步`);
    };
    ui.settings=()=>{const {body}=ui.dialog("设置"),label=el("label","ic-setting","回退步数上限"),input=el("input");input.type="number";input.min=1;input.max=500;input.value=ui.undoLimit;input.ariaLabel="回退步数上限";
        const apply=()=>{ui.undoLimit=Math.max(1,Math.min(500,Math.round(Number(input.value)||50)));input.value=ui.undoLimit;for(const entry of ui.contentHistories.values()){entry.limit=ui.undoLimit;entry.trim();}try{localStorage.setItem(SETTINGS,JSON.stringify({undoLimit:ui.undoLimit}));}catch{}};
        input.addEventListener("change",apply);input.addEventListener("keydown",event=>{if(event.key==="Enter"){apply();ui.closeDialog();}});label.append(input);body.append(label,el("p","ic-muted","默认 50 步，可设置 1–500 步。只回退节点、文字、连线和素材等画布内容，画布名称与视图位置保留。"));ui.dialogDispose=apply;
    };
    const nav=ui.projectNav;ui.projectNav=event=>{nav(event);ui.popup.append(el("hr"),control("设置","设置",()=>{ui.closeMenu();ui.settings();}));};
    ui.textDisplay=node=>{
        const text=el("textarea","ic-card-text");text.value=node.text||"";text.ariaLabel="文本内容 "+node.title;text.placeholder="双击预览和编辑文本";text.spellcheck=false;text.readOnly=ui.controllers.has(node.id);text.title="可直接编辑 · 双击打开大窗口";
        text.addEventListener("input",()=>{node.text=text.value;node.textEdited=true;ui.changed();ui.notifySelection(node);});
        text.addEventListener("pointerdown",event=>event.stopPropagation());
        text.addEventListener("dblclick",event=>{event.stopPropagation();ui.textDialog(node,"text");});return text;
    };
    ui.textDialog=(node,key="text",label="文本预览与编辑")=>{
        const board=ui.board;if(!board?.nodes.includes(node))return;
        const {body}=ui.dialog(label,"ic-text-dialog"),text=el("textarea","ic-text-editor"),hint=el("p","ic-muted","关闭窗口或点击窗口外部，即保存修改。");text.ariaLabel="预览编辑文本";text.value=node[key]||"";text.spellcheck=false;text.readOnly=key==="text"&&ui.controllers.has(node.id);
        const apply=()=>{if(text.readOnly||node[key]===text.value)return;node[key]=text.value;if(key==="text")node.textEdited=true;ui.changed();ui.notifySelection(node);};text.addEventListener("input",apply);
        const clear=control("清空此文本","清空文本",()=>{text.value="";apply();text.focus();});clear.disabled=text.readOnly;body.append(text,el("div","ic-text-dialog-footer"));body.lastChild.append(hint,clear);
        ui.dialogDispose=()=>{apply();history()?.breakGroup();if(ui.board===board){ui.render();if(ui.editorNode)ui.edit(ui.editorNode);const save=()=>{if(ui.board!==board||!ui.root.isConnected)return;if(ui.saving){ui.textSaveTimer=setTimeout(save,60);return;}if(ui.dirty)ui.save();};clearTimeout(ui.textSaveTimer);save();}};text.focus();
    };
    const edit=ui.edit.bind(ui);ui.edit=node=>{edit(node);for(const text of ui.editor?.querySelectorAll("textarea")||[]){text.addEventListener("dblclick",event=>{event.stopPropagation();if(text.ariaLabel==="节点提示词")ui.textDialog(node,"prompt","提示词预览与编辑");});}};
    ui.updateTextCard=node=>{const card=[...ui.cards.children].find(card=>card.dataset.id===node.id);if(!card)return;let text=card.querySelector("textarea.ic-card-text");if(!text)card.querySelector(".ic-card-body").replaceChildren(text=ui.textDisplay(node));text.value=node.text;};
    ui.disconnectLinks=ids=>{const count=ui.board.links.length;ui.board.links=ui.board.links.filter(link=>!ids.has(link.id));if(count===ui.board.links.length)return false;ui.lines();return true;};
    ui.afterDisconnect=()=>{ui.changed();if(ui.editorNode)ui.edit(ui.editorNode);ui.notice("连接线已断开 · Ctrl+Z 可恢复");};
    ui.lines=()=>{
        ui.wires.replaceChildren();if(!ui.board)return;const scale=ui.board.view.scale;
        for(const link of ui.board.links){const from=ui.board.nodes.find(node=>node.id===link.from),to=ui.board.nodes.find(node=>node.id===link.to);if(!from||!to)continue;
            const path=ui.line(from.x+from.w+20,from.y+from.h/2,to.x-20,to.y+to.h/2);path.classList.add("ic-wire");path.dataset.link=link.id;
            const hit=svg("path",{d:path.getAttribute("d"),class:"ic-wire-hit",tabindex:0,role:"button","aria-label":"双击断开连接线"});hit.style.strokeWidth="16px";
            const remove=event=>{event.preventDefault();event.stopPropagation();if(ui.disconnectLinks(new Set([link.id])))ui.afterDisconnect();};hit.addEventListener("pointerdown",event=>event.stopPropagation());hit.addEventListener("dblclick",remove);hit.addEventListener("keydown",event=>{if(["Delete","Backspace","Enter"].includes(event.key))remove(event);});ui.wires.append(hit);
            const middle=path.getPointAtLength(path.getTotalLength()/2),cross=svg("g",{class:"ic-wire-remove",transform:`translate(${middle.x} ${middle.y}) scale(${1/scale})`,tabindex:0,role:"button","aria-label":"断开连接线"});cross.append(svg("circle",{r:9}),svg("path",{d:"M-3 -3 3 3M3 -3-3 3"}));cross.addEventListener("pointerdown",event=>event.stopPropagation());cross.addEventListener("click",remove);cross.addEventListener("dblclick",event=>event.stopPropagation());cross.addEventListener("keydown",event=>{if(["Enter"," ","Delete"].includes(event.key))remove(event);});ui.wires.append(cross);
        }
    };
    const cutterIcon=svg("svg",{viewBox:"0 0 24 24",width:22,height:22,"aria-hidden":true});cutterIcon.append(svg("path",{d:"M2 18h8m4 0h8",fill:"none",stroke:"currentColor","stroke-dasharray":"2 2"}),svg("path",{d:"m7 14 7-10 5 4-9 8-3-2Zm7-10 2-2 5 4-2 2",fill:"none",stroke:"currentColor","stroke-width":1.6}));
    ui.cutButton=control("小刀断线 C","",()=>ui.setCutMode(!ui.cutMode),"ic-cut-button");ui.cutButton.append(cutterIcon);ui.tools.append(ui.cutButton);
    ui.setCutMode=enabled=>{ui.endCut?.();ui.endGesture?.();ui.endConnection?.();ui.cutMode=!!enabled;ui.cutButton.setAttribute("aria-pressed",String(ui.cutMode));ui.stage.classList.toggle("ic-cut-mode",ui.cutMode);if(enabled){ui.closeMenu();ui.notice("小刀已开启 · 按住左键划过连接线 · C 或 Esc 退出");}};ui.setCutMode(false);
    const cut=event=>{
        if(!ui.cutMode||event.button!==0||!ui.board)return;event.preventDefault();event.stopImmediatePropagation();ui.endCut?.();ui.closeMenu();
        const board=ui.board,trail=svg("path",{class:"ic-cut-trail"}),paths=[...ui.wires.querySelectorAll(".ic-wire[data-link]")].map(path=>{const length=path.getTotalLength(),steps=Math.max(8,Math.ceil(length*board.view.scale/6));return{id:path.dataset.link,points:Array.from({length:steps+1},(_,index)=>path.getPointAtLength(length*index/steps))};});
        ui.wires.append(trail);let previous=ui.point(event),d=`M${previous.x} ${previous.y}`,removed=false;const ids=new Set();
        const move=current=>{if(current.pointerId!==event.pointerId||ui.board!==board)return;const point=ui.point(current);for(const path of paths){if(ids.has(path.id))continue;for(let index=1;index<path.points.length;index++)if(segmentsCross(previous,point,path.points[index-1],path.points[index])){ids.add(path.id);break;}}if(ids.size){removed=ui.disconnectLinks(ids)||removed;ui.wires.append(trail);}d+=` L${point.x} ${point.y}`;trail.setAttribute("d",d);previous=point;};
        const end=()=>{removeEventListener("pointermove",move,true);removeEventListener("pointerup",end,true);removeEventListener("pointercancel",end,true);removeEventListener("blur",end);trail.remove();ui.endCut=null;if(removed)ui.afterDisconnect();};ui.endCut=end;addEventListener("pointermove",move,true);addEventListener("pointerup",end,true);addEventListener("pointercancel",end,true);addEventListener("blur",end);
    };ui.stage.addEventListener("pointerdown",cut,true);
    for(const type of ["click","dblclick"])ui.stage.addEventListener(type,event=>{if(ui.cutMode){event.preventDefault();event.stopImmediatePropagation();}},true);
    const key=event=>{
        if(ui.shell.hidden||ui.directorActive)return;const key=event.key.toLowerCase(),modifier=event.ctrlKey||event.metaKey;
        if(modifier&&key==="z"){event.preventDefault();event.stopImmediatePropagation();if(!event.shiftKey)ui.undoContent();return;}
        if(modifier&&key==="a"&&!inputTarget(event.target)&&!ui.overlay){event.preventDefault();event.stopImmediatePropagation();const text=ui.cards.querySelector(`.ic-card[data-id="${ui.selected}"] textarea.ic-card-text`);if(text){text.focus();text.select();}return;}
        if(!modifier&&!event.altKey&&!inputTarget(event.target)&&!ui.overlay&&key==="c"){event.preventDefault();event.stopImmediatePropagation();ui.setCutMode(!ui.cutMode);return;}
        if(event.key==="Escape"&&ui.cutMode){event.preventDefault();event.stopImmediatePropagation();ui.setCutMode(false);}
    };
    // Run our scoped shortcuts before the original Escape/Delete handler.
    removeEventListener("keydown",ui.onKey,true);addEventListener("keydown",key,true);addEventListener("keydown",ui.onKey,true);
    const close=ui.close.bind(ui);ui.close=()=>{ui.setCutMode(false);close();};const destroy=ui.destroy.bind(ui);ui.destroy=()=>{ui.endCut?.();removeEventListener("keydown",key,true);destroy();clearTimeout(ui.textSaveTimer);};
}
