import { FRAME_WGSL, CASCADES, N } from './common.js';
import { MAX_BOTTLES } from '../scene-limits.js';

// Water and bottles read the exact same FFT displacement. No CPU readback or
// independent sine bob can disconnect the hull from the wave beneath it.
export const BOTTLE = FRAME_WGSL + /* wgsl */ `
struct Bottle {
  position: vec4f, // xyz, visibility
  rotation: vec4f, // yaw, pitch, roll, floating blend
  state: vec4f,    // seconds since impact (-1 inactive), seed, impact xz
};
struct Bottles { objects: array<Bottle, ${MAX_BOTTLES}> };
@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var<uniform> B: Bottles;
@group(0) @binding(2) var displacement: texture_2d_array<f32>;
@group(0) @binding(3) var derivatives: texture_2d_array<f32>;
@group(0) @binding(4) var waves: sampler;
@group(0) @binding(5) var environment: texture_cube<f32>;
@group(0) @binding(6) var environmentSampler: sampler;

struct VIn {
  @location(0) point: vec3f,
  @location(1) normal: vec3f,
  @location(2) material: f32,
};
struct VOut {
  @builtin(position) position: vec4f,
  @location(0) world: vec3f,
  @location(1) normal: vec3f,
  @location(2) local: vec3f,
  @location(3) material: f32,
  @location(4) opacity: f32,
};
struct Surface { displacement: vec3f, normal: vec3f };
fn invisibleVertex() -> VOut {
  var o:VOut;
  o.position=vec4f(0.,0.,0.,1.);
  return o;
}
fn surfaceAt(xz: vec2f, footprint: f32) -> Surface {
  var d = vec3f(0.0); var slope = vec2f(0.0);
  var j = vec2f(1.0);
  for(var c=0u;c<${CASCADES}u;c++) {
    let inverseLength=F.cascInvL[c >> 2u][c & 3u];
    let lod=clamp(log2(max(footprint*${N}.0*inverseLength,1.0))+.5,0.0,7.0);
    let uv=xz*inverseLength;
    d+=textureSampleLevel(displacement,waves,uv,c,lod).xyz;
    let deriv=textureSampleLevel(derivatives,waves,uv,c,lod);
    slope+=deriv.xy; j+=deriv.zw;
  }
  return Surface(d,normalize(vec3f(-slope.x/max(j.x,.25),1.0,-slope.y/max(j.y,.25))));
}
fn turn(p:vec3f, angles:vec3f) -> vec3f {
  let c=cos(angles); let s=sin(angles);
  // Roll around Z, pitch around X, yaw around Y; +Y is the bottle neck.
  let rz=vec3f(c.z*p.x-s.z*p.y,s.z*p.x+c.z*p.y,p.z);
  let rx=vec3f(rz.x,c.y*rz.y-s.y*rz.z,s.y*rz.y+c.y*rz.z);
  return vec3f(c.x*rx.x+s.x*rx.z,rx.y,-s.x*rx.x+c.x*rx.z);
}
@vertex fn vs(v:VIn,@builtin(instance_index) id:u32) -> VOut {
  let b=B.objects[id];
  if(b.position.w<.001) { return invisibleVertex(); }
  let water=surfaceAt(b.position.xz,.24);
  let floating=b.rotation.w;
  let tilt=water.normal* floating+vec3f(0.,1.-floating,0.);
  let up=normalize(tilt);
  let right=normalize(cross(up,vec3f(0.,0.,1.)));
  let forward=cross(right,up);
  let basis=mat3x3f(right,up,forward);
  let oriented=turn(v.point*1.4,b.rotation.xyz);
  let center=b.position.xyz+water.displacement*floating;
  var o:VOut;
  o.world=center+basis*oriented;
  o.normal=normalize(basis*turn(v.normal,b.rotation.xyz));
  o.position=F.viewProj*vec4f(o.world-F.camPos.xyz,1.0);
  o.local=v.point;
  o.material=v.material;
  o.opacity=b.position.w;
  if(o.opacity<.001) { o.position=vec4f(0.,0.,0.,1.); }
  return o;
}
fn shadeBasis(n:vec3f) -> vec3f {
  let sky=textureSampleLevel(environment,environmentSampler,normalize(vec3f(n.x,abs(n.y)+.15,n.z)),6.0).rgb;
  return vec3f(.24,.26,.28)+sky*.52+max(dot(n,F.sunDir.xyz),0.)*vec3f(.46,.43,.37);
}
@fragment fn solid(v:VOut,@builtin(front_facing) front:bool) -> @location(0) vec4f {
  let n=select(-normalize(v.normal),normalize(v.normal),front);
  var color=vec3f(.88,.78,.58);
  let grain=fract(sin(dot(v.local.xy*vec2f(730.,1130.),vec2f(12.9898,78.233)))*43758.5453);
  if(v.material>1.75) {
    color=vec3f(.29,.17,.085)*(.8+grain*.4);
    let pores=step(.94,grain);
    color*=1.-pores*.45;
  } else {
    color*=.94+grain*.08;
    // Small irregular lines follow the paper cylinder, rather than a flat decal.
    let row=fract((v.local.y+.17)*39.);
    let angle=atan2(v.local.z-.025,v.local.x);
    let ink=smoothstep(.09,.15,row)*(1.-smoothstep(.24,.29,row));
    let margin=smoothstep(-.15,-.12,v.local.y)*(1.-smoothstep(.10,.125,v.local.y));
    let letters=step(.22,fract(angle*9.+floor(v.local.y*39.)*.31));
    color=mix(color,vec3f(.29,.28,.23),ink*margin*letters*.58);
    if(v.material>1.2) { color*=.64; }
  }
  return vec4f(color*shadeBasis(n)*1.4,v.opacity);
}
@fragment fn glass(v:VOut,@builtin(front_facing) front:bool) -> @location(0) vec4f {
  let n=select(-normalize(v.normal),normalize(v.normal),front);
  let V=normalize(F.camPos.xyz-v.world);
  let ndv=clamp(dot(n,V),0.,1.);
  let fresnel=.045+.955*pow(1.-ndv,5.);
  let r=reflect(-V,n); // Sky above, darker reflected sea below the horizon.
  let reflected=textureSampleLevel(environment,environmentSampler,normalize(r),1.2).rgb;
  let H=normalize(V+F.sunDir.xyz);
  let spec=pow(max(dot(n,H),0.),150.);
  // An elongated overcast-sky glint stays visible even away from the moon axis.
  let broad=pow(max(dot(n,normalize(vec3f(-.45,.68,.57))),0.),28.);
  let tint=vec3f(.055,.15,.145);
  let rim=smoothstep(.395,.410,v.local.y)*(1.-smoothstep(.435,.445,v.local.y));
  let base=1.-smoothstep(-.265,-.23,v.local.y);
  let radiance=tint*.42+reflected*(1.05+fresnel*1.1)+vec3f(.94,.86,.69)*spec*4.5
    +vec3f(.65,.78,.86)*(broad*.24+(rim+base)*fresnel*.17);
  let thickness=smoothstep(.115,.137,length(v.local.xz));
  let alpha=clamp(.12+fresnel*.67+thickness*.045+spec*.52,.12,.83)*v.opacity;
  return vec4f(radiance,alpha);
}
@vertex fn rippleVs(v:VIn,@builtin(instance_index) id:u32) -> VOut {
  let b=B.objects[id];
  let age=b.state.x-v.material*.21;
  if(b.position.w<.001||age<0.||age>=2.6) { return invisibleVertex(); }
  let life=clamp(age/2.6,0.,1.);
  let radius=.14+max(age,0.)*.66;
  let xz=b.state.zw+v.point.xz*radius;
  let water=surfaceAt(xz,.065);
  var o:VOut;
  o.world=vec3f(xz.x,0.,xz.y)+water.displacement+vec3f(0.,.012,0.);
  o.position=F.viewProj*vec4f(o.world-F.camPos.xyz,1.0);
  o.normal=water.normal; o.local=v.point; o.material=v.material;
  o.opacity=select(0.,pow(1.-life,2.)*.13*b.position.w,age>=0.&&age<2.6);
  return o;
}
@vertex fn splashVs(v:VIn,@builtin(instance_index) id:u32) -> VOut {
  let b=B.objects[id];
  let age=max(b.state.x,0.);
  if(b.position.w<.001||b.state.x<0.||age>.6) { return invisibleVertex(); }
  let angle=v.material*2.39996;
  let speed=.42+fract(v.material*.381)*.52;
  let upward=1.7+fract(v.material*.713)*1.1;
  let rise=upward*age-4.9*age*age;
  if(rise<=0.) { return invisibleVertex(); }
  let xz=b.state.zw+vec2f(cos(angle),sin(angle))*speed*age;
  let water=surfaceAt(b.state.zw,.24);
  var o:VOut;
  o.world=vec3f(xz.x,rise,xz.y)+water.displacement+v.point*vec3f(.013,.023,.013);
  o.position=F.viewProj*vec4f(o.world-F.camPos.xyz,1.0);
  o.normal=v.normal; o.local=v.point; o.material=v.material;
  o.opacity=select(0.,.55*b.position.w*(1.-smoothstep(.1,.6,age)),b.state.x>=0.&&rise>0.);
  return o;
}
@fragment fn splash(v:VOut) -> @location(0) vec4f {
  let color=textureSampleLevel(environment,environmentSampler,normalize(v.normal+vec3f(0.,1.2,0.)),2.).rgb;
  return vec4f(color*.7+vec3f(.14,.22,.27),v.opacity);
}
@fragment fn ripple(v:VOut) -> @location(0) vec4f {
  let edge=clamp((length(v.local.xz)-.94)/.06,0.,1.);
  let soft=sin(edge*3.14159265);
  let angle=atan2(v.local.z,v.local.x);
  // Break the small circular impulse into softly lit arcs as it crosses the swell.
  let broken=.3+.7*smoothstep(-.7,.7,sin(angle*5.+v.material*2.7)+.45*sin(angle*11.-v.material));
  let slope=clamp(.8+v.normal.x*1.1+v.normal.z*.7,.4,1.1);
  return vec4f(vec3f(.34,.46,.52),v.opacity*soft*broken*slope);
}
`;
