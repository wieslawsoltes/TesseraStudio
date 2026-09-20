import { WGSL, GL_VERTEX, GL_FRAGMENT } from './shaders.js';
export class StudioRenderer {
    constructor(canvas, { onStatus = () => { }, onError = () => { } } = {}) { this.canvas = canvas; this.onStatus = onStatus; this.onError = onError; this.mode = 0; this.light = 1; this.rotation = 0; this.grid = true; this.stats = { backend: 'Initializing', frames: 0, frameMs: 0 }; }
    async initialize(size = 1024) { this.size = size; let gpuError; try {
        if (!navigator.gpu)
            throw Error('WebGPU unavailable');
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter)
            throw Error('No WebGPU adapter');
        this.device = await adapter.requestDevice();
        this.device.pushErrorScope('validation');
        const shader = this.device.createShaderModule({ code: WGSL });
        const info = await shader.getCompilationInfo();
        const errors = info.messages.filter(m => m.type === 'error');
        if (errors.length)
            throw Error(errors.map(e => e.message).join('; '));
        const format = navigator.gpu.getPreferredCanvasFormat();
        this.pipeline = await this.device.createRenderPipelineAsync({ layout: 'auto', vertex: { module: shader, entryPoint: 'vs', buffers: [{ arrayStride: 36, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }, { shaderLocation: 2, offset: 24, format: 'float32x2' }, { shaderLocation: 3, offset: 32, format: 'float32' }] }] }, fragment: { module: shader, entryPoint: 'fs', targets: [{ format, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } } }] }, primitive: { topology: 'triangle-list', cullMode: 'none' }, depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }, multisample: { count: 4 } });
        const err = await this.device.popErrorScope();
        if (err)
            throw Error(err.message);
        this.context = this.canvas.getContext('webgpu');
        if (!this.context)
            throw Error('WebGPU canvas unavailable');
        this.format = format;
        this.context.configure({ device: this.device, format, alphaMode: 'premultiplied' });
        this.uniform = this.device.createBuffer({ size: 112, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.texture = this.device.createTexture({ size: [size, size, 24], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
        this.sampler = this.device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
        this.bindGroup = this.device.createBindGroup({ layout: this.pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: this.uniform } }, { binding: 1, resource: this.texture.createView({ dimension: '2d-array' }) }, { binding: 2, resource: this.sampler }] });
        this.backend = 'WebGPU';
        this.device.lost.then(info => { if (!this.disposed)
            this.onError('GPU device lost: ' + info.message + '. Reload the project to recover.'); });
        this.device.addEventListener('uncapturederror', e => this.onError(e.error.message));
    }
    catch (e) {
        gpuError = e;
        this.device?.destroy();
        this.device = null;
        if (this.context) {
            const replacement = this.canvas.cloneNode();
            this.canvas.replaceWith(replacement);
            this.canvas = replacement;
            this.context = null;
        }
        this.initGL(size);
    } this.stats.backend = this.backend; this.onStatus(this.backend, gpuError?.message); return this; }
    initGL(size) { const gl = this.canvas.getContext('webgl2', { alpha: true, antialias: true, preserveDrawingBuffer: true }); if (!gl)
        throw Error('A browser with WebGPU or WebGL 2 is required.'); this.gl = gl; const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw Error(gl.getShaderInfoLog(s)); return s; }; this.program = gl.createProgram(); gl.attachShader(this.program, compile(gl.VERTEX_SHADER, GL_VERTEX)); gl.attachShader(this.program, compile(gl.FRAGMENT_SHADER, GL_FRAGMENT)); gl.linkProgram(this.program); if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
        throw Error(gl.getProgramInfoLog(this.program)); gl.useProgram(this.program); this.locations = {}; for (const n of ['vp', 'eye', 'material', 'view', 'maps'])
        this.locations[n] = gl.getUniformLocation(this.program, n); this.glTexture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.glTexture); gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, size, size, 24); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); this.backend = 'WebGL 2'; this.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.onError('Graphics context lost. Download your project and reload to recover.'); }); }
    setMesh(mesh) { this.mesh = mesh; const floor = []; for (const p of [[-12, -1.35, -12], [-12, -1.35, 12], [12, -1.35, 12], [-12, -1.35, -12], [12, -1.35, 12], [12, -1.35, -12]])
        floor.push(...p, 0, 1, 0, 0, 0, -1); const data = new Float32Array(floor.length + mesh.vertices.length); data.set(floor); data.set(mesh.vertices, floor.length); this.vertexCount = data.length / 9; if (this.device) {
        this.vertexBuffer?.destroy();
        this.vertexBuffer = this.device.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        this.device.queue.writeBuffer(this.vertexBuffer, 0, data);
    }
    else {
        const gl = this.gl;
        if (this.glBuffer)
            gl.deleteBuffer(this.glBuffer);
        this.glBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        for (const [name, n, offset] of [['position', 3, 0], ['normal', 3, 12], ['texcoord', 2, 24], ['tile', 1, 32]]) {
            const loc = gl.getAttribLocation(this.program, name);
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 36, offset);
        }
    } }
    upload(changed) { for (const { canvas, index } of changed) {
        if (this.device)
            this.device.queue.copyExternalImageToTexture({ source: canvas, flipY: false }, { texture: this.texture, origin: [0, 0, index], premultipliedAlpha: false }, [this.size, this.size]);
        else {
            const gl = this.gl;
            gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.glTexture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, index, this.size, this.size, 1, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        }
    } }
    resize() { const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.max(1, Math.round(this.canvas.clientWidth * dpr)), h = Math.max(1, Math.round(this.canvas.clientHeight * dpr)); if (w === this.canvas.width && h === this.canvas.height)
        return; this.canvas.width = w; this.canvas.height = h; if (this.device) {
        this.depth?.destroy();
        this.msaa?.destroy();
        this.depth = this.device.createTexture({ size: [w, h], format: 'depth24plus', sampleCount: 4, usage: GPUTextureUsage.RENDER_ATTACHMENT });
        this.msaa = this.device.createTexture({ size: [w, h], format: this.format, sampleCount: 4, usage: GPUTextureUsage.RENDER_ATTACHMENT });
    } }
    render(camera, graph = {}) { if (!this.vertexCount || this.disposed)
        return; const start = performance.now(); this.resize(); const vp = camera.matrix(this.canvas.width / this.canvas.height), eye = camera.eye(), material = [graph.exposure || 0, graph.contrast ?? 1, graph.saturation ?? 1, graph.roughness ?? 1], view = [this.mode, this.light, this.rotation, +this.grid]; if (this.device) {
        if (!this.depth) {
            this.canvas.width = 0;
            this.resize();
        }
        const values = new Float32Array([...vp, ...eye, 1, ...material, ...view]);
        this.device.queue.writeBuffer(this.uniform, 0, values);
        const encoder = this.device.createCommandEncoder(), pass = encoder.beginRenderPass({ colorAttachments: [{ view: this.msaa.createView(), resolveTarget: this.context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }], depthStencilAttachment: { view: this.depth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.draw(this.vertexCount);
        pass.end();
        this.device.queue.submit([encoder.finish()]);
    }
    else {
        const gl = this.gl;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(this.program);
        gl.uniformMatrix4fv(this.locations.vp, false, vp);
        gl.uniform3fv(this.locations.eye, eye);
        gl.uniform4fv(this.locations.material, material);
        gl.uniform4fv(this.locations.view, view);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.glTexture);
        gl.uniform1i(this.locations.maps, 0);
        gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    } this.stats.frames++; this.stats.frameMs = performance.now() - start; }
    dispose() { this.disposed = true; this.device?.destroy(); if (this.gl) {
        this.gl.deleteBuffer(this.glBuffer);
        this.gl.deleteTexture(this.glTexture);
        this.gl.deleteProgram(this.program);
    } }
}
