import {app} from "../../scripts/app.js";
import {api} from "../../scripts/api.js";
import {InfiniteCanvas} from "./ui.js";
app.registerExtension({name:"InfiniteCanvas.CreativeBoard",async setup(){
    if(globalThis.InfiniteCanvasUI?.root?.isConnected)return;
    const css=document.createElement("link");css.rel="stylesheet";css.href=new URL("./style.css?v=1.3.0",import.meta.url).href;document.head.append(css);
    globalThis.InfiniteCanvasUI=new InfiniteCanvas({app,api});
}});
