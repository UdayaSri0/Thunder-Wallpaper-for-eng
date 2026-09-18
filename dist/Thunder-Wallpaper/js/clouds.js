(() => {
  const S = Storm;
  const vertex = `attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
  const fragment = `
  precision highp float;
  varying vec2 uv;
  uniform sampler2D noiseMap, boltColour, boltDepth;
  uniform vec2 resolution, drift;
  uniform float density, brightness, fog, glow, reduced, contrast, turbulence, softness, evolution, hasBolt;
  uniform vec4 lights[8];
  uniform vec3 lightColours[8];
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return texture2D(noiseMap,(i+f+.5)/256.).r;}
  float fbm(vec2 p){float f=0.;float a=.53;for(int i=0;i<5;i++){f+=a*noise(p);p=mat2(1.63,1.17,-1.17,1.63)*p+17.3;a*=.49;}return f;}
  float field(vec2 p,float layer){
    vec2 slow=vec2(sin(evolution*.17+layer)*.24,cos(evolution*.13+layer)*.19);
    vec2 w=vec2(noise(p*.62+slow),noise(p*.62+49.+slow.yx));
    float broad=fbm(p*.58+w*.24+slow);
    float detail=fbm(p+w*mix(.18,.88,turbulence)+slow*.45);
    return mix(broad,detail,mix(.28,.78,turbulence));
  }
  void main(){
    vec2 st=vec2(uv.x,1.-uv.y);
    float aspect=resolution.x/resolution.y;
    vec2 p=vec2(st.x*aspect,st.y);
    vec2 d=drift;
    float far=field(p*2.55+vec2(d.x*.38,-d.x*.07)+11.,1.);
    float mid=field(p*3.25+vec2(-d.x*.65,d.x*.11)+42.,2.);
    float near=field(p*2.35+vec2(d.x*.92,d.x*.06)+91.,3.);
    float towers=field(vec2(p.x*1.05,p.y*.58)+vec2(-d.x*.16,166.),4.);
    mid=mix(mid,mid*.7+towers*.42,.52);
    float bank=1.-smoothstep(.48,.96,st.y);
    float edge=mix(.035,.145,softness);
    float farShape=(far-.5)*mix(.72,1.55,contrast)+.5+density*.12;
    float midShape=(mid-.5)*mix(.72,1.62,contrast)+.5+density*.18+bank*.065;
    float nearShape=(near-.5)*mix(.7,1.5,contrast)+.5+density*.11;
    float a=smoothstep(.46-edge,.46+edge,farShape)*.86;
    float b=smoothstep(.49-edge,.49+edge,midShape)*.97;
    float c=smoothstep(.57-edge,.57+edge,nearShape)*(.2+bank*.54);
    float shade=field(p*3.25+vec2(-d.x*.65,d.x*.11)+41.6,2.);
    float rim=clamp((mid-shade)*mix(1.4,3.1,contrast)+.04,0.,1.);
    float lowerDark=mix(1.,.63,smoothstep(.35,.9,st.y)*b*contrast);
    vec3 sky=mix(vec3(.038,.060,.095),vec3(.075,.113,.166),smoothstep(.2,1.,st.y));
    vec3 col=mix(sky,vec3(.092,.119,.157)*( .68+far*.55),a);
    vec3 cloud=(vec3(.035,.048,.069)+vec3(.25,.282,.325)*rim+mid*.048)*lowerDark;
    col=mix(col,cloud,b);
    col=mix(col,vec3(.034,.046,.065)+near*.046,c);
    col*=.5+brightness*1.12;
    vec3 light=vec3(0.);
    for(int i=0;i<8;i++){
      vec4 l=lights[i];
      vec2 delta=(st-l.xy)*vec2(aspect,1.);
      float dist=length(delta*vec2(.86,1.18));
      float spread=exp(-dist*dist/(.019+glow*.066));
      float filaments=.22+mid*.95+rim*1.4;
      float transmission=mix(.38,1.,1.-c);
      light+=lightColours[i]*l.z*(spread*filaments*transmission*(.5+glow)+.009*(1.-reduced*.92));
    }
    col+=light;
    if(hasBolt>.5){
      vec3 channel=texture2D(boltColour,st).rgb;
      vec3 depthMask=texture2D(boltDepth,st).rgb;
      float internal=depthMask.r*pow(1.-b,4.)*.26;
      float middle=depthMask.g*pow(1.-c,2.)*(1.-b*.82);
      float foreground=depthMask.b;
      float channelEnergy=max(max(channel.r,channel.g),channel.b);
      float maskEnergy=max(max(depthMask.r,depthMask.g),depthMask.b)+.0001;
      col+=channel*((internal+middle+foreground)/maskEnergy)*mix(1.7,2.7,smoothstep(.1,.8,channelEnergy));
    }
    float mist=fbm(p*2.+vec2(d.x*.24,117.+evolution*.01));
    float haze=fog*smoothstep(.4,1.,st.y)*(.12+mist*.34);
    col=mix(col,vec3(.13,.175,.225)+light*.16,haze);
    float vignette=1.-.33*pow(length((st-.5)*vec2(1.,.75)),1.35);
    col*=vignette;
    col=vec3(1.)-exp(-col*1.12);
    gl_FragColor=vec4(col,1.);
  }`;
  class Clouds {
    constructor(canvas) {
      this.canvas = canvas;
      this.time = 0;
      this.mode = "WebGL";
      this.lost = false;
      this.seed = Math.random() * 300;
      this.gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "low-power",
      });
      if (this.gl) {
        try {
          this.initGL();
        } catch (error) {
          console.warn("Cloud shader unavailable; using Canvas.", error);
          this.useFallback();
        }
      } else this.useFallback();
      canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        this.lost = true;
      });
      canvas.addEventListener("webglcontextrestored", () => {
        this.initGL();
        this.lost = false;
        this.resize(innerWidth, innerHeight);
      });
    }
    useFallback() {
      this.mode = "Canvas";
      this.gl = null;
      // A canvas which acquired WebGL cannot subsequently acquire a 2D context.
      const old = this.canvas;
      this.canvas = document.createElement("canvas");
      this.canvas.id = old.id;
      old.replaceWith(this.canvas);
      this.ctx = this.canvas.getContext("2d", { alpha: false });
      this.makeFallback();
    }
    initGL() {
      const gl = this.gl;
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          const error = gl.getShaderInfoLog(shader);
          gl.deleteShader(shader);
          throw new Error(error);
        }
        return shader;
      };
      const vs = compile(gl.VERTEX_SHADER, vertex),
        fs = compile(gl.FRAGMENT_SHADER, fragment),
        program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(program));
      this.program = program;
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      this.uniforms = {};
      for (const name of [
        "resolution",
        "drift",
        "density",
        "brightness",
        "fog",
        "glow",
        "reduced",
        "contrast",
        "turbulence",
        "softness",
        "evolution",
        "hasBolt",
        "lights[0]",
        "lightColours[0]",
      ])
        this.uniforms[name] = gl.getUniformLocation(program, name);
      const noise = new Uint8Array(256 * 256 * 4);
      for (let i = 0; i < noise.length; i += 4)
        ((noise[i] = noise[i + 1] = noise[i + 2] = Math.random() * 255),
          (noise[i + 3] = 255));
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        256,
        256,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        noise,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.uniform1i(gl.getUniformLocation(program, "noiseMap"), 0);
      this.boltColourTexture = this.makeCanvasTexture(1, "boltColour");
      this.boltDepthTexture = this.makeCanvasTexture(2, "boltDepth");
      this.lightData = new Float32Array(32);
      this.lightColourData = new Float32Array(24);
    }
    makeCanvasTexture(unit, uniformName) {
      const gl = this.gl;
      const texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(gl.getUniformLocation(this.program, uniformName), unit);
      return texture;
    }
    resize(w, h) {
      const cap = { efficient: 850, balanced: 1250, high: 1800 }[
        S.settings.quality
      ];
      const scale = Math.min(1, cap / w, 1000 / h);
      this.canvas.width = Math.round(w * scale);
      this.canvas.height = Math.round(h * scale);
      if (this.gl)
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    render(dt, events, boltCanvas, depthCanvas) {
      this.time += ((dt * S.settings.cloudspeed) / 100) * 0.022;
      if (this.lost) return;
      if (!this.gl) {
        this.renderFallback(events);
        return;
      }
      const gl = this.gl,
        u = this.uniforms,
        c = S.settings;
      gl.useProgram(this.program);
      gl.uniform2f(u.resolution, this.canvas.width, this.canvas.height);
      gl.uniform2f(u.drift, this.time + this.seed, 0);
      for (const [name, value] of Object.entries({
        density: c.clouddensity / 100,
        brightness: c.cloudbrightness / 100,
        fog: c.fogamount / 100,
        glow: c.lightningglow / 100,
        reduced: c.reducedflash ? 1 : 0,
        contrast: c.cloudcontrast / 100,
        turbulence: c.cloudturbulence / 100,
        softness: c.cloudsoftness / 100,
        evolution: this.time,
        hasBolt: events.length && boltCanvas && depthCanvas ? 1 : 0,
      }))
        gl.uniform1f(u[name], value);
      this.lightData.fill(0);
      this.lightColourData.fill(0);
      const candidates = [];
      for (const event of events) for (const sample of event.lightSamples || []) candidates.push(sample);
      candidates.sort((a, b) => b.power - a.power).slice(0, 8).forEach((sample, index) => {
        this.lightData.set([sample.x, sample.y, sample.power, sample.depth], index * 4);
        this.lightColourData.set(sample.colour, index * 3);
      });
      gl.uniform4fv(u["lights[0]"], this.lightData);
      gl.uniform3fv(u["lightColours[0]"], this.lightColourData);
      if (events.length && boltCanvas && depthCanvas) {
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.boltColourTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, boltCanvas);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.boltDepthTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, depthCanvas);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    makeFallback() {
      this.sprites = [];
      // Cache textured cloud banks once; no per-frame noise or particle allocation.
      for (let n = 0; n < 5; n++) {
        const c = document.createElement("canvas");
        c.width = 384;
        c.height = 224;
        const x = c.getContext("2d"),
          data = x.createImageData(c.width, c.height);
        const grid = Float32Array.from({ length: 128 * 128 }, () =>
          Math.random(),
        );
        const noise = (a, b) => {
          const ix = Math.floor(a),
            iy = Math.floor(b);
          let fx = a - ix,
            fy = b - iy;
          fx = fx * fx * (3 - 2 * fx);
          fy = fy * fy * (3 - 2 * fy);
          const at = (i, j) => grid[(i & 127) + (j & 127) * 128];
          return (
            (at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx) * (1 - fy) +
            (at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx) * fy
          );
        };
        for (let y = 0; y < c.height; y++)
          for (let z = 0; z < c.width; z++) {
            let f = 0,
              a = 0.55,
              scale = 0.018;
            for (let o = 0; o < 5; o++) {
              f += a * noise(z * scale + n * 19, y * scale);
              a *= 0.5;
              scale *= 2.1;
            }
            const mask = Math.max(
              0,
              1 -
                Math.pow((z / 384 - 0.5) * 2, 2) -
                Math.pow((y / 224 - 0.5) * 2, 2),
            );
            const i = (z + y * 384) * 4;
            data.data[i] = 24 + f * 31;
            data.data[i + 1] = 32 + f * 34;
            data.data[i + 2] = 45 + f * 37;
            data.data[i + 3] = S.clamp((f - 0.22) * mask * 650, 0, 245);
          }
        x.putImageData(data, 0, 0);
        this.sprites.push(c);
      }
    }
    renderFallback(events) {
      const ctx = this.ctx,
        w = this.canvas.width,
        h = this.canvas.height,
        c = S.settings;
      ctx.fillStyle = "#0a111f";
      ctx.fillRect(0, 0, w, h);
      for (let layer = 0; layer < 3; layer++) {
        ctx.globalAlpha =
          (0.36 + c.clouddensity / 160) * (0.5 + c.cloudbrightness / 100);
        for (let i = 0; i < 6; i++) {
          const span = w * 1.5;
          const x =
            ((((i * w * 0.32 +
              this.time * (layer % 2 ? 1 : -1) * w * (layer + 1) * 0.12) %
              span) +
              span) %
              span) -
            w * 0.35;
          ctx.drawImage(
            this.sprites[(i + layer) % 5],
            x,
            h * (layer * 0.18 - 0.2),
            w * 0.76,
            h * 0.74,
          );
        }
        for (const e of events) {
          ctx.globalCompositeOperation = "screen";
          for (const sample of (e.lightSamples || []).slice(0, 3)) {
            const gx = sample.x * w,
              gy = sample.y * h,
              g = ctx.createRadialGradient(gx, gy, 0, gx, gy, w * 0.3),
              rgb = sample.colour.map((part) => Math.round(part * 255));
            g.addColorStop(0, `rgba(${rgb.join(",")},${Math.min(0.58, sample.power * 0.4)})`);
            g.addColorStop(1, `rgba(${rgb.join(",")},0)`);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
          }
          ctx.globalCompositeOperation = "source-over";
        }
      }
      ctx.globalAlpha = 1;
      const mist = ctx.createLinearGradient(0, h * 0.3, 0, h);
      mist.addColorStop(0, "transparent");
      mist.addColorStop(1, `rgba(105,135,165,${c.fogamount / 700})`);
      ctx.fillStyle = mist;
      ctx.fillRect(0, 0, w, h);
    }
  }
  S.Clouds = Clouds;
})();
