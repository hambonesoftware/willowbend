import * as THREE from 'three';

const textures = new Map(), materials = new Map();
const wind = { value: 0 }, breeze = { value: 0 }, season = { value: 0 };
const windows = [], pools = [];
export const artNoise = index => {
  const n = Math.sin(index * 127.1 + 31.7) * 43758.5453;
  return n - Math.floor(n);
};

export function grainTexture(kind) {
  if (textures.has(kind)) return textures.get(kind);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const pen = canvas.getContext('2d');
  pen.fillStyle = '#f4f1e7';
  pen.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2000; i++) {
    const x = artNoise(i * 3) * 256, y = artNoise(i * 3 + 1) * 256;
    pen.fillStyle = i % 2 ? '#ffffff20' : '#3c342819';
    pen.fillRect(x, y, kind === 'wood' ? .7 : 1 + artNoise(i * 3 + 2) * 2, kind === 'wood' ? 8 + artNoise(i) * 38 : 1.3);
  }
  if (kind === 'masonry' || kind === 'paving') {
    const w = kind === 'paving' ? 40 : 64, h = kind === 'paving' ? 31 : 40;
    pen.lineWidth = kind === 'paving' ? 2.5 : 1.5;
    pen.strokeStyle = '#493f342b';
    for (let row = -1; row < 10; row++) for (let column = -1; column < 9; column++) {
      const x = column * w + row % 2 * w / 2;
      const y = row * h;
      pen.fillStyle = column % 2 ? '#fdf6dd24' : '#6b675014';
      pen.fillRect(x + 2, y + 2, w - 4, h - 4);
      pen.strokeRect(x, y, w, h);
    }
  }
  if (kind === 'roof') {
    pen.strokeStyle = '#34443c27';
    pen.lineWidth = 1;
    for (let y = 20; y < 256; y += 37) {
      pen.beginPath();
      pen.moveTo(0, y);
      pen.bezierCurveTo(80, y + 5, 160, y - 4, 256, y + 1);
      pen.stroke();
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  textures.set(kind, map);
  return map;
}

export function storyMaterial(color, kind = 'paint') {
  const key = kind + '|' + color;
  if (materials.has(key)) return materials.get(key);
  const material = new THREE.MeshStandardMaterial({
    color, roughness: kind === 'glass' ? .5 : .97,
    map: ['wood', 'plaster', 'masonry', 'paving', 'roof', 'cloth', 'soil'].includes(kind) ? grainTexture(kind) : null,
  });
  if (kind === 'foliage' || kind === 'reed') {
    material.side = THREE.DoubleSide;
    material.onBeforeCompile = shader => {
      shader.uniforms.artWind = wind;
      shader.uniforms.artBreeze = breeze;
      shader.uniforms.artSeason = season;
      shader.vertexShader = shader.vertexShader.replace('#include <common>',
        '#include <common>\nuniform float artWind; uniform float artBreeze;');
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec3 artPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        transformed.x += sin(artWind * .9 + artPosition.x * .6 + artPosition.z * .4)
          * artBreeze * (.18 + max(normal.y, 0.0) * .82);
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
        '#include <common>\nuniform float artSeason;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.5, .83, .52), artSeason);');
    };
    material.customProgramCacheKey = () => 'storybook-foliage';
  }
  if (kind === 'glass') {
    material.emissive.setHex(0xffc97d);
    windows.push(material);
  }
  materials.set(key, material);
  return material;
}

export function lampPoolMaterial() {
  if (pools.length) return pools[0];
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const pen = canvas.getContext('2d');
  const gradient = pen.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, '#ffe0a1aa');
  gradient.addColorStop(.5, '#ffe0a144');
  gradient.addColorStop(1, '#ffe0a100');
  pen.fillStyle = gradient;
  pen.fillRect(0, 0, 64, 64);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  pools.push(material);
  return material;
}

export function updateArt(time, day, reducedMotion) {
  wind.value = reducedMotion ? 0 : time;
  breeze.value = reducedMotion ? 0 : day.weather === 'Breezy' ? .065 : .025;
  season.value = day.season === 'Autumn' ? .55 : day.season === 'Winter' ? .22 : 0;
  const dark = day.phase === 'Night' ? 1 : day.phase === 'Evening' ? .7 : 0;
  for (const material of windows) material.emissiveIntensity = dark * .9;
  for (const material of pools) material.opacity = dark * .7;
}
