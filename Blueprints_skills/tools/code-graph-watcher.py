#!/usr/bin/env python3
"""
Code Graph Watcher — Watches filesystem for changes and auto-regenerates code_graph.json.
Includes self-healing drift detection.

Usage:
  python code-graph-watcher.py --path /your/project
  python code-graph-watcher.py --path /your/project --interval 5 --heal-interval 10
  python code-graph-watcher.py --path /your/project --generate    # generate once then watch
  python code-graph-watcher.py --path /your/project --heal-only   # run self-heal check only
"""

import os
import sys
import time
import json
import threading
import hashlib
from pathlib import Path
from datetime import datetime

# Import the generator
sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
except ImportError:
    print("  ❌ watchdog not installed. Run: pip install watchdog")
    sys.exit(1)


CODE_EXTENSIONS = {
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.mts', '.cjs',
    '.vue', '.svelte', '.py', '.pyw',
    '.css', '.scss', '.less',
    '.json', '.yaml', '.yml', '.toml',
    '.prisma', '.graphql', '.gql',
    '.sql', '.html', '.htm',
}

IGNORE_DIRS = {
    'node_modules', '.next', '.turbo', '.git', '__pycache__',
    '.venv', 'venv', 'dist', 'build', '.cache', 'coverage',
}


def regenerate_graph(project_path, excludes=None):
    """Regenerate the code graph."""
    try:
        # Dynamic import to avoid circular deps
        spec = __import__('importlib').util.spec_from_file_location(
            'code_graph_generator',
            str(Path(__file__).parent / 'code-graph-generator.py')
        )
        mod = __import__('importlib').util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        gen = mod.CodeGraphGenerator(project_path, excludes=excludes)
        gen.generate()
        return True
    except Exception as e:
        print(f"  ❌ Regeneration failed: {e}")
        return False


class GraphFileHandler(FileSystemEventHandler):
    """Handles filesystem events with debouncing."""

    def __init__(self, project_path, debounce_seconds=3, excludes=None):
        super().__init__()
        self.project_path = project_path
        self.debounce = debounce_seconds
        self.excludes = excludes or []
        self._timer = None
        self._lock = threading.Lock()
        self._change_count = 0

    def _should_process(self, path):
        """Check if this file change should trigger regeneration."""
        # Skip ignored dirs
        for ignore in IGNORE_DIRS:
            if f'/{ignore}/' in path or f'\\{ignore}\\' in path:
                return False
        # Skip the graph file itself
        if 'code_graph.json' in path:
            return False
        # Only process code files
        ext = Path(path).suffix.lower()
        return ext in CODE_EXTENSIONS

    def on_any_event(self, event):
        if event.is_directory:
            return
        src = getattr(event, 'src_path', '')
        if not self._should_process(src):
            return

        with self._lock:
            self._change_count += 1
            if self._timer:
                self._timer.cancel()
            self._timer = threading.Timer(self.debounce, self._trigger_regen)
            self._timer.start()

    def _trigger_regen(self):
        with self._lock:
            count = self._change_count
            self._change_count = 0

        timestamp = datetime.now().strftime('%H:%M:%S')
        print(f"\n  [{timestamp}] 🔄 {count} file(s) changed — regenerating graph...")
        regenerate_graph(self.project_path, self.excludes)


class SelfHealingScheduler:
    """Periodically checks graph health and fixes drift."""

    def __init__(self, project_path, interval_minutes=10, excludes=None):
        self.project_path = project_path
        self.interval = interval_minutes * 60
        self.excludes = excludes or []
        self._running = False
        self._thread = None

    def start(self):
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False

    def _loop(self):
        while self._running:
            time.sleep(self.interval)
            if not self._running:
                break
            self._check_health()

    def _check_health(self):
        timestamp = datetime.now().strftime('%H:%M:%S')
        graph_path = Path(self.project_path) / 'code_graph.json'

        if not graph_path.exists():
            print(f"  [{timestamp}] 🏥 Self-heal: No graph found — regenerating...")
            regenerate_graph(self.project_path, self.excludes)
            return

        try:
            with open(graph_path, 'r', encoding='utf-8') as f:
                graph = json.load(f)
        except (json.JSONDecodeError, IOError):
            print(f"  [{timestamp}] 🏥 Self-heal: Corrupt graph — regenerating...")
            regenerate_graph(self.project_path, self.excludes)
            return

        # Check for drift: count actual source files vs graph nodes
        actual_files = 0
        root = Path(self.project_path)
        for fp in root.rglob('*'):
            if not fp.is_file():
                continue
            rel = fp.relative_to(root)
            skip = False
            for part in rel.parts:
                if part in IGNORE_DIRS:
                    skip = True
                    break
            if skip:
                continue
            if fp.suffix.lower() in CODE_EXTENSIONS:
                actual_files += 1

        graph_files = len([n for n in graph.get('nodes', []) if not n['id'].startswith(('collection:', 'endpoint:', 'event:', 'external_api:', 'cache_key:'))])
        drift = abs(actual_files - graph_files)
        drift_pct = (drift / max(actual_files, 1)) * 100

        if drift_pct > 15:
            print(f"  [{timestamp}] 🏥 Self-heal: {drift_pct:.0f}% drift ({actual_files} actual vs {graph_files} in graph) — regenerating...")
            regenerate_graph(self.project_path, self.excludes)
        else:
            print(f"  [{timestamp}] ✅ Health check: {drift_pct:.0f}% drift — OK")


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Watch project and auto-update code graph')
    parser.add_argument('--path', required=True, help='Root path of the project')
    parser.add_argument('--interval', type=int, default=3, help='Debounce interval in seconds')
    parser.add_argument('--heal-interval', type=int, default=10, help='Self-heal check interval in minutes')
    parser.add_argument('--exclude', nargs='*', default=[], help='Additional directories to exclude')
    parser.add_argument('--generate', action='store_true', help='Generate graph first, then watch')
    parser.add_argument('--heal-only', action='store_true', help='Run self-heal check and exit')
    args = parser.parse_args()

    project_path = str(Path(args.path).resolve())

    if args.heal_only:
        healer = SelfHealingScheduler(project_path, excludes=args.exclude)
        healer._check_health()
        return

    if args.generate:
        print("  Generating initial graph...")
        regenerate_graph(project_path, args.exclude)

    # Start watcher
    handler = GraphFileHandler(project_path, debounce_seconds=args.interval, excludes=args.exclude)
    observer = Observer()
    observer.schedule(handler, project_path, recursive=True)
    observer.start()

    # Start self-healer
    healer = SelfHealingScheduler(project_path, interval_minutes=args.heal_interval, excludes=args.exclude)
    healer.start()

    print(f"\n  👁️  Watching: {project_path}")
    print(f"  ⏱️  Debounce: {args.interval}s | Self-heal every {args.heal_interval}min")
    print(f"  Press Ctrl+C to stop\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        healer.stop()
        print("\n  Watcher stopped.")

    observer.join()


if __name__ == '__main__':
    main()
