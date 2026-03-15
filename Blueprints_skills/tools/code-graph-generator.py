#!/usr/bin/env python3
"""
Code Graph Generator — Scans any codebase and produces a code_graph.json
mapping files, components, services, endpoints, DB collections, and their relationships.

Usage:
  python code-graph-generator.py --path /your/project
  python code-graph-generator.py --path /your/project --output graph.json --exclude node_modules dist
"""

import os
import re
import json
import sys
import hashlib
from pathlib import Path
from collections import defaultdict

# ── Supported extensions ──
CODE_EXTENSIONS = {
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.mts', '.cjs',
    '.vue', '.svelte',
    '.py', '.pyw',
    '.css', '.scss', '.less',
    '.json', '.yaml', '.yml', '.toml',
    '.md', '.mdx',
    '.html', '.htm',
    '.sql',
    '.prisma', '.graphql', '.gql',
    '.env', '.env.local', '.env.example',
    '.sh', '.bash', '.zsh', '.ps1',
}

# ── Default exclude dirs ──
DEFAULT_EXCLUDES = {
    'node_modules', '.next', '.turbo', '.git', '__pycache__',
    '.venv', 'venv', 'dist', 'build', '.cache', 'coverage',
    '.nuxt', '.svelte-kit', '.output', '.vercel', '.netlify',
    'vendor', '.mypy_cache', '.pytest_cache', '.tox', 'egg-info',
}

# ── Node type classification ──
TYPE_PATTERNS = {
    'test':       [r'\.test\.', r'\.spec\.', r'__tests__', r'\.cy\.', r'\.e2e\.'],
    'component':  [r'/components?/', r'\.component\.', r'\.widget\.'],
    'hook':       [r'/hooks?/', r'use[A-Z]'],
    'service':    [r'/services?/', r'\.service\.', r'/api/', r'/trpc/'],
    'middleware':  [r'/middleware', r'\.middleware\.'],
    'migration':  [r'/migrations?/', r'/seeds?/', r'\.migration\.'],
    'config':     [r'\.config\.', r'tsconfig', r'turbo\.json', r'next\.config', r'vite\.config',
                   r'tailwind\.config', r'postcss\.config', r'jest\.config', r'\.env', r'\.eslint',
                   r'\.prettier', r'babel\.config', r'webpack\.config'],
    'utility':    [r'/utils?/', r'/helpers?/', r'/lib/', r'\.util\.', r'\.helper\.'],
    'context':    [r'/contexts?/', r'\.context\.', r'Context\.'],
    'type':       [r'/types?/', r'\.types?\.', r'\.d\.ts$', r'/interfaces?/', r'\.interface\.'],
    'route':      [r'/routes?/', r'route\.ts', r'route\.js', r'/pages?/', r'/app/.*page\.', r'/app/.*layout\.'],
    'model':      [r'/models?/', r'\.model\.', r'schema\.prisma'],
    'style':      [r'\.css$', r'\.scss$', r'\.less$', r'\.styled\.'],
}


