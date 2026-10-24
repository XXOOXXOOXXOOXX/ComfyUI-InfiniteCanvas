# Human resource provenance

The local `humans.bin` contains eight fixed body profiles derived from the MakeHuman v2 pack distributed by:

- https://github.com/T8mars/Comfyui-Qwen-Image-2.1-MultiAngle-T8
- Fixed resource revision: `351506468a0cc53d8c8e80edd5066133c88f99a3`
- Original resource path: `web/vendor/assets/pose_studio_makehuman.v2.bin`
- Original SHA256: `b93d95b0d74f9afcc039540a81b72b5c1ffaf59fd704f556ca2be8e8da415eaa`
- Upstream MakeHuman mesh/morph/rig/weights: **CC0 1.0 Universal**, see `CC0-1.0.md` and `MAKEHUMAN-LICENSE.md`.
- Morph runtime attribution: VNCCS / MiuProject, MIT; preserved in `tools/VNCCS-LICENSE.txt` with the build-time source `tools/human_morph_runtime.mjs`.

The original 86 MB morph pack was processed offline using `tools/build_human_pack.mjs` into approximately 2.65 MB of fixed body geometry, bone pivots and skin weights. The plugin needs only this local derived pack at runtime. It does not contact the source repositories when opening the director, download inference weights, or depend on either upstream ComfyUI plugin. No upstream skin texture is included.

Rebuild with the verified original binary:

```text
node tools/build_human_pack.mjs path/to/pose_studio_makehuman.v2.bin
```

Three.js TransformControls uses the same 0.186.1 release as the other bundled Three.js modules and retains the MIT license in `web/vendor/three/LICENSE.txt`.
