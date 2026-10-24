import test from 'node:test';import assert from 'node:assert/strict';
import {newBoard,newNode,linkNodes,references,inputText,collectOutputs,validateBoard,modelCapabilities,videoTimes} from '../web/model.js';
import {groupsFor,textBindings,groupNotes} from '../web/workflow.js';
import {buildPlan} from '../web/groups.js';
test('video sampling spans the clip, caps at eight frames and never seeks negative time',()=>{assert.deepEqual(videoTimes(3),[0,1,2]);assert.equal(videoTimes(20).length,8);assert.equal(videoTimes(20).at(-1),17.5);assert.deepEqual(videoTimes(.01),[0]);assert.deepEqual(videoTimes(Infinity),[0]);});
test('canvas links preserve input order, reject cycles and carry media and text',()=>{
    const board=newBoard(),a=newNode('asset'),b=newNode('ollama'),c=newNode('image');a.assetIds=['pic'];b.text='upstream';board.assets.pic={id:'pic',kind:'image'};board.nodes=[a,b,c];linkNodes(board,a.id,b.id);linkNodes(board,b.id,c.id);linkNodes(board,a.id,c.id);
    assert.throws(()=>linkNodes(board,c.id,a.id),/循环/);assert.equal(linkNodes(board,a.id,c.id),false);assert.equal(inputText(board,c),'upstream');assert.deepEqual(references(board,c),[board.assets.pic]);assert.equal(validateBoard(structuredClone(board)).nodes.length,3);
});
test('history accepts native media descriptors, deduplicates Eagle previews and collects text',()=>{
    const ref={filename:'a.png',type:'temp',subfolder:'canvas'};const output=collectOutputs({one:{images:[ref],eagle_media:[[ref]]},two:{gifs:[{filename:'movie.mp4'}],audio:[{filename:'voice.wav'}],text:['one','two']}});
    assert.deepEqual(output.assets.map(asset=>asset.kind),['image','video','audio']);assert.equal(output.text,'one\n\ntwo');assert.equal(modelCapabilities({capabilities:['completion','vision']}),'文字 / 图像');assert.equal(modelCapabilities({capabilities:[]}),'');
});
test('workflow discovery, notes and text bindings use actual groups, exclude note widgets',()=>{
    const text={id:1,type:'InfiniteCanvasText',widgets:[{name:'text',value:'original'}]},note={id:2,type:'InfiniteCanvasNote',widgets:[{name:'text',value:'No image reference'}]},output={id:3,type:'InfiniteCanvasResult',outputs:[]};const group={id:8,title:'图片/文生图qwen-image-2.1',nodes:[text,note,output],_bounding:[0,0,500,300]},graph={_groups:[group],_nodes:[text,note,output],getNodeById:id=>[text,note,output].find(node=>String(node.id)===String(id))};
    assert.equal(groupsFor({graph},'image')[0].label,'文生图qwen-image-2.1');assert.equal(groupNotes(graph,group),'No image reference');assert.deepEqual(textBindings(graph,group).map(binding=>binding.id),['1']);
    const plan=buildPlan({'1':{class_type:'InfiniteCanvasText',inputs:{text:'x'}}},graph,group,{InfiniteCanvasText:{output:['STRING']}});assert.equal(plan.output.gr_target_1.class_type,'InfiniteCanvasResult');
});
