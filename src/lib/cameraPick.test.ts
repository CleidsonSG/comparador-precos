import { test } from "node:test";
import assert from "node:assert/strict";
import { cameraName, parseCameraLabel, preferredCamera } from "./cameraPick.ts";

// nomes como o Chrome do Android mostra (celular com duas traseiras e duas frontais)
const ANDROID = [
  { id: "a", label: "camera 1, facing front" },
  { id: "b", label: "camera 3, facing front" },
  { id: "c", label: "camera 2, facing back" },
  { id: "d", label: "camera 0, facing back" },
];

test("lê número e lado da câmera", () => {
  assert.deepEqual(parseCameraLabel("camera 2, facing back"), { n: 2, facing: "back" });
  assert.deepEqual(parseCameraLabel("camera 1, facing front"), { n: 1, facing: "front" });
  assert.deepEqual(parseCameraLabel("HD Webcam (04f2:b6dd)"), { n: null, facing: null });
});

test("prefere a traseira principal (camera 0), não a primeira traseira da lista", () => {
  assert.equal(preferredCamera(ANDROID)?.id, "d");
});

test("sem nomes numerados (iPhone, notebook) não escolhe nada", () => {
  assert.equal(preferredCamera([{ id: "x", label: "Câmera Traseira" }, { id: "y", label: "Câmera Ultra-Angular Traseira" }]), null);
  assert.equal(preferredCamera([{ id: "w", label: "HD Webcam" }]), null);
  assert.equal(preferredCamera([]), null);
});

test("nomes em português no seletor", () => {
  assert.equal(cameraName(ANDROID[3], ANDROID), "Traseira 0 (principal)");
  assert.equal(cameraName(ANDROID[2], ANDROID), "Traseira 2");
  assert.equal(cameraName(ANDROID[0], ANDROID), "Frontal 1");
  assert.equal(cameraName({ id: "w", label: "HD Webcam" }, [{ id: "w", label: "HD Webcam" }]), "HD Webcam");
});
