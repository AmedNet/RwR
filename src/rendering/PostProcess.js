// src/rendering/PostProcess.js
// WebGL 后处理着色器管线 — 包含天气特效
const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// 亮度提取
const BRIGHT_EXTRACT_SHADER = `
precision mediump float;
uniform sampler2D u_texture;
uniform float u_threshold;
varying vec2 v_uv;
float luminance(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
}
void main() {
    vec3 color = texture2D(u_texture, v_uv).rgb;
    float lum = luminance(color);
    float contribution = smoothstep(u_threshold, u_threshold + 0.3, lum);
    gl_FragColor = vec4(color * contribution, 1.0);
}
`;

// 模糊
const BLUR_SHADER = `
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_texelSize;
varying vec2 v_uv;
void main() {
    vec3 result = texture2D(u_texture, v_uv).rgb * 0.4;
    result += texture2D(u_texture, v_uv + vec2(u_texelSize.x, 0.0)).rgb * 0.15;
    result += texture2D(u_texture, v_uv - vec2(u_texelSize.x, 0.0)).rgb * 0.15;
    result += texture2D(u_texture, v_uv + vec2(0.0, u_texelSize.y)).rgb * 0.15;
    result += texture2D(u_texture, v_uv - vec2(0.0, u_texelSize.y)).rgb * 0.15;
    gl_FragColor = vec4(result, 1.0);
}
`;

