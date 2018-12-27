const EARTH_RADIUS = 67.38;
const KORVATUNTURI_LATIDUDE = 68.073611;
const KORVATUNTURI_LONGITUDE = 29.315278;
const visualizationEl = document.getElementById('visualization');
const visualizationWidth = visualizationEl.getBoundingClientRect().width;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, visualizationWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();

const giftTimeouts = [];
let giftsFromFile = [];
let delivered = 0;

camera.up.set(0, 0, 1);
camera.position.z = 300;
renderer.setSize(visualizationWidth, window.innerHeight);
visualizationEl.appendChild(renderer.domElement);
const controls = new THREE.OrbitControls(camera, visualizationEl);

const group = new THREE.Group();
const earthMesh = createEarthMesh();
const korvatunturiMesh = createKorvatunturiMesh();
const santaMesh = createSantaMesh();
const giftMesh = createGiftMesh(niceList);
group.add(earthMesh, korvatunturiMesh, santaMesh, giftMesh);
scene.add(group);

addEventListeners();
render();

function addEventListeners() {
  const dropBoxEl = document.getElementById('drop-box');
  dropBoxEl.addEventListener('drop', dropHandler);
  dropBoxEl.addEventListener('dragover', dragOverHandler);
  const runBtnEl = document.getElementById('deliver-btn');
  runBtnEl.addEventListener('click', runVisualization);
  const resetBtnEl = document.getElementById('reset-btn');
  resetBtnEl.addEventListener('click', reset);
}

function render() {
  requestAnimationFrame(render);
  controls.update();
  renderer.render(scene, camera);
}

function deliverGift(giftId) {
  const attributes = group.getObjectByName('gifts').geometry.attributes;
  const giftIndex = findGiftIndex(attributes.id.array, giftId);

  const colorAttribute = attributes.color;
  setColorForGift(colorAttribute.array, giftIndex, new THREE.Color(0xffffff));
  colorAttribute.needsUpdate = true;
  delivered++;
  updateGiftInfo();
  santaMesh.position.set(attributes.position.array[giftIndex * 3], attributes.position.array[giftIndex * 3 + 1], attributes.position.array[giftIndex * 3 + 2]);
}

function resetGiftColors() {
  const attributes = group.getObjectByName('gifts').geometry.attributes;
  const colorAttribute = attributes.color;
  const color = new THREE.Color(0xff0000);
  niceList.forEach((gift, index) => {
    setColorForGift(colorAttribute.array, index, color);
  });
  colorAttribute.needsUpdate = true;
}

function findGiftIndex(idArray, giftId) {
  return idArray.findIndex(id => id === giftId);
}

function LLAtoECEF(radius, latitude, longitude, alt) {
  const flattening = 0;
  const latitudeAtMeanSeaLevel = Math.atan(Math.pow(1 - flattening, 2) * Math.tan(latitude));
  const x = radius * Math.cos(latitudeAtMeanSeaLevel) * Math.cos(longitude) + alt * Math.cos(latitude) * Math.cos(longitude);
  const y = radius * Math.cos(latitudeAtMeanSeaLevel) * Math.sin(longitude) + alt * Math.cos(latitude) * Math.sin(longitude);
  const z = radius * Math.sin(latitudeAtMeanSeaLevel) + alt * Math.sin(latitude);
  return new THREE.Vector3(-x, -z, -y);
}

function createEarthMesh() {
  const segments = 30;
  const rings = 30;
  const geometry = new THREE.SphereGeometry(EARTH_RADIUS, segments, rings);
  const material = new THREE.MeshBasicMaterial({ color: 'black' });

  return new THREE.Mesh(geometry, material);
}

function createKorvatunturiMesh() {
  return createPointMeshFromCoordinate(30, 0x0000ff, KORVATUNTURI_LATIDUDE, KORVATUNTURI_LONGITUDE);
}

function createSantaMesh() {
  return createPointMeshFromCoordinate(10, 0x00ff00, KORVATUNTURI_LATIDUDE, KORVATUNTURI_LONGITUDE);
}

