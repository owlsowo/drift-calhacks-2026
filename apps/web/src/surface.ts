// Small shared renderer for the two photographic surfaces. Static CSS remains underneath.
export function createSurface(
  canvas: HTMLCanvasElement,
  vertex: string,
  fragment: string,
  grid = 1,
) {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    // The sea fills the viewport; only the paper mesh has an exposed silhouette.
    antialias: grid > 1,
    depth: false,
    powerPreference: 'low-power',
  });
  if (!gl) return;
  const shaders: WebGLShader[] = [];
  const program = gl.createProgram();
  if (!program) return;
  for (const [kind, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(kind);
    if (!shader) return;
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    shaders.forEach((s) => gl.deleteShader(s));
    gl.deleteProgram(program);
    return;
  }
  gl.useProgram(program);
  const vertices: number[] = [];
  for (let y = 0; y < grid; y++)
    for (let x = 0; x < grid; x++) {
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [0, 1],
        [1, 0],
        [1, 1],
      ])
        vertices.push((x + dx) / grid, (y + dy) / grid);
    }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  const attribute = gl.getAttribLocation(program, 'aUv');
  gl.enableVertexAttribArray(attribute);
  gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  function location(name: string) {
    if (!uniforms.has(name)) uniforms.set(name, gl!.getUniformLocation(program!, name));
    return uniforms.get(name)!;
  }
  return {
    image(image: HTMLImageElement) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    },
    float(name: string, value: number) {
      gl.uniform1f(location(name), value);
    },
    pair(name: string, x: number, y: number) {
      gl.uniform2f(location(name), x, y);
    },
    resize(width: number, height: number, ratio = 1) {
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    draw() {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);
    },
    dispose() {
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      shaders.forEach((s) => gl.deleteShader(s));
      gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

export const flatVertex = `
attribute vec2 aUv;
varying vec2 vUv;
void main() { vUv=aUv; gl_Position=vec4(aUv*2.0-1.0,0.0,1.0); }
`;
