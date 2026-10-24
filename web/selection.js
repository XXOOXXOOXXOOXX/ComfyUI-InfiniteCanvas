import {segmentsCross} from './content_history.js';
export function containsPoint(point,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
export function intersectsSelection(node,mode,points){
 if(points.length<2)return false;const [a,b]=points,minX=Math.min(a.x,b.x),minY=Math.min(a.y,b.y),maxX=Math.max(a.x,b.x),maxY=Math.max(a.y,b.y),corners=[{x:node.x,y:node.y},{x:node.x+node.w,y:node.y},{x:node.x+node.w,y:node.y+node.h},{x:node.x,y:node.y+node.h}];
 if(mode==='rectangle')return node.x<=maxX&&node.x+node.w>=minX&&node.y<=maxY&&node.y+node.h>=minY;
 if(mode==='ellipse'){const rx=(maxX-minX)/2,ry=(maxY-minY)/2;if(rx<1||ry<1)return false;const cx=(maxX+minX)/2,cy=(maxY+minY)/2,x=Math.max(node.x,Math.min(node.x+node.w,cx)),y=Math.max(node.y,Math.min(node.y+node.h,cy));return ((x-cx)/rx)**2+((y-cy)/ry)**2<=1;}
 if(points.length<3)return false;return corners.some(corner=>containsPoint(corner,points))||points.some(p=>p.x>=node.x&&p.x<=node.x+node.w&&p.y>=node.y&&p.y<=node.y+node.h)||points.some((p,index)=>corners.some((q,j)=>segmentsCross(p,points[(index+1)%points.length],q,corners[(j+1)%4])));
}
