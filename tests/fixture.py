import asyncio
import base64
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import threading
import types
import uuid
ROOT=Path(__file__).parents[1]
sys.path.insert(0,str(ROOT.parent/".test-deps"))
from aiohttp import web
PNG=base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8ZsAAAAASUVORK5CYII=")

class Queue:
    def __init__(self):
        self.mutex=threading.RLock();self.queue=[];self.currently_running={};self.history={};self.records=[];self.interrupted=set();self.chats=[]
    def delete_queue_item(self,predicate):
        for index,item in enumerate(self.queue):
            if predicate(item):self.queue.pop(index);return True
        return False
    def interrupt(self):
        self.interrupted.update(self.currently_running.keys())

async def main():
    with tempfile.TemporaryDirectory(prefix="infinite-canvas-test-") as directory:
        base=Path(directory)
        for name in ["input","output","temp","user"]:(base/name).mkdir()
        (base/"output"/"generated.png").write_bytes(PNG)
        routes=web.RouteTableDef();queue=Queue()
        manager=types.SimpleNamespace(get_request_user_filepath=lambda request,file,create_dir=True:str(base/"user"/request.headers.get("comfy-user","default")/file))
        sys.modules["folder_paths"]=types.SimpleNamespace(get_user_directory=lambda:str(base/"user"),get_input_directory=lambda:str(base/"input"),get_output_directory=lambda:str(base/"output"),get_temp_directory=lambda:str(base/"temp"))
        sys.modules["server"]=types.SimpleNamespace(PromptServer=types.SimpleNamespace(instance=types.SimpleNamespace(routes=routes,prompt_queue=queue,user_manager=manager)))
        sys.modules["nodes"]=types.SimpleNamespace(interrupt_processing=queue.interrupt)
        spec=importlib.util.spec_from_file_location("infinite_canvas_fixture",ROOT/"__init__.py",submodule_search_locations=[str(ROOT)])
        plugin=importlib.util.module_from_spec(spec);sys.modules[spec.name]=plugin;spec.loader.exec_module(plugin)
        app=web.Application(client_max_size=64*1024**2);app.add_routes(routes)
        async def worker():
            while True:
                await asyncio.sleep(.03)
                if not queue.queue:continue
                item=queue.queue.pop(0);pid=item[1];queue.currently_running[pid]=item
                await asyncio.sleep(.3)
                outputs={}
                if pid not in queue.interrupted:
                    for node_id,node in item[2].items():
                        if node["class_type"]=="InfiniteCanvasResult":
                            source=item[2][str(node["inputs"]["value"][0])]["inputs"]["text"]
                            outputs[node_id]={"images":[{"filename":"generated.png","subfolder":"","type":"output"}]} if "2" in item[2] else {"text":["ComfyUI 文本输出："+source]}
                record={"outputs":outputs,"prompt":item,"status":{"completed":True,"status_str":"error" if pid in queue.interrupted else "success","messages":[]}}
                queue.records.append(record);queue.history[pid]=record;queue.currently_running.pop(pid,None)
        task=asyncio.create_task(worker())
        async def prompt(request):
            data=await request.json();pid=uuid.uuid4().hex;queue.queue.append((len(queue.records),pid,data["prompt"],data["extra_data"],data.get("partial_execution_targets",[])));return web.json_response({"prompt_id":pid})
        app.router.add_post("/prompt",prompt)
        app.router.add_get("/history/{id}",lambda request:web.json_response({request.match_info["id"]:queue.history[request.match_info["id"]]} if request.match_info["id"] in queue.history else {}))
        app.router.add_get("/history",lambda request:web.json_response(queue.history or {"previous":{"outputs":{"2":{"images":[{"filename":"generated.png","subfolder":"","type":"output"}]}}}}))
        app.router.add_get("/tests/stats",lambda request:web.json_response({"records":queue.records,"chats":queue.chats,"interrupted":list(queue.interrupted)}))
        async def studio_upload(request):
            reader=await request.multipart();part=await reader.next();content=await part.read();aid=uuid.uuid4().hex
            await asyncio.sleep(.04 if "slow" in part.filename else .005)
            return web.json_response({"ok":True,"attachments":[{"id":aid,"name":part.filename,"kind":"image" if part.filename.endswith(".png") else "text","size":len(content),"preview_url":"/view?filename=generated.png&type=output"}]})
        app.router.add_post("/ollama_studio/upload",studio_upload)
        app.router.add_post("/ollama_studio/models",lambda request:web.json_response({"ok":True,"models":[{"name":"test-vision","size":1024,"vision":True}],"default_model":"test-vision"}))
        app.router.add_get("/ollama_studio/presets",lambda request:web.json_response({"ok":True,"skills":[]}))
        app.router.add_post("/ollama_studio/conversations",lambda request:web.json_response({"ok":True,"conversation":{"id":uuid.uuid4().hex,"messages":[],"title":"新对话"}}))
        async def studio_file(request):
            root=ROOT.parent/"ComfyUI-OllamaStudio";path=(root/request.match_info["file"]).resolve()
            if not path.is_relative_to(root) or not path.is_file():raise web.HTTPNotFound()
            return web.FileResponse(path,headers={"Content-Type":"application/javascript" if path.suffix==".js" else "text/css"})
        app.router.add_get("/studio_plugin/{file:.*}",studio_file)
        async def view(request):
            ref={"filename":request.query.get("filename"),"subfolder":request.query.get("subfolder",""),"type":request.query.get("type","output")}
            try:path=plugin.nodes.media_path(ref)
            except ValueError:raise web.HTTPNotFound()
            return web.FileResponse(path)
        app.router.add_get("/view",view)
        async def tags(request):return web.json_response({"models":[{"name":"local-text:4b","size":3*1024**3},{"name":"local-vision:4b","size":4*1024**3},{"name":"remote:cloud","size":0}]})
        async def show(request):
            data=await request.json();return web.json_response({"capabilities":["completion"]+(["vision"] if "vision" in data["model"] else [])})
        async def chat(request):
            data=await request.json();queue.chats.append(data);response=web.StreamResponse(headers={"Content-Type":"application/x-ndjson"});await response.prepare(request)
            text="Translation only." if "translation engine" in data["messages"][0]["content"] else "生成的最终描述：柔和自然光，保留原图结构。"
            for part in [text[:8],text[8:]]:
                await response.write((json.dumps({"message":{"content":part},"done":False},ensure_ascii=False)+"\n").encode());await asyncio.sleep(.04)
            await response.write(b'{"done":true}\n');return response
        app.router.add_get("/api/tags",tags);app.router.add_post("/api/show",show);app.router.add_post("/api/chat",chat)
        async def static(request):
            path=(ROOT/request.match_info["file"]).resolve()
            if not path.is_relative_to(ROOT) or not path.is_file():raise web.HTTPNotFound()
            return web.FileResponse(path,headers={"Content-Type":"application/javascript" if path.suffix in {".js",".mjs"} else "text/css" if path.suffix==".css" else "text/html"})
        app.router.add_get("/plugin/{file:.*}",static)
        definitions={"InfiniteCanvasText":{"output":["STRING"]},"InfiniteCanvasNote":{"output":["STRING"]},"InfiniteCanvasResult":{"output":[],"output_node":True}}
        app.router.add_get("/object_info",lambda request:web.json_response(definitions))
        async def scripts(request):
            if request.match_info["file"]=="app.js":source=(ROOT/"tests/mock_app.js").read_text(encoding="utf-8")
            else:source="""export const api={apiURL:path=>path,fetchApi:(path,options)=>fetch(path,options),async getNodeDefs(){return(await fetch('/object_info')).json()},async queuePrompt(number,data,options){return(await fetch('/prompt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:data.output,partial_execution_targets:options?.partialExecutionTargets,extra_data:{extra_pnginfo:{workflow:data.workflow}}})})).json()}};"""
            return web.Response(text=source,content_type="application/javascript")
        app.router.add_get("/scripts/{file}",scripts)
        runner=web.AppRunner(app);await runner.setup();site=web.TCPSite(runner,"127.0.0.1",0);await site.start();print(json.dumps({"host":"http://127.0.0.1:"+str(site._server.sockets[0].getsockname()[1])}),flush=True)
        try:await asyncio.to_thread(sys.stdin.readline)
        finally:task.cancel();await runner.cleanup()
if __name__=="__main__":asyncio.run(main())
