// Keep project names, folders, covers and viewport navigation outside undo.
const keys=["nodes","links","assets","styles"];
export const contentOf=board=>Object.fromEntries(keys.map(key=>[key,board[key]]));
export class ContentHistory{
    constructor(board,limit=50){this.limit=limit;this.entries=[];this.current=JSON.stringify(contentOf(board));this.group=null;}
    record(board,group=null){const next=JSON.stringify(contentOf(board));if(next===this.current)return false;if(!group||group!==this.group)this.entries.push(this.current);this.current=next;this.group=group;this.trim();return true;}
    trim(){this.entries.splice(0,Math.max(0,this.entries.length-this.limit));}
    breakGroup(){this.group=null;}
    undo(board){if(!this.entries.length)return false;const state=JSON.parse(this.entries.pop());for(const key of keys)board[key]=state[key];this.current=JSON.stringify(contentOf(board));this.group=null;return true;}
}
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
export function segmentsCross(a,b,c,d){
    const epsilon=1e-6;if(Math.max(a.x,b.x)+epsilon<Math.min(c.x,d.x)||Math.max(c.x,d.x)+epsilon<Math.min(a.x,b.x)||Math.max(a.y,b.y)+epsilon<Math.min(c.y,d.y)||Math.max(c.y,d.y)+epsilon<Math.min(a.y,b.y))return false;
    return cross(a,b,c)*cross(a,b,d)<=epsilon&&cross(c,d,a)*cross(c,d,b)<=epsilon;
}
