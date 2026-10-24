// Necesita: npm install @grpc/grpc-js @grpc/proto-loader (en la carpeta desde la que se ejecuta)
// node emulador-pose.js rot x y z [pos x y z]   → gira/mueve el teléfono virtual (la cámara de la escena virtual le sigue)
const fs = require('fs'), path = require('path');
const grpc = require('@grpc/grpc-js'), loader = require('@grpc/proto-loader');
const LIB = path.join(process.env.LOCALAPPDATA, 'Android/Sdk/emulator/lib');
const ini = fs.readdirSync(path.join(process.env.LOCALAPPDATA, 'Temp/avd/running')).filter((f) => f.endsWith('.ini'))
  .map((f) => fs.readFileSync(path.join(process.env.LOCALAPPDATA, 'Temp/avd/running', f), 'utf8'))[0];
const token = /grpc.token=(.*)/.exec(ini)[1].trim(), port = /grpc.port=(\d+)/.exec(ini)[1];
const def = loader.loadSync(path.join(LIB, 'emulator_controller.proto'), { includeDirs: [LIB], enums: String });
const pkg = grpc.loadPackageDefinition(def).android.emulation.control;
const md = new grpc.Metadata(); md.add('authorization', 'Bearer ' + token);
const c = new pkg.EmulatorController('127.0.0.1:' + port, grpc.credentials.createInsecure());
const a = process.argv.slice(2);
const set = (target, data) => new Promise((ok, ko) => c.setPhysicalModel({ target, value: { data } }, md, (e) => (e ? ko(e) : ok())));
const get = (target) => new Promise((ok, ko) => c.getPhysicalModel({ target }, md, (e, r) => (e ? ko(e) : ok(r.value.data))));
(async () => {
  if (a[0] === 'rot') await set('ROTATION', a.slice(1, 4).map(Number));
  if (a[4] === 'pos') await set('POSITION', a.slice(5, 8).map(Number));
  console.log('rotación', (await get('ROTATION')).map((v) => v.toFixed(1)).join(' '), '· posición', (await get('POSITION')).map((v) => v.toFixed(2)).join(' '));
  process.exit(0);
})().catch((e) => { console.log('ERROR', e.message); process.exit(1); });
