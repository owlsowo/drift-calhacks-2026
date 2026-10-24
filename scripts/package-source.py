"""Package a pinned Git commit for local judge review, without uploading it.

Python standard library only. Keeps build sources and small evidence records;
leaves bulky evidence media in the repository and task review outputs.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / 'outputs'
MEDIA = {'.png', '.jpg', '.jpeg', '.webp', '.mp4', '.webm', '.mov'}
SIGNATURES = [
    re.compile(rb'sk-ant-[A-Za-z0-9_-]{20,}'),
    re.compile(rb'gh[pousr]_[A-Za-z0-9]{30,}'),
    re.compile(rb'github_pat_[A-Za-z0-9_]{30,}'),
    re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
]


def git(*args: str) -> bytes:
    return subprocess.check_output(['git', *args], cwd=ROOT, stderr=subprocess.PIPE)


def local_secret_values() -> list[bytes]:
    """Compare local ignored values in memory; never log or include the values."""
    values = []
    for path in [ROOT / '.env', ROOT / 'apps/web/.env.local']:
        if not path.is_file():
            continue
        for line in path.read_text().splitlines():
            if '=' not in line or line.lstrip().startswith('#'):
                continue
            name, value = line.split('=', 1)
            name = name.strip().removeprefix('export ')
            if name.startswith('VITE_') or not re.search(r'KEY|TOKEN|SECRET|PASSWORD', name, re.I):
                continue
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            if len(value) >= 12:
                values.append(value.encode())
    return values


def checked_path(name: str) -> PurePosixPath:
    path = PurePosixPath(name)
    if path.is_absolute() or '..' in path.parts or not path.parts:
        raise ValueError('Unsafe tracked archive path')
    if any(part in {'.git', '.spacetime', 'node_modules', 'dist'} for part in path.parts):
        raise ValueError(f'Private/runtime directory unexpectedly tracked: {name}')
    if (path.name == '.env' or path.name.startswith('.env.')) and path.name != '.env.example':
        raise ValueError(f'Private environment file unexpectedly tracked: {name}')
    if path.suffix.lower() in {'.pem', '.key', '.p12', '.pfx'} or path.name in {'id_rsa', 'id_ed25519'}:
        raise ValueError(f'Credential-like file unexpectedly tracked: {name}')
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ref', default='HEAD', help='Existing Git commit/ref, default HEAD')
    args = parser.parse_args()
    commit = git('rev-parse', '--verify', args.ref + '^{commit}').decode().strip()
    when = datetime.fromtimestamp(int(git('show', '-s', '--format=%ct', commit)), timezone.utc)
    prefix = f'drift-{commit[:7]}/'
    secret_values = local_secret_values()
    records, contents, excluded = {}, {}, []
    for entry in git('ls-tree', '-rz', commit).split(b'\0'):
        if not entry:
            continue
        metadata, raw_name = entry.split(b'\t', 1)
        mode, kind, object_id = metadata.split()
        name = raw_name.decode('utf-8')
        path = checked_path(name)
        if kind != b'blob' or mode not in {b'100644', b'100755'}:
            raise ValueError(f'Non-regular tracked source requires review: {name}')
        if name.startswith('docs/evidence/') and path.suffix.lower() in MEDIA:
            excluded.append(name)
            continue
        data = git('cat-file', 'blob', object_id.decode())
        if any(pattern.search(data) for pattern in SIGNATURES) or any(value in data for value in secret_values):
            raise ValueError(f'Possible credential found; archive refused for file: {name}')
        contents[name] = (data, int(mode, 8))
        records[name] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    for needed in ['package.json', 'package-lock.json', 'spacetimedb/src/index.ts',
                   'spacetimedb/package.json', 'apps/web/src/main.tsx', 'apps/web/public/credits.html',
                   'apps/web/public/assets/sea-shore.jpg', 'docs/asset-sources.md', '.env.example']:
        if needed not in records:
            raise ValueError(f'Required build/attribution file absent: {needed}')
    manifest = {
        'sourceCommit': commit,
        'commitTimeUtc': when.isoformat(),
        'scope': 'Tracked source snapshot; no Git history, dependencies, build output, real env files or Spacetime state. Bulky evidence images/video omitted; game photograph assets retained.',
        'fileCount': len(records),
        'files': records,
        'excludedMedia': excluded,
        'credentialChecks': {
            'knownSignatureScan': True,
            'localIgnoredValuesComparedInMemory': len(secret_values),
            'limits': 'Pattern/value comparison, not a guarantee that all private information has been identified. Selected review media need separate visual review.',
        },
        'publication': 'Created locally only. No judge access granted and nothing uploaded.',
    }
    OUT.mkdir(parents=True, exist_ok=True)
    archive = OUT / f'drift-source-{commit[:7]}.zip'
    manifest_name = 'SOURCE-SNAPSHOT.json'
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zipped:
        for name, (data, mode) in contents.items():
            info = zipfile.ZipInfo(prefix + name, when.timetuple()[:6])
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = mode << 16
            info.create_system = 3
            zipped.writestr(info, data)
        zipped.writestr(prefix + manifest_name, json.dumps(manifest, indent=2) + '\n')
    with zipfile.ZipFile(archive) as zipped:
        if zipped.testzip() is not None:
            raise ValueError('Archive CRC verification failed')
        if len(zipped.namelist()) != len(records) + 1:
            raise ValueError('Unexpected archive member count')
        for name, record in records.items():
            if hashlib.sha256(zipped.read(prefix + name)).hexdigest() != record['sha256']:
                raise ValueError(f'Archive content hash mismatch: {name}')
    proof = {
        'sourceCommit': commit,
        'archive': archive.name,
        'bytes': archive.stat().st_size,
        'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
        'files': len(records),
        'checks': ['Pinned commit resolved', 'Only regular tracked files packaged',
                   'Private/runtime paths excluded or refused', 'Credential signature/value scan passed',
                   'Required build/attribution files present', 'ZIP CRC and every file hash verified'],
        'cleanInstallBuild': 'Not run by this packaging command; record separately after extracting',
        'publication': 'Local artifact only; private repository visibility unchanged',
    }
    (OUT / f'drift-source-{commit[:7]}-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (OUT / 'drift-source-checkpoint.json').write_text(json.dumps(proof, indent=2) + '\n')
    print(json.dumps(proof, indent=2))


if __name__ == '__main__':
    main()
