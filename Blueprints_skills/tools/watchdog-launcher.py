#!/usr/bin/env python3
"""
Watchdog Launcher — Popup reminder to start the Code Graph Watcher.
Shows a Windows popup when a project with code_graph.json is detected.

Usage:
  python watchdog-launcher.py --path <project_folder>
  python watchdog-launcher.py                          # uses current directory
"""

import os
import sys
import subprocess
import tkinter as tk
from tkinter import messagebox
from pathlib import Path

def get_project_path():
    """Get project path from args or current directory."""
    if len(sys.argv) > 2 and sys.argv[1] == '--path':
        return sys.argv[2]
    return os.getcwd()

def is_watcher_running(project_path):
    """Check if a watcher is already running for this project."""
    try:
        result = subprocess.run(
            ['powershell', '-Command',
             f"Get-Process python -ErrorAction SilentlyContinue | "
             f"Where-Object {{$_.CommandLine -like '*code-graph-watcher*' -and $_.CommandLine -like '*{Path(project_path).name}*'}} | "
             f"Measure-Object | Select-Object -ExpandProperty Count"],
            capture_output=True, text=True, timeout=5
        )
        count = int(result.stdout.strip() or '0')
        return count > 0
    except Exception:
        return False

def launch_watcher(project_path):
    """Start the watcher as a hidden background process."""
    tools_dir = Path(__file__).parent
    watcher_script = tools_dir / 'code-graph-watcher.py'
    
    if not watcher_script.exists():
        messagebox.showerror('Error', f'Watcher not found:\n{watcher_script}')
        return False
    
    try:
        subprocess.Popen(
            [sys.executable, str(watcher_script), '--path', str(project_path)],
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        return True
    except Exception as e:
        messagebox.showerror('Error', f'Failed to start watcher:\n{e}')
        return False

def regenerate_graph(project_path):
    """Regenerate the code graph."""
    tools_dir = Path(__file__).parent
    generator_script = tools_dir / 'code-graph-generator.py'
    
    if not generator_script.exists():
        return False
    
    try:
        subprocess.Popen(
            [sys.executable, str(generator_script), '--path', str(project_path)],
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0,
        )
        return True
    except Exception:
        return False

def show_popup(project_path):
    """Show the launcher popup."""
    project_name = Path(project_path).name
    graph_exists = (Path(project_path) / 'code_graph.json').exists()
    already_running = is_watcher_running(project_path)
    
    # Create hidden root
    root = tk.Tk()
    root.withdraw()
    
    # Style the popup window
    popup = tk.Toplevel(root)
    popup.title('🔍 Code Graph Watcher')
    popup.geometry('420x320')
    popup.resizable(False, False)
    popup.configure(bg='#0d1117')
    
    # Center on screen
    popup.update_idletasks()
    x = (popup.winfo_screenwidth() // 2) - 210
    y = (popup.winfo_screenheight() // 2) - 160
    popup.geometry(f'+{x}+{y}')
    
    # Keep on top
    popup.attributes('-topmost', True)
    
    # Title
    tk.Label(popup, text='🔍 Code Graph Watcher', font=('Segoe UI', 16, 'bold'),
             bg='#0d1117', fg='#58a6ff').pack(pady=(20, 5))
    
    # Project name
    tk.Label(popup, text=f'Project: {project_name}', font=('Segoe UI', 11),
             bg='#0d1117', fg='#8b949e').pack(pady=(0, 10))
    
    # Status
    if already_running:
        status_text = '✅ Watcher is already running'
        status_color = '#3fb950'
    elif graph_exists:
        status_text = '📊 code_graph.json found — watcher not running'
        status_color = '#d29922'
    else:
        status_text = '⚠️ No code_graph.json — needs generation first'
        status_color = '#f85149'
    
    tk.Label(popup, text=status_text, font=('Segoe UI', 10),
             bg='#0d1117', fg=status_color).pack(pady=(0, 20))
    
    # Buttons frame
    btn_frame = tk.Frame(popup, bg='#0d1117')
    btn_frame.pack(pady=5)
    
    btn_style = {'font': ('Segoe UI', 10), 'width': 22, 'height': 1,
                 'cursor': 'hand2', 'relief': 'flat', 'bd': 0}
    
    def on_start():
        if not graph_exists:
            regenerate_graph(project_path)
        if launch_watcher(project_path):
            messagebox.showinfo('Started', f'Watcher running for {project_name}!\nIt will auto-update code_graph.json on file changes.')
        popup.destroy()
        root.destroy()
    
    def on_generate_only():
        if regenerate_graph(project_path):
            messagebox.showinfo('Generating', f'Regenerating code_graph.json for {project_name}...\nThis may take a few seconds.')
        popup.destroy()
        root.destroy()
    
    def on_skip():
        popup.destroy()
        root.destroy()
    
    if not already_running:
        tk.Button(btn_frame, text='▶  Start Watcher', bg='#238636', fg='white',
                  activebackground='#2ea043', command=on_start, **btn_style).pack(pady=4)
    
    tk.Button(btn_frame, text='🔄  Regenerate Graph', bg='#1f6feb', fg='white',
              activebackground='#388bfd', command=on_generate_only, **btn_style).pack(pady=4)
    
    tk.Button(btn_frame, text='⏭  Skip', bg='#21262d', fg='#8b949e',
              activebackground='#30363d', command=on_skip, **btn_style).pack(pady=4)
    
    # Keyboard shortcuts
    popup.bind('<Return>', lambda e: on_start() if not already_running else on_skip())
    popup.bind('<Escape>', lambda e: on_skip())
    
    popup.protocol('WM_DELETE_WINDOW', on_skip)
    popup.focus_force()
    root.mainloop()

def main():
    project_path = get_project_path()
    
    if not os.path.isdir(project_path):
        print(f'Error: {project_path} is not a valid directory')
        sys.exit(1)
    
    show_popup(project_path)

if __name__ == '__main__':
    main()