// 最终合成 — 包含天气特效
const COMPOSITE_SHADER = `
precision mediump float;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_bloomIntensity;
uniform float u_vignetteIntensity;
uniform float u_contrast;
uniform float u_saturation;

// 闪电
uniform float u_lightningFlash;

// 火光增强
uniform float u_fireGlowIntensity;

varying vec2 v_uv;

float luminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
}








void main() {
    vec2 uv = v_uv;
    vec3 color = texture2D(u_scene, uv).rgb;
    
    // 闪电
    if (u_lightningFlash > 0.0) {
        color += vec3(1.0) * u_lightningFlash * 0.3;
    }
    
        
    // Bloom
    vec3 bloom = texture2D(u_bloom, uv).rgb;
    color += bloom * u_bloomIntensity;
    
    // 火光/爆炸闪光增强 — 检测暖色高亮区域并添加辉光
    if (u_fireGlowIntensity > 0.01) {
        float lum2 = luminance(color);
        // 暖色检测：红色通道占比高
        float warmth = clamp((color.r - color.b) * 1.5, 0.0, 1.0);
        // 高亮区域
        float brightMask = smoothstep(0.4, 0.9, lum2);
        // 火光强度 = 暖色 × 亮度
        float fireMask = warmth * brightMask * u_fireGlowIntensity;
        if (fireMask > 0.005) {
            // 用场景原始颜色做火光扩散（不依赖bloom）
            vec3 fireGlow = color * vec3(1.0, 0.6, 0.2) * fireMask * 2.0;
            color += fireGlow;
        }
    }
    
    // 对比度和饱和度
    color = (color - 0.5) * u_contrast + 0.5;
    float lum = luminance(color);
    color = mix(vec3(lum), color, u_saturation);
    
    // 暗角
    vec2 center = uv - 0.5;
    float dist = length(center);
    float vignette = smoothstep(0.9, 0.6, dist);
    color *= mix(1.0, vignette, u_vignetteIntensity);
    
    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

export const PostProcess = {
    canvas: null,
    gl: null,
    brightProgram: null,
    blurProgram: null,
    compositeProgram: null,
    sceneTexture: null,
    brightFBO: null,
    brightTexture: null,
    blurFBO: null,
    blurTexture: null,
    quadBuffer: null,
    _cachedUniforms: null,
    enabled: true,
    time: 0,
    width: 0,
    height: 0,
    
    params: {
        bloomIntensity: 0.22,
        bloomThreshold: 0.65,
        vignetteIntensity: 0.2,
        contrast: 1.03,
        saturation: 1.05
    },
    
    lightningData: {
        flash: 0
    },
    
    fireGlowData: {
        intensity: 0
    },
    
    init() {
        this.canvas = document.createElement("canvas");
        this.canvas.id = "postProcessCanvas";
        this.canvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;";
        
        const container = document.getElementById("gameContainer");
        if (container) {
            const gameCanvas = document.getElementById("gameCanvas");
            if (gameCanvas && gameCanvas.nextSibling) {
                container.insertBefore(this.canvas, gameCanvas.nextSibling);
            } else {
                container.appendChild(this.canvas);
            }
        }
        
        try {
            this.gl = this.canvas.getContext("webgl", {
                alpha: false,
                antialias: false,
                preserveDrawingBuffer: false,
                powerPreference: "low-power"
            });
            
            if (!this.gl) {
                console.warn("WebGL not available, post-processing disabled");
                this.enabled = false;
                return;
            }
            
            this._initQuad();
            this.brightProgram = this._createProgram(VERTEX_SHADER, BRIGHT_EXTRACT_SHADER);
            this.blurProgram = this._createProgram(VERTEX_SHADER, BLUR_SHADER);
            this.compositeProgram = this._createProgram(VERTEX_SHADER, COMPOSITE_SHADER);
            this._initSceneTexture();
            this._cacheUniformLocations();
            
            console.log("Post-process pipeline initialized");
        } catch (e) {
            console.warn("Post-process init failed:", e);
            this.enabled = false;
        }
    },
    
    _cacheUniformLocations() {
        const gl = this.gl;
        const cache = {};
        
        cache.brightTexture = gl.getUniformLocation(this.brightProgram, "u_texture");
        cache.brightThreshold = gl.getUniformLocation(this.brightProgram, "u_threshold");
        
        cache.blurTexture = gl.getUniformLocation(this.blurProgram, "u_texture");
        cache.blurTexelSize = gl.getUniformLocation(this.blurProgram, "u_texelSize");
        
        cache.scene = gl.getUniformLocation(this.compositeProgram, "u_scene");
        cache.bloom = gl.getUniformLocation(this.compositeProgram, "u_bloom");
        cache.resolution = gl.getUniformLocation(this.compositeProgram, "u_resolution");
        cache.time = gl.getUniformLocation(this.compositeProgram, "u_time");
        cache.bloomIntensity = gl.getUniformLocation(this.compositeProgram, "u_bloomIntensity");
        cache.vignetteIntensity = gl.getUniformLocation(this.compositeProgram, "u_vignetteIntensity");
        cache.contrast = gl.getUniformLocation(this.compositeProgram, "u_contrast");
        cache.saturation = gl.getUniformLocation(this.compositeProgram, "u_saturation");
        cache.lightningFlash = gl.getUniformLocation(this.compositeProgram, "u_lightningFlash");
        cache.fireGlowIntensity = gl.getUniformLocation(this.compositeProgram, "u_fireGlowIntensity");

        this._cachedUniforms = cache;
    },
    
    _createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("Shader compile error:", gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    },
    
    _createProgram(vsSource, fsSource) {
        const gl = this.gl;
        const vs = this._createShader(gl.VERTEX_SHADER, vsSource);
        const fs = this._createShader(gl.FRAGMENT_SHADER, fsSource);
        if (!vs || !fs) return null;
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("Program link error:", gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    },
    
    _initQuad() {
        const gl = this.gl;
        const vertices = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    },
    
    _bindQuad(program) {
        const gl = this.gl;
        const loc = gl.getAttribLocation(program, "a_position");
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    },
    
    _initSceneTexture() {
        const gl = this.gl;
        this.sceneTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    },
    
    _createFBOTexture(w, h) {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return { fbo, texture };
    },
    
    _ensureFBOs() {
        const gl = this.gl;
        const bw = Math.max(1, Math.floor(this.width / 8));
        const bh = Math.max(1, Math.floor(this.height / 8));
        if (this.brightTexture && this._bloomW === bw && this._bloomH === bh) return;
        
        if (this.brightFBO) gl.deleteFramebuffer(this.brightFBO);
        if (this.brightTexture) gl.deleteTexture(this.brightTexture);
        if (this.blurFBO) gl.deleteFramebuffer(this.blurFBO);
        if (this.blurTexture) gl.deleteTexture(this.blurTexture);
        
        const bright = this._createFBOTexture(bw, bh);
        this.brightFBO = bright.fbo;
        this.brightTexture = bright.texture;
        const blur = this._createFBOTexture(bw, bh);
        this.blurFBO = blur.fbo;
        this.blurTexture = blur.texture;
        this._bloomW = bw;
        this._bloomH = bh;
    },
    
    resize(width, height) {
        if (!this.canvas || !this.gl) return;
        const dpr = window.devicePixelRatio || 1;
        this.width = Math.floor(width * dpr);
        this.height = Math.floor(height * dpr);
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.gl.viewport(0, 0, this.width, this.height);
        this._bloomW = 0;
    },
    
    updateLightning(flash) {
        this.lightningData.flash = flash;
    },
    
    updateFireGlow(intensity) {
        this.fireGlowData.intensity = intensity;
    },
    
    apply(sourceCanvas) {
        if (!this.enabled || !this.gl || !sourceCanvas) return;
        const gl = this.gl;
        this._ensureFBOs();
        const bw = this._bloomW;
        const bh = this._bloomH;
        const u = this._cachedUniforms;
        
        gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

        // Pass 1: 亮度提取
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.brightFBO);
        gl.viewport(0, 0, bw, bh);
        gl.useProgram(this.brightProgram);
        this._bindQuad(this.brightProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture);
        gl.uniform1i(u.brightTexture, 0);
        gl.uniform1f(u.brightThreshold, this.params.bloomThreshold);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        // Pass 2: 模糊
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBO);
        gl.useProgram(this.blurProgram);
        this._bindQuad(this.blurProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.brightTexture);
        gl.uniform1i(u.blurTexture, 0);
        gl.uniform2f(u.blurTexelSize, 1.0 / bw, 1.0 / bh);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        // Pass 3: 最终合成
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.width, this.height);
        gl.useProgram(this.compositeProgram);
        this._bindQuad(this.compositeProgram);
        this.time += 0.016;
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture);
        gl.uniform1i(u.scene, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.blurTexture);
        gl.uniform1i(u.bloom, 1);

        gl.uniform2f(u.resolution, this.width, this.height);
        gl.uniform1f(u.time, this.time);
        gl.uniform1f(u.bloomIntensity, this.params.bloomIntensity);
        gl.uniform1f(u.vignetteIntensity, this.params.vignetteIntensity);
        gl.uniform1f(u.contrast, this.params.contrast);
        gl.uniform1f(u.saturation, this.params.saturation);

        gl.uniform1f(u.lightningFlash, this.lightningData.flash);
        gl.uniform1f(u.fireGlowIntensity, this.fireGlowData.intensity);
        
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    
    setParam(name, value) {
        if (name in this.params) {
            this.params[name] = value;
        }
    },
    
    setEnabled(enabled) {
        this.enabled = enabled;
        if (this.canvas) {
            this.canvas.style.display = enabled ? "block" : "none";
        }
    }
};