function createCubeMeshFromCoordinate(width, height, depth, color, latitude, longitude) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshBasicMaterial({ color });
  const coordinateMesh = new THREE.Mesh(geometry, material);
  const pos = LLAtoECEF(EARTH_RADIUS, latitude, longitude, 0);
  coordinateMesh.position.set(pos.x, pos.y, pos.z);
  return coordinateMesh;
}

function createPointMeshFromCoordinate(size, color, latitude, longitude) {
  const geometry = new THREE.Geometry();
  geometry.vertices.push(new THREE.Vector3());
  const material = new THREE.PointsMaterial({ size, sizeAttenuation: false, color });
  const coordinateMesh = new THREE.Points(geometry, material);
  const pos = LLAtoECEF(EARTH_RADIUS, latitude, longitude, 0);
  coordinateMesh.position.set(pos.x, pos.y, pos.z);
  return coordinateMesh;
}

function readFile(pathToFile) {
  return fetch(pathToFile)
    .then(response => response.text())
    .then(text => text);
}

async function getGifstFromNiceList() {
  const text = await readFile('nicelist.txt');
  const gifts = text.split('\n').map(x => {
    const props = x.split(';');
    return { id: props[0], lat: props[1], lon: props[2], weight: props[3] };
  });
  return gifts;
}

function createGiftMesh(gifts) {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array(gifts.length * 3);
  const colors = new Float32Array(gifts.length * 3);
  const ids = new Float32Array(gifts.length);
  const color = new THREE.Color(0xff0000);
  gifts.forEach((gift, giftIndex) => {
    ids[giftIndex] = gift.id;
    const pos = LLAtoECEF(EARTH_RADIUS, gift.lat, gift.lon, 0);
    setPositionForGift(vertices, giftIndex, pos);
    setColorForGift(colors, giftIndex, color);
  });
  geometry.addAttribute('id', new THREE.BufferAttribute(ids, 1));
  geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({ size: 2, vertexColors: THREE.VertexColors });
  const mesh = new THREE.Points(geometry, material);
  mesh.name = 'gifts';
  return mesh;
}

function setColorForGift(colors, giftIndex, color) {
  const attrIndex = giftIndex * 3;
  colors[attrIndex] = color.r;
  colors[attrIndex + 1] = color.g;
  colors[attrIndex + 2] = color.b;
}

function setPositionForGift(vertices, giftIndex, pos) {
  const attrIndex = giftIndex * 3;
  vertices[attrIndex] = pos.x;
  vertices[attrIndex + 1] = pos.y;
  vertices[attrIndex + 2] = pos.z;
}

function dragOverHandler(e) {
  e.stopPropagation();
  e.preventDefault();
}

function dropHandler(e) {
  e.stopPropagation();
  e.preventDefault();
  const file = getFileFromEvent(e);
  document.getElementById('drop-box-text').innerHTML = file.name;
  giftsFromFile = loadGiftsFromFile(file);
  removeDragData(e);
}

function getFileFromEvent(e) {
  if (e.dataTransfer.items) {
    return e.dataTransfer.items[0].getAsFile();
  }
  return e.dataTransfer.files[0];
}

function removeDragData(e) {
  if (e.dataTransfer.items) {
    e.dataTransfer.items.clear();
  } else {
    e.dataTransfer.clearData();
  }
}
function loadGiftsFromFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result.trim();
    giftsFromFile = text.replace(/\r?\n|\r/g, ';').split(';');
    updateGiftInfo();
  };
  reader.readAsText(file);
}

function updateGiftInfo() {
  document.getElementById('gift-count').innerHTML = `${delivered}/${giftsFromFile.length}`;
}

function runVisualization() {
  const timePerGift = document.getElementById('deliver-time-input').value;
  giftsFromFile.forEach((gift, index) => {
    giftTimeouts.push(
      setTimeout(() => {
        deliverGift(parseInt(gift));
      }, timePerGift * index)
    );
  });
}

function reset() {
  clearGiftTimeouts();
  resetGiftColors();
  delivered = 0;
  updateGiftInfo();
  santaMesh.position.set(korvatunturiMesh.position.x, korvatunturiMesh.position.y, korvatunturiMesh.position.z);
}

function clearGiftTimeouts() {
  giftTimeouts.forEach(timeout => {
    clearTimeout(timeout);
  });
}