class CodeGraphGenerator:
    def __init__(self, root_path, excludes=None, output_path=None):
        self.root = Path(root_path).resolve()
        self.excludes = set(excludes or []) | DEFAULT_EXCLUDES
        self.output = output_path or str(self.root / 'code_graph.json')
        self.nodes = []
        self.edges = []
        self.node_ids = set()
        self.file_map = {}  # relative path -> node

    def generate(self):
        """Main entry: scan, classify, detect edges, write JSON."""
        print(f"  Scanning: {self.root}")
        self._scan_files()
        print(f"  Found {len(self.nodes)} files")

        self._detect_all_edges()
        print(f"  Detected {len(self.edges)} edges")

        # Detect additional non-file nodes (collections, endpoints, etc.)
        self._detect_db_collections()
        self._detect_endpoints()
        self._detect_events()
        self._detect_external_apis()

        graph = {
            'generator': 'code-graph-generator',
            'version': '2.0',
            'root': str(self.root),
            'nodes': self.nodes,
            'edges': self.edges,
            'metadata': {
                'total_nodes': len(self.nodes),
                'total_edges': len(self.edges),
                'node_types': dict(self._count_by('nodes', 'type')),
                'edge_types': dict(self._count_by('edges', 'type')),
            }
        }

        with open(self.output, 'w', encoding='utf-8') as f:
            json.dump(graph, f, indent=2, ensure_ascii=False)

        print(f"\n  ✅ Graph saved: {self.output}")
        print(f"     Nodes: {len(self.nodes)} ({len(graph['metadata']['node_types'])} types)")
        print(f"     Edges: {len(self.edges)} ({len(graph['metadata']['edge_types'])} types)")
        return graph

    def _should_exclude(self, path):
        parts = path.parts
        for excl in self.excludes:
            if excl in parts:
                return True
        return False

    def _scan_files(self):
        for dirpath, dirnames, filenames in os.walk(str(self.root)):
            # Prune excluded dirs in-place so os.walk skips them
            dirnames[:] = [d for d in dirnames if d not in self.excludes and d not in DEFAULT_EXCLUDES]
            
            for fname in filenames:
                filepath = Path(dirpath) / fname
                if filepath.suffix.lower() not in CODE_EXTENSIONS:
                    continue
                try:
                    size = filepath.stat().st_size
                    if size > 500_000:
                        continue
                except OSError:
                    continue

                rel = filepath.relative_to(self.root)
                rel_str = str(rel).replace('\\', '/')
                node = {
                    'id': rel_str,
                    'label': filepath.name,
                    'type': self._classify_file(rel_str),
                    'loc': self._count_lines(filepath),
                    'size': size,
                }
                self.nodes.append(node)
                self.node_ids.add(rel_str)
                self.file_map[rel_str] = node

    def _classify_file(self, rel_path):
        rel_lower = rel_path.lower()
        for node_type, patterns in TYPE_PATTERNS.items():
            for pat in patterns:
                if re.search(pat, rel_lower):
                    return node_type
        return 'file'

    def _count_lines(self, filepath):
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                return sum(1 for _ in f)
        except Exception:
            return 0

    def _detect_all_edges(self):
        for rel_str, node in self.file_map.items():
            filepath = self.root / rel_str
            try:
                content = filepath.read_text(encoding='utf-8', errors='ignore')
            except Exception:
                continue

            self._detect_imports(rel_str, content)
            self._detect_db_reads(rel_str, content)
            self._detect_db_writes(rel_str, content)
            self._detect_api_calls(rel_str, content)
            self._detect_cache_ops(rel_str, content)
            self._detect_event_refs(rel_str, content)

    # ── Import detection ──
    def _detect_imports(self, source, content):
        # ES imports: import ... from '...'
        for m in re.finditer(r'''(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]''', content):
            self._resolve_and_add_edge(source, m.group(1), 'imports')

        # require()
        for m in re.finditer(r'''require\s*\(\s*['"]([^'"]+)['"]\s*\)''', content):
            self._resolve_and_add_edge(source, m.group(1), 'imports')

        # dynamic import()
        for m in re.finditer(r'''import\s*\(\s*['"]([^'"]+)['"]\s*\)''', content):
            self._resolve_and_add_edge(source, m.group(1), 'imports')

        # Python imports
        if source.endswith('.py') or source.endswith('.pyw'):
            for m in re.finditer(r'^\s*(?:from|import)\s+([\w.]+)', content, re.MULTILINE):
                mod = m.group(1).replace('.', '/')
                self._resolve_and_add_edge(source, mod, 'imports')

        # CSS/SCSS imports
        for m in re.finditer(r'''@import\s+['"]([^'"]+)['"]''', content):
            self._resolve_and_add_edge(source, m.group(1), 'imports')

        # Prisma imports
        for m in re.finditer(r'''from\s+['"]@prisma/client['"]''', content):
            # Link to schema.prisma
            for node_id in self.node_ids:
                if 'schema.prisma' in node_id:
                    self._add_edge(source, node_id, 'imports')

    def _resolve_and_add_edge(self, source, import_path, edge_type):
        """Resolve a relative/alias import to a node ID."""
        if import_path.startswith('.'):
            # Relative import
            source_dir = str(Path(source).parent).replace('\\', '/')
            resolved = os.path.normpath(os.path.join(source_dir, import_path)).replace('\\', '/')
        elif import_path.startswith('@/') or import_path.startswith('~/'):
            # Common alias: @/ or ~/  → src/
            resolved = 'src/' + import_path[2:]
        elif import_path.startswith('@'):
            # Scoped package or monorepo workspace ref — try matching
            parts = import_path.split('/')
            if len(parts) >= 2:
                # Try packages/<name>/src/index or apps/<name>/src/index
                pkg_name = parts[1] if parts[0].startswith('@') else parts[0]
                sub_path = '/'.join(parts[2:]) if len(parts) > 2 else 'index'
                candidates = [
                    f'packages/{pkg_name}/src/{sub_path}',
                    f'packages/{pkg_name}/{sub_path}',
                    f'apps/{pkg_name}/src/{sub_path}',
                ]
                for cand in candidates:
                    target = self._try_extensions(cand)
                    if target:
                        self._add_edge(source, target, edge_type)
                        return
            return  # External package
        else:
            # Bare import (node_modules) — skip
            return

        target = self._try_extensions(resolved)
        if target:
            self._add_edge(source, target, edge_type)

    def _try_extensions(self, base_path):
        """Try to find a matching node with various extensions and index files."""
        # Exact match
        if base_path in self.node_ids:
            return base_path

        # Try extensions
        for ext in ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts', '.vue', '.svelte',
                    '.css', '.scss', '.json', '.py', '.prisma']:
            candidate = base_path + ext
            if candidate in self.node_ids:
                return candidate

        # Try index files
        for idx in ['index.ts', 'index.tsx', 'index.js', 'index.jsx', 'index.mjs']:
            candidate = base_path + '/' + idx
            if candidate in self.node_ids:
                return candidate

        return None

    # ── DB operations ──
    def _detect_db_reads(self, source, content):
        # Prisma reads
        for m in re.finditer(r'\.(\w+)\.(findMany|findFirst|findUnique|count|aggregate|groupBy)\b', content):
            collection = m.group(1)
            self._add_edge(source, f'collection:{collection}', 'db_read')

        # MongoDB reads
        for m in re.finditer(r'\.collection\([\'"](\w+)[\'"]\)\.(find|findOne|countDocuments|aggregate)', content):
            self._add_edge(source, f'collection:{m.group(1)}', 'db_read')

        # SQL reads
        for m in re.finditer(r'(?:SELECT|FROM)\s+[`"\']?(\w+)[`"\']?', content, re.IGNORECASE):
            table = m.group(1).lower()
            if table not in ('select', 'from', 'where', 'join', 'as', 'on', 'and', 'or', 'null', 'true', 'false'):
                self._add_edge(source, f'collection:{table}', 'db_read')

    def _detect_db_writes(self, source, content):
        # Prisma writes
        for m in re.finditer(r'\.(\w+)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b', content):
            collection = m.group(1)
            self._add_edge(source, f'collection:{collection}', 'db_write')

        # MongoDB writes
        for m in re.finditer(r'\.collection\([\'"](\w+)[\'"]\)\.(insertOne|insertMany|updateOne|updateMany|deleteOne|deleteMany)', content):
            self._add_edge(source, f'collection:{m.group(1)}', 'db_write')

    # ── API calls ──
    def _detect_api_calls(self, source, content):
        # fetch/axios to external APIs
        for m in re.finditer(r'''(?:fetch|axios\.(?:get|post|put|patch|delete)|\.get|\.post)\s*\(\s*[`'"](https?://[^'"`\s]+)''', content):
            url = m.group(1)
            # Extract domain
            domain = re.match(r'https?://([^/]+)', url)
            if domain:
                api_name = domain.group(1).replace('www.', '')
                self._add_edge(source, f'external_api:{api_name}', 'api_call')

        # Internal API calls
        for m in re.finditer(r'''(?:fetch|axios\.(?:get|post|put|patch|delete))\s*\(\s*[`'"](/api/[^'"`\s]+)''', content):
            endpoint = m.group(1)
            self._add_edge(source, f'endpoint:{endpoint}', 'api_call')

    # ── Cache operations ──
    def _detect_cache_ops(self, source, content):
        for m in re.finditer(r'''(?:redis|cache|localStorage|sessionStorage)\.(?:get|set|del|has)\s*\(\s*['"]([^'"]+)''', content, re.IGNORECASE):
            self._add_edge(source, f'cache_key:{m.group(1)}', 'cache')

    # ── Event references ──
    def _detect_event_refs(self, source, content):
        for m in re.finditer(r'''(?:emit|on|addEventListener|removeEventListener|subscribe|dispatch)\s*\(\s*['"]([^'"]+)['"]''', content):
            event_name = m.group(1)
            if len(event_name) < 50 and not event_name.startswith('http'):
                self._add_edge(source, f'event:{event_name}', 'event')

    # ── Detect non-file nodes ──
    def _detect_db_collections(self):
        collections = set()
        for e in self.edges:
            target = e['target']
            if target.startswith('collection:'):
                collections.add(target)
        for coll in collections:
            if coll not in self.node_ids:
                name = coll.split(':', 1)[1]
                self.nodes.append({
                    'id': coll,
                    'label': name,
                    'type': 'collection',
                })
                self.node_ids.add(coll)

    def _detect_endpoints(self):
        endpoints = set()
        for e in self.edges:
            target = e['target']
            if target.startswith('endpoint:'):
                endpoints.add(target)

        # Also scan route files for endpoint definitions
        for rel_str, node in self.file_map.items():
            if node['type'] == 'route':
                filepath = self.root / rel_str
                try:
                    content = filepath.read_text(encoding='utf-8', errors='ignore')
                except Exception:
                    continue
                for m in re.finditer(r'''(?:GET|POST|PUT|PATCH|DELETE|export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE))''', content):
                    # Infer endpoint from file path (Next.js app router style)
                    endpoint_path = '/' + str(Path(rel_str).parent).replace('\\', '/')
                    endpoint_path = re.sub(r'/app/', '/', endpoint_path)
                    endpoint_path = re.sub(r'/route$', '', endpoint_path)
                    endpoint_path = re.sub(r'/src', '', endpoint_path)
                    ep_id = f'endpoint:{endpoint_path}'
                    if ep_id not in self.node_ids:
                        endpoints.add(ep_id)
                        self._add_edge(rel_str, ep_id, 'defines')

        for ep in endpoints:
            if ep not in self.node_ids:
                name = ep.split(':', 1)[1]
                self.nodes.append({
                    'id': ep,
                    'label': name,
                    'type': 'endpoint',
                })
                self.node_ids.add(ep)

    def _detect_events(self):
        events = set()
        for e in self.edges:
            if e['target'].startswith('event:'):
                events.add(e['target'])
        for ev in events:
            if ev not in self.node_ids:
                name = ev.split(':', 1)[1]
                self.nodes.append({
                    'id': ev,
                    'label': name,
                    'type': 'event',
                })
                self.node_ids.add(ev)

    def _detect_external_apis(self):
        apis = set()
        for e in self.edges:
            if e['target'].startswith('external_api:'):
                apis.add(e['target'])
        for api in apis:
            if api not in self.node_ids:
                name = api.split(':', 1)[1]
                self.nodes.append({
                    'id': api,
                    'label': name,
                    'type': 'external_api',
                })
                self.node_ids.add(api)

    # ── Helpers ──
    def _add_edge(self, source, target, edge_type):
        # Avoid self-loops and duplicates
        if source == target:
            return
        edge = {'source': source, 'target': target, 'type': edge_type}
        # Simple dedup
        key = f"{source}|{target}|{edge_type}"
        if not hasattr(self, '_edge_keys'):
            self._edge_keys = set()
        if key not in self._edge_keys:
            self._edge_keys.add(key)
            self.edges.append(edge)

    def _count_by(self, collection, field):
        counts = defaultdict(int)
        items = self.nodes if collection == 'nodes' else self.edges
        for item in items:
            counts[item.get(field, 'unknown')] += 1
        return sorted(counts.items(), key=lambda x: -x[1])


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Generate a code graph for any project')
    parser.add_argument('--path', required=True, help='Root path of the project')
    parser.add_argument('--output', help='Output JSON file path (default: <project>/code_graph.json)')
    parser.add_argument('--exclude', nargs='*', default=[], help='Additional directories to exclude')
    args = parser.parse_args()

    gen = CodeGraphGenerator(args.path, excludes=args.exclude, output_path=args.output)
    gen.generate()


if __name__ == '__main__':
    main()
