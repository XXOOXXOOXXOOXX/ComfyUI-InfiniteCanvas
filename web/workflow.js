import {uid,workflowInfo,graphGroups,groupRef,resolveGroup,members,buildPlan} from "./groups.js";
import {collectOutputs} from "./model.js";
export {workflowInfo,groupRef,resolveGroup,members};
const className=node=>node.comfyClass||node.type;
export function groupsFor(app,kind){
    const graph=workflowInfo(app).graph,pattern=kind==="image"?/^(图片|图像|image)[/／:：\s]/i:kind==="video"?/^(视频|video)[/／:：\s]/i:/^(文本|文字|text)[/／:：\s]/i;
    return [...graphGroups(graph)].filter(group=>pattern.test(group.title||"")).map(group=>({group,ref:groupRef(graph,group),label:group.title.replace(pattern,"")}));
}
export function groupNotes(graph,group){return members(graph,group).filter(node=>className(node)==="InfiniteCanvasNote").map(node=>String(node.widgets?.find(widget=>widget.name==="text")?.value||"")).filter(Boolean).join("\n\n");}
export function textBindings(graph,group){
    return members(graph,group).filter(node=>className(node)!=="InfiniteCanvasNote").flatMap(node=>(node.widgets||[]).filter(widget=>typeof widget.value==="string"&&(widget.options?.multiline||["text","prompt","positive","negative","instruction"].includes(widget.name))&&!/settings|sources|state/.test(widget.name)).map(widget=>({key:node.id+":"+widget.name,id:String(node.id),name:widget.name,label:(node.title||className(node))+" · "+widget.name,value:widget.value})));
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export class WorkflowRunner{
    constructor({app,api,request,onChange=()=>{}}){Object.assign(this,{app,api,request,onChange});this.session=uid();this.jobs=new Map();this.lock=false;}
    async definitions(){return this.defs||=(this.api.getNodeDefs?await this.api.getNodeDefs():await(await this.api.fetchApi("/object_info")).json());}
    async run(node,board,prompt,assets){
        if(this.lock)throw Error("已有一个画布分组任务正在运行，请等待完成或取消。");
        const info=workflowInfo(this.app);if(node.workflow&&node.workflow!==info.identity)throw Error("请切换回创建此节点时的 ComfyUI 工作流，或重新选择分组。");
        const group=resolveGroup(info.graph,node.group);if(!group)throw Error("分组不存在，请重新选择当前工作流中的框。");
        const job={id:uid(),node:node.id,board:board.id,info,state:"准备",done:0,total:Math.max(1,Math.min(1000,Math.round(Number(node.count)||1))),cancelled:false};this.jobs.set(node.id,job);this.lock=true;this.onChange(job);
        try{
            const definitions=await this.definitions(),context=await this.request("/context"),results=[];let text="";
            const check=()=>{const now=workflowInfo(this.app);if(now.graph!==info.graph||now.identity!==info.identity)throw Error("工作流已切换，已停止提交后续任务。");if(job.cancelled)throw Error("已取消此节点任务。");};
            for(let index=0;index<job.total;index++){
                check();const bindings=textBindings(info.graph,group),snapshot={};for(const [i,binding]of bindings.entries())snapshot[binding.key]=i===0?prompt:String(node.bindings?.[binding.key]??binding.value);
                const images=assets.filter(asset=>asset.kind==="image").map(asset=>asset.ref),native=members(info.graph,group);let data=await this.app.graphToPrompt(info.graph);check();
                const apply=output=>{
                    for(const binding of bindings)if(output[binding.id])output[binding.id].inputs[binding.name]=snapshot[binding.key];
                    let imageIndex=0;for(const item of native){const target=output[String(item.id)];if(!target)continue;
                        if(className(item)==="InfiniteCanvasImage")target.inputs.sources=JSON.stringify(images);
                        if(className(item)==="LoadImage"&&images[imageIndex]){const ref=images[imageIndex++];target.inputs.image=[ref.subfolder,ref.filename].filter(Boolean).join("/")+(ref.type!=="input"?` [${ref.type}]`:"");}
                        if(className(item)==="InfiniteCanvasNote")delete output[String(item.id)];
                    }
                };
                apply(data.output);let plan=buildPlan(data.output,info.graph,group,definitions);
                for(const id of plan.nodeIds)for(const widget of info.graph.getNodeById?.(id)?.widgets||[])widget.beforeQueued?.({isPartialExecution:true});
                data=await this.app.graphToPrompt(info.graph);check();apply(data.output);plan=buildPlan(data.output,info.graph,group,definitions);
                data.workflow.extra||={};data.workflow.extra.infinite_canvas_run={session:this.session,job:job.id,board:board.id,node:node.id,user:context.user};
                job.state="提交中";this.onChange(job);const queued=await this.api.queuePrompt(0,{output:plan.output,workflow:data.workflow},{partialExecutionTargets:plan.targets});
                if(!queued.prompt_id)throw Error("ComfyUI 未返回任务 ID。");job.promptId=queued.prompt_id;
                for(const id of plan.nodeIds)for(const widget of info.graph.getNodeById?.(id)?.widgets||[])widget.afterQueued?.();
                if(job.cancelled)await this.request("/cancel","POST",{session:this.session,job:job.id});job.state="运行中";this.onChange(job);
                let record;
                while(!record){if(job.cancelled)throw Error("已取消此节点任务。");try{const response=await this.api.fetchApi("/history/"+encodeURIComponent(job.promptId));if(response.ok)record=(await response.json())[job.promptId];}catch{}if(!record)await pause(650);}
                if(record.status?.status_str==="error"){const error=record.status.messages?.find(([type])=>type==="execution_error")?.[1];throw Error(error?.exception_message||"分组执行失败或已中断，请检查 ComfyUI 的任务错误信息。");}
                const terminal=Object.fromEntries(Object.entries(record.outputs||{}).filter(([id])=>plan.targets.includes(id))),result=collectOutputs(terminal);
                results.push(...result.assets);if(result.text)text=result.text;job.done++;job.assets=[...results];job.text=text;this.onChange(job);
            }
            job.state="已完成";return{assets:results,text};
        }catch(error){job.state=job.cancelled?"已取消":"失败";job.error=error.message;throw error;}
        finally{job.finished=true;this.lock=false;this.onChange(job);}
    }
    async cancel(node){const job=this.jobs.get(node.id);if(!job||job.finished)return;job.cancelled=true;await this.request("/cancel","POST",{session:this.session,job:job.id});this.onChange(job);}
}
