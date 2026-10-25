// Compact surfaces of revolution. The bottle, paper and cork together are under
// 3k triangles, shared by every instance; no model download or scene framework.
export function createBottleMesh() {
  const glass = [], solid = [];
  const segments = 32;
  function lathe(target, profile, material, offset = [0, 0, 0], angular = segments) {
    const point = (i, j) => {
      const a = j / angular * Math.PI * 2;
      const [y, r] = profile[i];
      const before = profile[Math.max(0, i - 1)], after = profile[Math.min(profile.length - 1, i + 1)];
      const dy = after[0] - before[0], dr = after[1] - before[1];
      const len = Math.hypot(dy, dr) || 1;
      return [offset[0] + Math.cos(a) * r, offset[1] + y, offset[2] + Math.sin(a) * r,
        Math.cos(a) * dy / len, -dr / len, Math.sin(a) * dy / len, material];
    };
    for (let i = 0; i < profile.length - 1; i++) for (let j = 0; j < angular; j++) {
      const a = point(i,j), b = point(i,j+1), c = point(i+1,j), d = point(i+1,j+1);
      target.push(...a,...c,...b,...b,...c,...d);
    }
  }
  // Rounded punt/base, cylindrical belly, a curved shoulder and thick rolled lip.
  lathe(glass, [[-.28,0],[-.28,.095],[-.269,.12],[-.248,.133],[-.21,.138],
    [.12,.138],[.17,.133],[.205,.117],[.237,.092],[.258,.064],
    [.285,.049],[.395,.047],[.405,.057],[.429,.057],[.443,.05],[.445,.035]], 0);
  // Fine translucent lower base rim: a closed bottom gives a real curved glint.
  lathe(glass, [[-.258,.115],[-.25,.10],[-.25,.025],[-.258,0]], 0);
  // A rolled paper cylinder: the upper rim and concentric coils remain visible
  // through the transparent wall. Its warm surface includes procedural ink.
  lathe(solid, [[-.185,0],[-.185,.067],[-.172,.079],[.135,.079],[.15,.073],[.15,.043]], 1, [0,0,.025], 24);
  lathe(solid, [[.145,.043],[.15,.057],[.152,.061],[.152,.066]], 1.5, [0,0,.025], 24);
  lathe(solid, [[-.027,.08],[-.023,.083],[-.017,.083],[-.013,.08]], 2.8, [0,0,.025], 24);
  lathe(solid, [[.383,0],[.383,.039],[.441,.041],[.476,.038],[.482,.027],[.482,0]], 2, [0,0,0],24);
  const rings=[];
  // Three narrow annuli; shader expands these only following a water impact.
  for(let ring=0;ring<3;ring++) for(let j=0;j<48;j++) {
    const p=(angle,r)=>[Math.cos(angle)*r,0,Math.sin(angle)*r,0,1,0,ring];
    const a=j/48*Math.PI*2,b=(j+1)/48*Math.PI*2;
    rings.push(...p(a,.94),...p(b,.94),...p(a,1),...p(a,1),...p(b,.94),...p(b,1));
  }
  const droplets = [];
  const octa = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const faces = [[2,0,4],[2,4,1],[2,1,5],[2,5,0],[3,4,0],[3,1,4],[3,5,1],[3,0,5]];
  for (let drop=0;drop<12;drop++) for(const face of faces) for(const vertex of face) {
    const p=octa[vertex]; droplets.push(...p,...p,drop);
  }
  return { glass: new Float32Array(glass), solid: new Float32Array(solid),
    rings: new Float32Array(rings), droplets: new Float32Array(droplets) };
}
