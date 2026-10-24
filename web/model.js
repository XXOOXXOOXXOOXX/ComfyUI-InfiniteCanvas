import {uid} from "./groups.js";
export const newBoard=(name="未命名画布")=>({version:1,id:uid(),name,nodes:[],links:[],assets:{},view:{x:100,y:90,scale:1},styles:[{id:uid(),title:"真实摄影",text:"真实摄影，自然光线，细腻材质，丰富细节。"},{id:uid(),title:"柔和室内",text:"保留原有空间结构，柔和自然日光，真实材质，宁静的室内氛围。"},{id:uid(),title:"电影质感",text:"电影镜头，柔和光影，细致色彩分级，富有层次。"}]});
export function newNode(kind,x=0,y=0){return{id:uid(),kind,x,y,w:kind==="asset"?460:400,h:kind==="ollama"||kind==="text"?280:300,title:({asset:"素材",ollama:"Ollama 文本",text:"ComfyUI 文本",image:"图片",video:"视频",director:"导演台",script:"脚本",audio:"音频"})[kind],prompt:"",text:"",assetIds:[],group:null,bindings:{},count:1};}
export function linkNodes(board,from,to){
    if(from===to||board.links.some(link=>link.from===from&&link.to===to))return false;
    if(!board.nodes.some(node=>node.id===from)||!board.nodes.some(node=>node.id===to))throw Error("节点不存在。");
    const visit=(id,seen=new Set())=>{if(id===from)return true;if(seen.has(id))return false;seen.add(id);return board.links.filter(link=>link.from===id).some(link=>visit(link.to,seen));};
    if(visit(to))throw Error("这条连线会形成循环，请连接到下游节点。");
    board.links.push({id:uid(),from,to});return true;
}
export function inputs(board,node){return board.links.filter(link=>link.to===node.id).map(link=>board.nodes.find(item=>item.id===link.from)).filter(Boolean);}
export function references(board,node){const seen=new Set();return [...inputs(board,node).flatMap(item=>item.assetIds||[]),...(node.references||[])].filter(id=>board.assets[id]&&!seen.has(id)&&seen.add(id)).map(id=>board.assets[id]);}
export function inputText(board,node){return inputs(board,node).filter(item=>["text","ollama"].includes(item.kind)&&item.text).map(item=>item.text).join("\n\n");}
export function removeNode(board,id){board.nodes=board.nodes.filter(node=>node.id!==id);board.links=board.links.filter(link=>link.from!==id&&link.to!==id);}
export function validateBoard(board){
    if(!board||board.version!==1||!Array.isArray(board.nodes)||!Array.isArray(board.links)||!board.assets||!/^[a-f0-9]{32}$/.test(board.id))throw Error("请选择无限画布导出的 JSON 文件。");
    const ids=new Set();for(const node of board.nodes){if(!/^[a-f0-9]{32}$/.test(node.id)||ids.has(node.id)||!["asset","ollama","text","image","video","director","audio","script"].includes(node.kind)||![node.x,node.y,node.w,node.h].every(Number.isFinite))throw Error("画布节点格式无效。");ids.add(node.id);node.w=Math.max(220,node.w);node.h=Math.max(160,node.h);}
    const links=board.links;board.links=[];for(const link of links)linkNodes(board,link.from,link.to);
    board.view||={x:100,y:90,scale:1};board.view.scale=Math.max(.15,Math.min(3,Number(board.view.scale)||1));board.styles||=[];return board;
}
export const kindFor=name=>/\.(mp4|webm|mov|mkv|gif)$/i.test(name)?"video":/\.(mp3|wav|ogg|flac|m4a)$/i.test(name)?"audio":"image";
export function collectOutputs(outputs){
    const assets=[],texts=[],seen=new Set();
    const walk=(item,key="",depth=0)=>{
        if(depth>10||item==null)return;
        if(Array.isArray(item)){for(const child of item)walk(child,key,depth+1);return;}
        if(typeof item==="string"){if(["text","texts","string"].includes(key)&&!texts.includes(item))texts.push(item);return;}
        if(typeof item!=="object")return;
        if(typeof item.filename==="string"&&item.filename&&!item.filename.includes("://")){
            const ref={filename:item.filename,subfolder:item.subfolder||"",type:["input","output","temp"].includes(item.type)?item.type:"output"};const signature=JSON.stringify(ref);
            if(!seen.has(signature)){seen.add(signature);assets.push({id:uid(),name:item.filename,kind:kindFor(item.filename),ref});}return;
        }
        for(const [name,child]of Object.entries(item))if(!["prompt","workflow","extra_data"].includes(name))walk(child,name,depth+1);
    };walk(outputs);return{assets,text:texts.join("\n\n")};
}
export const modelCapabilities=model=>{const caps=new Set(model.capabilities||[]);return[["completion","文字"],["vision","图像"],["video","视频"],["audio","音频"],["audio_input","音频"]].filter(([key])=>caps.has(key)).map(([,label])=>label).filter((label,index,list)=>list.indexOf(label)===index).join(" / ");};
export const fileSize=size=>size?size>=1024**3?(size/1024**3).toFixed(1)+" GB":(size/1024**2).toFixed(1)+" MB":"";
export function videoTimes(duration){const length=Number.isFinite(duration)&&duration>0?duration:0,count=Math.min(8,Math.max(1,Math.ceil(length)));return Array.from({length:count},(_,index)=>Math.max(0,Math.min(Math.max(0,length-.05),length*index/count)));}
