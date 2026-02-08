export async function loadMap(basePath) { // path to json

  //const img = await loadImage(basePath);
  //const { data, width, height, imageData } = getImageData(img);

  // load meta from json
  const meta = await fetch(basePath).then(r => r.json());
  let img
  if ("rle" in meta) {
    img = await extractImageFromRLE(meta);
  } else if ("imgPath" in meta) {
    // build path to image, relative to json
    const imgPath = basePath.substring(0, basePath.lastIndexOf("/") + 1) + meta.imgPath;
    img = await loadImageFromFilename(imgPath);
  } else {
    throw new Error("Track meta must contain either 'rle' or 'imgPath'.");
  }
  const { data, width, height, imageData } = getImageData(img);

  const materialIndex = new Uint8Array(img.width * img.height);
  const tiles = [];

  // Default Tile (Index 0)
  tiles.push(meta.tiles.default);

  // Color → Tile lookup bauen
  const colorMap = new Map();

  // Default Tile (Index 0)
  tiles.push(meta.tiles.default);

  Object.entries(meta.tiles.definitions).forEach(([key, def]) => {
    const [r, g, b] = def.color;

    const colorKey = `${r},${g},${b}`;

    // Index im tiles Array merken
    const tileIndex = tiles.length;

    colorMap.set(colorKey, tileIndex);
    tiles.push({
      rutsch: def.rutsch,
      brems: def.brems,
      solide: def.solide
    });

  });

  // Bitmap durchlaufen (TF_Load Logik)
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const idx = (y * img.width + x) * 4;

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const key = `${r},${g},${b}`;
      const tileIdx = colorMap.get(key) ?? 0;

      materialIndex[y * img.width + x] = tileIdx;
    }
  }

  // Checkpoint positionen von world -> meter
  meta.checkpoints.forEach(cp => {
    cp.x1 *= meta.metersPerPixel,
    cp.x2 *= meta.metersPerPixel,
    cp.y1 *= meta.metersPerPixel,
    cp.y2 *= meta.metersPerPixel
  })

  // Startpositionen von world -> meter
  meta.startPositions.forEach(sp => {
    sp.x *= meta.metersPerPixel,
    sp.y *= meta.metersPerPixel
  })

  meta.startPositionSP.x *= meta.metersPerPixel;
  meta.startPositionSP.y *= meta.metersPerPixel;

  return {
    image: img,
    imageData: imageData, 
    width: img.width,
    height: img.height,
    materialIndex,
    tiles,
    metersPerPixel: meta.metersPerPixel,
    startPositions: meta.startPositions,
    startPositionSP: meta.startPositionSP,
    checkpoints: meta.checkpoints,
    highscores: meta.highscores
  };
}


function extractImageFromRLE(data) {
  const { width, height } = data.rleMetadata;
  const palette = data.tiles.definitions;
  const rle = data.rle;

  // Canvas vorbereiten
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(width, height);
  const pixels = imageData.data; // Uint8ClampedArray

  // RLE dekodieren
  let pixelPos = 0; // zählt Pixel (nicht bytes)

  for (let i = 0; i < rle.length; i += 2) {
      const colorIndex = rle[i].toString();
      const runLength = rle[i + 1];
      const [r, g, b] = palette[colorIndex].color;

      for (let j = 0; j < runLength; j++) {
          const bytePos = pixelPos * 4;
          pixels[bytePos] = r;
          pixels[bytePos + 1] = g;
          pixels[bytePos + 2] = b;
          pixels[bytePos + 3] = 255; // alpha
          pixelPos++;
      }
  }

  ctx.putImageData(imageData, 0, 0);

  // Canvas -> Image
  return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = canvas.toDataURL();
  });
}


function loadImageFromFilename(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
  });
}


function getImageData(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, img.width, img.height);

  return {
    data: imageData.data,
    width: img.width,
    height: img.height,
    imageData,
  };
}


export async function loadCarType(path) {
  const data = await fetch(path).then(r => r.json());

  // Tabelle sicher sortieren (wichtig für Interpolation)
  const torqueTable = [...data.drehmomenttabelle]
    .sort((a, b) => a.upm - b.upm);

  return {
    masse: data.masse,
    length: data.length,
    width: data.width,
    radstand: data.radstand,

    luftwiderstand: data.luftwiderstand,
    bremswiderstand: data.bremswiderstand,
    motorkraft: data.motorkraft,

    drehmomenttabelle: torqueTable
  };
}


export function createPlayer() {
  const car = createCar()

  const reset = {
    startTime: 0,
    duration: 600, // ms
    from: { x: 0, y: 0 },
    to:   { x: 0, y: 0 },
    fromAngle: 0,
    toAngle: 0
  };

  const input = {
    keyboard: { steer: 0,
                active: false },
    mobile:   { touchSteer: 0,
                touchActive: false,
                gyroSteer: 0,
                gyroActive: false },
  };


  return {
    akCheckpoint: 0,
    akRunde: 0,
    startZeit: 0,
    lastZeit: 0,
    bestZeit: 0,
    currentGhost: [],   // während der Runde
    bestGhost: null,
    car: car,
    input: input,
    status: "driving", // oder "resetting"
    reset: reset
  }
}

export function createCar() {
  
  return {
    position: { x: 0, y: 0 },  // in m
    lastPosition: { x: 0, y: 0 },
    geschwindigkeit: 0, // m/s
    arrowUpKeyPressed: 0,
    arrowDownKeyPressed: 0,

    winkel: 0,
    bewegungswinkel: 0,
    winkelbeschleunigung: 0,

    gasstatus: 0,
    bremsstatus: 0,
    lenkeinschlag: 0,

    rutschigkeit: 1,
    bremswirkung: 0,

    gang: 1,
    upm: 0,

    color: "rgb(10, 110, 150)",
    roofColor: "rgb(30, 166, 219)",

    autotyp: {}
  };
}