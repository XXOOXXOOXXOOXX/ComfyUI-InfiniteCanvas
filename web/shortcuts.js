export const actions={
 save:['保存画布','Ctrl+S','global'],undo:['回退画布内容','Ctrl+Z','canvas'],selectText:['全选节点文字','Ctrl+A','canvas'],copy:['复制节点','Ctrl+C','canvas'],paste:['粘贴节点','Ctrl+V','canvas'],remove:['删除选中节点','Delete','canvas'],removeBackward:['删除节点（退格）','Backspace','canvas'],cancel:['取消工具 / 关闭窗口','Escape','canvas'],fit:['适应选中 / 全部节点','Z','canvas'],cut:['小刀断线','C','canvas'],rectangle:['矩形框选','B','canvas'],ellipse:['圆形框选','E','canvas'],polygon:['多边形框选','P','canvas'],
 fourViews:['四视图 / 当前视图','Alt+W','director'],move:['移动对象','W','director'],rotate:['旋转对象','R','director'],scale:['缩放对象','S','director'],removeObject:['删除 3D 对象','Delete','director'],closeDirector:['关闭导演台','Escape','director']
};
export function chord(event){const raw=event.key;if(!raw||['Control','Meta','Alt','Shift','Unidentified'].includes(raw)||event.isComposing)return '';const key=raw===' '?'Space':raw.length===1?raw.toUpperCase():raw;return[(event.ctrlKey||event.metaKey)&&'Ctrl',event.altKey&&'Alt',event.shiftKey&&'Shift',key].filter(Boolean).join('+');}
export class Shortcuts{
 constructor(storage=globalThis.localStorage){this.storage=storage;this.values={};try{this.values=JSON.parse(storage?.getItem('infinite-canvas.shortcuts.v1')||'{}');}catch{}}
 get(action){return this.values[action]||actions[action]?.[1]||'';}
 matches(event,action){return chord(event)===this.get(action);}
 find(event,scope){return Object.keys(actions).find(action=>(actions[action][2]===scope||actions[action][2]==='global')&&this.matches(event,action));}
 set(action,value){if(!actions[action]||!value)return;const conflict=Object.keys(actions).find(other=>other!==action&&(actions[other][2]===actions[action][2]||actions[other][2]==='global'||actions[action][2]==='global')&&this.get(other)===value);if(conflict)throw Error('与「'+actions[conflict][0]+'」重复，请先修改它的快捷键。');this.values[action]=value;this.persist();}
 reset(){this.values={};this.persist();}
 persist(){try{this.storage?.setItem('infinite-canvas.shortcuts.v1',JSON.stringify(this.values));}catch{}}
}
