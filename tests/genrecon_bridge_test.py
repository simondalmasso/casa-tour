"""Offline GenRecon adapter contract tests; upstream executable is a tiny dummy,
not a real CUDA reconstruction. No network, model downloads or real photos.
"""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BRIDGE = ROOT / "tools" / "genrecon-bridge.py"

FAKE_RECON = """
from pathlib import Path
import sys
out=Path(sys.argv[sys.argv.index('--output_path')+1])
out.mkdir(parents=True,exist_ok=True)
(out/'to_glb_inputs.pt').write_bytes(b'dummy-input')
(out/'chunk_inputs.pt').write_bytes(b'dummy-chunk')
"""

FAKE_CONVERT = """
import json,struct,sys
from pathlib import Path
out=Path(sys.argv[sys.argv.index('--output_dir')+1])
meta={'asset':{'version':'2.0'},'meshes':[{'primitives':[{'attributes':{'POSITION':0}}]}],'buffers':[{'byteLength':4}]}
raw=json.dumps(meta).encode()
padded=raw+b' '*((-len(raw))%4)
binary=b'\\0\\0\\0\\0'
total=12+8+len(padded)+8+len(binary)
glb=b'glTF'+struct.pack('<II',2,total)+struct.pack('<I',len(padded))+b'JSON'+padded+struct.pack('<I',len(binary))+b'BIN\\x00'+binary
(out/'scene.glb').write_bytes(glb)
"""


class GenReconBridgeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.repo = root / "repo"
        self.repo.mkdir()
        (self.repo / "reconstruct_scene.py").write_text(FAKE_RECON)
        (self.repo / "chunked_to_glb.py").write_text(FAKE_CONVERT)
        self.capture = root / "property-private"
        rgb = self.capture / "rgb"
        rgb.mkdir(parents=True)
        for index in range(8):
            (rgb / f"frame{index:02d}.jpg").write_bytes(b"FAKE-JPEG-METADATA")
        colmap = self.capture / "colmap"
        colmap.mkdir()
        for filename in ("cameras.txt", "images.txt", "points3D.txt"):
            (colmap / filename).write_text("# Mock COLMAP, format only\n")
        self.checkpoints = []
        for name in ("ss", "shape", "tex"):
            path = root / f"{name}.pt"
            path.write_bytes(b"placeholder")
            self.checkpoints.append(path)
        self.out = root / "result"

    def tearDown(self):
        self.tmp.cleanup()

    def command(self, *flags, output=None):
        args = [
            sys.executable, str(BRIDGE),
            "--repo", str(self.repo),
            "--capture", str(self.capture),
            "--output", str(output or self.out),
            "--ss-ckpt", str(self.checkpoints[0]),
            "--shape-ckpt", str(self.checkpoints[1]),
            "--tex-ckpt", str(self.checkpoints[2]),
            *flags,
        ]
        return subprocess.run(args, capture_output=True, text=True, check=False)

    def test_check_only_is_read_only(self):
        proc = self.command()
        self.assertEqual(proc.returncode, 0, proc.stderr)
        data = json.loads(proc.stdout)
        self.assertEqual(data["status"], "preflight_only")
        self.assertEqual(data["photosDetected"], 8)
        self.assertFalse(data["inputRightsAttested"])
        self.assertFalse(self.out.exists(), "Dry run must not create output or modify input files")

    def test_missing_colmap_and_short_capture_are_rejected(self):
        (self.capture / "colmap" / "cameras.txt").unlink()
        self.assertNotEqual(self.command().returncode, 0)
        (self.capture / "colmap" / "cameras.txt").write_text("# test\n")
        for frame in list((self.capture / "rgb").glob("*.jpg"))[:3]:
            frame.unlink()
        proc = self.command()
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("al menos 8", proc.stderr)

    def test_output_cannot_overwrite_capture_or_engine(self):
        self.assertNotEqual(self.command(output=self.capture / "generated").returncode, 0)
        self.assertNotEqual(self.command(output=self.repo / "out").returncode, 0)

    def test_execution_requires_input_and_dependency_rights(self):
        proc = self.command("--execute")
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("--rights-confirmed", proc.stderr)
        self.assertFalse(self.out.exists())

    def test_mock_upstream_result_is_unreviewed_not_publishable(self):
        proc = self.command("--execute", "--rights-confirmed", "--dependencies-reviewed")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        provenance = json.loads((self.out / "casa-tour-provenance.json").read_text())
        self.assertFalse(provenance["publishable"])
        self.assertEqual(provenance["status"], "generated_unreviewed")
        self.assertEqual(provenance["imageCount"], 8)
        self.assertEqual(len(provenance["sha256"]), 64)
        self.assertTrue(provenance["photoCopyrightRightsConfirmedByOperator"])
        self.assertFalse(provenance["surveyAccuracyVerified"])


if __name__ == "__main__":
    unittest.main()
