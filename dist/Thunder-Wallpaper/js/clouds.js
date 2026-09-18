(() => {
  const S = Storm;
  const vertex = `attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
  const fragment = `
  precision highp float;
  varying vec2 uv;
  uniform sampler2D noiseMap, bolts;
  uniform vec2 resolution, drift;
  uniform float density, brightness, fog, glow, reduced, hasBolt;
  uniform vec3 lightningColor;
  uniform vec4 lights[4];
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return texture2D(noiseMap,(i+f+.5)/256.).r;}
  float fbm(vec2 p){float f=0.;float a=.53;for(int i=0;i<5;i++){f+=a*noise(p);p=mat2(1.63,1.17,-1.17,1.63)*p+17.3;a*=.49;}return f;}
  float field(vec2 p){vec2 w=vec2(noise(p*.7),noise(p*.7+49.));return fbm(p+w*.58);}
  void main(){
    vec2 st=vec2(uv.x,1.-uv.y);
    float aspect=resolution.x/resolution.y;
    vec2 p=vec2(st.x*aspect,st.y);
    vec2 d=drift;
    float far=field(p*3.1+vec2(d.x*.38,-d.x*.07)+11.);
    float main=field(p*3.5+vec2(-d.x*.65,d.x*.11)+42.);
    float near=field(p*2.8+vec2(d.x*.92,d.x*.06)+91.);
    float bank=1.-smoothstep(.53,.94,st.y);
    float a=smoothstep(.25,.65,far+density*.13)*.85;
    float b=smoothstep(.29,.63,main+density*.19+bank*.055)*.96;
    float c=smoothstep(.43,.76,near+density*.12)*(.22+bank*.5);
    float shade=field(p*3.5+vec2(-d.x*.65,d.x*.11)+42.+vec2(-.32,-.46));
    float rim=clamp((main-shade)*2.2+.06,0.,1.);
    vec3 sky=mix(vec3(.038,.060,.095),vec3(.075,.113,.166),smoothstep(.2,1.,st.y));
    vec3 col=mix(sky,vec3(.092,.119,.157)*( .68+far*.55),a);
    vec3 cloud=vec3(.035,.048,.069)+vec3(.25,.282,.325)*rim+main*.048;
    col=mix(col,cloud,b);
    col=mix(col,vec3(.034,.046,.065)+near*.046,c);
    col*=.5+brightness*1.12;
    vec3 light=vec3(0.);
    for(int i=0;i<4;i++){
      vec4 l=lights[i];
      vec2 delta=(st-l.xy)*vec2(aspect,1.);
      float dist=length(delta*vec2(.86,1.18));
      float spread=exp(-dist*dist/(.019+glow*.066));
      float filaments=.22+main*.95+rim*1.4;
      float transmission=mix(.38,1.,1.-c);
      light+=lightningColor*l.z*(spread*filaments*transmission*(.5+glow)+.012*(1.-reduced*.9));
    }
    col+=light;
    if(hasBolt>.5){vec3 bolt=texture2D(bolts,st).rgb;float internal=pow(1.-b,4.)*.24;float middle=pow(1.-c,2.)*(1.-b*.83);float energy=bolt.r*internal+bolt.g*middle+bolt.b;col+=mix(lightningColor,vec3(1.),smoothstep(.5,1.,energy)*.55)*energy*2.6;}
    float mist=fbm(p*2.+vec2(d.x*.24,117.));
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
        "lightningColor",
        "hasBolt",
        "lights[0]",
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
      this.boltTexture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.boltTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array(4),
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(gl.getUniformLocation(program, "bolts"), 1);
      this.lightData = new Float32Array(16);
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
    render(dt, events, boltCanvas) {
      this.time += ((dt * S.settings.cloudspeed) / 100) * 0.022;
      if (this.lost) return;
      if (!this.gl) {
        this.renderFallback(events, boltCanvas);
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
        hasBolt: events.length ? 1 : 0,
      }))
        gl.uniform1f(u[name], value);
      gl.uniform3fv(u.lightningColor, S.color());
      this.lightData.fill(0);
      events
        .slice(0, 4)
        .forEach((e, i) =>
          this.lightData.set([e.x, e.y, e.power, e.depth], i * 4),
        );
      gl.uniform4fv(u["lights[0]"], this.lightData);
      if (events.length) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.boltTexture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          boltCanvas,
        );
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
    renderFallback(events, bolts) {
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
          const gx = e.x * w,
            gy = e.y * h,
            g = ctx.createRadialGradient(gx, gy, 0, gx, gy, w * 0.32);
          g.addColorStop(
            0,
            `rgba(155,193,235,${Math.min(0.6, e.power * 0.42)})`,
          );
          g.addColorStop(1, "rgba(90,130,180,0)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          ctx.globalCompositeOperation = "source-over";
        }
      }
      ctx.globalAlpha = 1;
      const mist = ctx.createLinearGradient(0, h * 0.3, 0, h);
      mist.addColorStop(0, "transparent");
      mist.addColorStop(1, `rgba(105,135,165,${c.fogamount / 700})`);
      ctx.fillStyle = mist;
      ctx.fillRect(0, 0, w, h);
      // Fallback receives a normal-colour bolt canvas from the event renderer.
      ctx.globalCompositeOperation = "screen";
      ctx.drawImage(bolts, 0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
    }
  }
  S.Clouds = Clouds;
})();
