# Third-party notices

Burrow includes third-party software distributed under its own terms. This notice is an inventory aid, not a replacement for the license texts shipped with each component or for legal review.

## Bundled authlib-injector

`resources/authlib-injector.jar` is authlib-injector **1.2.8**, upstream commit `5437f5b465ee3f5be0a1e5e1ae3c50978114f6fb`, by yushijinhun and contributors. Burrow verifies the bundled or fallback copy against SHA-256 `9c7f4343e6c82034958ffb48c14a2cb0c85928be7283103ce17da00c6d5a7b10` before launch.

- Project: <https://github.com/yushijinhun/authlib-injector>
- Corresponding release/source: <https://github.com/yushijinhun/authlib-injector/releases/tag/v1.2.8>
- License: GNU Affero General Public License, version 3
- Full license text in the JAR: `META-INF/licenses/authlib-injector.txt`

The JAR also carries its own notices for bundled components:

- ASM — BSD-style 3-clause terms in `META-INF/licenses/asm.txt`
- NanoHTTPD — BSD-style 3-clause terms in `META-INF/licenses/nanohttpd.txt`
- JSON.simple — Apache License 2.0 in `META-INF/licenses/json-simple.txt`

Redistributions that include this JAR must preserve the applicable notices and satisfy the corresponding source and license obligations.

## JavaScript dependencies

Runtime and development dependencies are declared in `package.json` and resolved exactly by `package-lock.json`. Packaged applications may include a subset selected by electron-builder. Their licenses remain the property of their respective authors.

Before redistributing a release, generate or review the dependency license inventory for the exact package output; do not treat this summary as a complete machine-generated bill of materials.

## GSAP

Burrow uses GSAP **3.15.0** for the selected mod-loader inventory slot. Copyright (c) 2008-2026, GreenSock. GSAP is distributed under its [standard no-charge license](https://gsap.com/standard-license), not Burrow's MIT license. The official [3.13 announcement](https://gsap.com/blog/3-13/) describes free commercial use. Original copyright notices remain in the bundled library. Burrow does not include the React Bits components or Lenis.

## Minecraft and provider content

Minecraft, Mojang, Microsoft, Modrinth, CurseForge, Java distributions, mods, modpacks, resource packs, shaders, and provider metadata retain their respective trademarks, copyrights, and distribution terms. Burrow is not affiliated with Mojang or Microsoft.

## Optional 3D illustration

The user-opened, lazy-loaded voxel illustration uses Three.js **0.186.1**, React Three Fiber **9.8.2**, and Drei **10.7.9** (OrbitControls). These are MIT-licensed projects; their original notices remain in the dependencies where supplied. Fiber does not ship a root license file in its npm package, so its upstream license is reproduced below. The scene geometry is authored for Burrow and does not read or represent a Minecraft save or modpack contents.

- Three.js: <https://github.com/mrdoob/three/blob/r186/LICENSE>
- React Three Fiber: <https://github.com/pmndrs/react-three-fiber/blob/d74622ea8ed717f7212d7e19d65ff3e325508389/LICENSE>
- Drei: <https://github.com/pmndrs/drei/blob/master/LICENSE>

### React Three Fiber license

MIT License

Copyright (c) 2019-2025 Poimandres

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Shipped 3D runtime notices

The exact license texts and provenance for the emitted optional illustration runtime are in [public/licenses/3d-illustration/index.json](public/licenses/3d-illustration/index.json). This inventory covers the nine packages that contribute code to the lazy illustration chunk, the additional Scheduler runtime in the shared React chunk, and React's MIT notice for the reconciler embedded in Fiber. It does not assign their license to Burrow or to other dependencies.

Vite copies this directory into `dist/licenses/3d-illustration`; the existing electron-builder `files` configuration includes `dist` in the packaged application. Three.js, Fiber and Drei remain exactly pinned build dependencies because their runtime code is bundled into the renderer. Unused MediaPipe/WASM/Draco development packages are not added to the production dependency graph. Fiber's npm distribution omits a license file, so its text is sourced from the exact upstream `v9.8.2` release commit listed in the inventory. The remaining texts are byte-for-byte copies of the pinned packages' installed license files.
