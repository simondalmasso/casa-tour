#!/usr/bin/env python3
"""Casa Tour — guarded local adapter for upstream GenRecon (CUDA host only).

This adapter does NOT reconstruct from arbitrary unordered photos on its own.
GenRecon's Iphone mode needs RGB images + known COLMAP poses and sparse cloud.
It never uploads photos, clones repositories, installs dependencies or downloads
checkpoints. Actual execution requires explicit flags and commercial-rights review.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path


class PreflightError(ValueError):
    pass


def existing_file(path: Path, label: str) -> Path:
    if not path.is_file() or path.stat().st_size == 0:
        raise PreflightError(f"{label}: falta archivo no vacío: {path}")
    return path


def valid_capture(capture: Path, colmap_subdir: str, minimum_images: int) -> int:
    rgb = capture / "rgb"
    if not rgb.is_dir():
        raise PreflightError("Captura inválida: falta directorio rgb/ con fotogramas.")
    images = [p for p in rgb.iterdir()
              if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".jpeg"} and p.stat().st_size > 0]
    if len(images) < minimum_images:
        raise PreflightError(f"Se necesitan al menos {minimum_images} imágenes RGB legibles; hay {len(images)}.")
    if not re.fullmatch(r"[A-Za-z][\w-]{0,63}", colmap_subdir):
        raise PreflightError("Nombre de directorio COLMAP inválido.")
    colmap = capture / colmap_subdir
    for name in ("cameras.txt", "images.txt", "points3D.txt"):
        existing_file(colmap / name, f"COLMAP {name}")
    return len(images)


def preflight(args: argparse.Namespace) -> dict:
    repo = Path(args.repo).expanduser().resolve()
    capture = Path(args.capture).expanduser().resolve()
    output = Path(args.output).expanduser().resolve()
    if not repo.is_dir() or not capture.is_dir():
        raise PreflightError("Especificá carpetas --repo y --capture existentes.")
    if output == repo or output.is_relative_to(repo) or output == capture or output.is_relative_to(capture):
        raise PreflightError("--output debe quedar fuera de las carpetas del motor y de las capturas.")
    existing_file(repo / "reconstruct_scene.py", "GenRecon")
    existing_file(repo / "chunked_to_glb.py", "GenRecon")
    count = valid_capture(capture, args.colmap_subdir, args.min_images)
    ckpts = [Path(p).expanduser().resolve() for p in (args.ss_ckpt, args.shape_ckpt, args.tex_ckpt)]
    for label, path in zip(("sparse structure", "shape slat", "texture slat"), ckpts):
        existing_file(path, "Checkpoint " + label)
    command_recon = [
        args.python, str(repo / "reconstruct_scene.py"),
        "--mode", "Iphone", "--path", str(capture),
        "--output_path", str(output),
        "--colmap_subdir", args.colmap_subdir,
        "--ss_ckpt", str(ckpts[0]), "--shape_ckpt", str(ckpts[1]),
        "--tex_ckpt", str(ckpts[2]),
        "--num_imgs_per_scene", str(min(count, args.num_images)),
    ]
    command_glb = [
        args.python, str(repo / "chunked_to_glb.py"),
        "--inputs", str(output / "to_glb_inputs.pt"),
        "--chunk_inputs", str(output / "chunk_inputs.pt"),
        "--output_dir", str(output),
    ]
    return {
        "status": "ready_to_run" if args.execute else "preflight_only",
        "backend": "GenRecon upstream, local CUDA environment",
        "photosDetected": count,
        "poses": f"{args.colmap_subdir}/cameras.txt, images.txt, points3D.txt",
        "inputRightsAttested": bool(args.rights_confirmed),
        "dependenciesCommerciallyReviewed": bool(args.dependencies_reviewed),
        "automaticPhotoTo3D": False,
        "expectedOutput": str(output / "scene.glb"),
        "metricSurveyVerified": False,
        "commands": [command_recon, command_glb],
    }


def export_report(report: dict, output: Path, glb: Path) -> None:
    with glb.open("rb") as handle:
        header = handle.read(20)
        if len(header) != 20 or header[:4] != b"glTF" or int.from_bytes(header[4:8], "little") != 2:
            raise PreflightError("El output de GenRecon no es un GLB 2.0 válido.")
        if int.from_bytes(header[8:12], "little") != glb.stat().st_size or glb.stat().st_size < 28:
            raise PreflightError("El GLB resultante declara un tamaño incorrecto.")
        json_size = int.from_bytes(header[12:16], "little")
        if header[16:20] != b"JSON" or json_size < 2 or json_size > 32 * 1024 * 1024:
            raise PreflightError("El GLB carece de encabezado JSON válido.")
        json_bytes = handle.read(json_size)
        try:
            meta = json.loads(json_bytes)
        except (json.JSONDecodeError, UnicodeDecodeError) as error:
            raise PreflightError("GLB JSON inválido.") from error
        if meta.get("asset", {}).get("version") != "2.0" or not meta.get("meshes"):
            raise PreflightError("GLB sin geometría glTF 2.0.")
        external = [
            value.get("uri", "")
            for collection in ("images", "buffers")
            for value in meta.get(collection, [])
            if value.get("uri", "") and not value.get("uri", "").startswith("data:")
        ]
        if external:
            raise PreflightError("GLB incluye referencias a recursos externos no permitidos.")
        bin_header = handle.read(8)
        if len(bin_header) != 8 or bin_header[4:8] != b"BIN\\x00":
            raise PreflightError("GLB sin bloque binario autocontenido.")
        bin_size = int.from_bytes(bin_header[:4], "little")
        if 20 + json_size + 8 + bin_size != glb.stat().st_size:
            raise PreflightError("GLB truncado o con bloques inconsistentes.")
    sha = hashlib.sha256()
    with glb.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            sha.update(chunk)
    summary = {
        "schemaVersion": 1,
        "status": "generated_unreviewed",
        "backend": "GenRecon",
        "geometrySource": "multi_view_reconstruction_with_generative_prior",
        "imageCount": report["photosDetected"],
        "glb": str(glb),
        "sha256": sha.hexdigest(),
        "surveyAccuracyVerified": False,
        "unobservedGeometry": "generatively_inferred",
        "photoCopyrightRightsConfirmedByOperator": report["inputRightsAttested"],
        "thirdPartyDependenciesReviewedByOperator": report["dependenciesCommerciallyReviewed"],
        "publishable": False,
        "nextGate": "human camera-to-render, geometry continuity, license and metric QA",
    }
    (output / "casa-tour-provenance.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, help="Local, reviewed GenRecon checkout")
    parser.add_argument("--capture", required=True, help="Folder with rgb/ and colmap/ COLMAP text files")
    parser.add_argument("--output", required=True, help="Separate output directory")
    parser.add_argument("--ss-ckpt", required=True)
    parser.add_argument("--shape-ckpt", required=True)
    parser.add_argument("--tex-ckpt", required=True)
    parser.add_argument("--colmap-subdir", default="colmap")
    parser.add_argument("--min-images", type=int, default=8)
    parser.add_argument("--num-images", type=int, default=32)
    parser.add_argument("--python", default=sys.executable, help="Python from GenRecon CUDA environment")
    parser.add_argument("--execute", action="store_true", help="Actually run GPU pipeline and GLB conversion")
    parser.add_argument("--rights-confirmed", action="store_true", help="Operator attests rights to input photographs")
    parser.add_argument("--dependencies-reviewed", action="store_true", help="Operator attests third-party licenses were reviewed")
    args = parser.parse_args()
    try:
        if args.min_images < 2 or args.num_images < args.min_images or args.num_images > 999:
            raise PreflightError("Límites de imágenes incompatibles.")
        report = preflight(args)
        if not args.execute:
            print(json.dumps(report, indent=2, ensure_ascii=False))
            return 0
        if not args.rights_confirmed or not args.dependencies_reviewed:
            raise PreflightError("La ejecución requiere --rights-confirmed y --dependencies-reviewed.")
        output = Path(args.output).expanduser().resolve()
        output.mkdir(parents=True, exist_ok=True)
        # No shell=True, no implicit internet, no auto-downloads, no Cloudflare edge GPU.
        subprocess.run(report["commands"][0], cwd=Path(args.repo).expanduser().resolve(), check=True)
        for name in ("to_glb_inputs.pt", "chunk_inputs.pt"):
            existing_file(output / name, "Salida intermedia")
        subprocess.run(report["commands"][1], cwd=Path(args.repo).expanduser().resolve(), check=True)
        glb = existing_file(output / "scene.glb", "GLB final")
        export_report(report, output, glb)
        print(json.dumps({"status": "generated_unreviewed", "path": str(glb),
                          "provenance": str(output / "casa-tour-provenance.json")}, indent=2))
        return 0
    except (PreflightError, subprocess.CalledProcessError, OSError) as error:
        print("GenRecon no ejecutado / no validado: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
