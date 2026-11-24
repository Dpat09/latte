#!/usr/bin/env python3
"""Run a TUI in a pseudo-terminal, keep reading its output, send keys, sample memory.

usage: run.py <seconds> <sample_every> [--keys "t:key,t:key"] -- <cmd...>
Prints one line per sample: "<t> rss=<MB> fp=<MB>" (fp = macOS physical footprint,
or Linux RssAnon). With SHOW_SCREEN=1, prints the tail of the screen to stderr.
"""
import os, pty, re, subprocess, sys, time, select, signal

DARWIN = sys.platform == "darwin"

def mem(pid):
    if DARWIN:
        r = subprocess.run(["ps", "-o", "rss=", "-p", str(pid)], capture_output=True, text=True).stdout.strip()
        if not r:
            return None
        fp = subprocess.run(["footprint", "-p", str(pid)], capture_output=True, text=True).stdout
        m = re.search(r"phys_footprint:\s*([\d.]+)\s*([KMG]B)", fp)
        mb = float(m.group(1)) * {"KB": 1 / 1024, "MB": 1, "GB": 1024}[m.group(2)] if m else float("nan")
        return int(r) / 1024, mb
    try:
        d = {}
        with open(f"/proc/{pid}/status") as f:
            for l in f:
                k, _, v = l.partition(":")
                if k in ("VmRSS", "RssAnon"):
                    d[k] = int(v.split()[0]) / 1024
        return d["VmRSS"], d["RssAnon"]
    except (FileNotFoundError, KeyError):
        return None

def main():
    a = sys.argv[1:]
    sep = a.index("--")
    opts, cmd = a[:sep], a[sep + 1:]
    dur, every = float(opts[0]), float(opts[1])
    keys = []
    if "--keys" in opts:
        for item in opts[opts.index("--keys") + 1].split(","):
            t, k = item.split(":", 1)
            keys.append((float(t), k.encode()))
    pid, fd = pty.fork()
    if pid == 0:
        os.environ["TERM"] = "xterm-256color"
        os.execvp(cmd[0], cmd)
    t0 = time.time(); nxt = 0.0; buf = b""
    try:
        while True:
            t = time.time() - t0
            if t > dur:
                break
            r, _, _ = select.select([fd], [], [], 0.05)
            if r:
                try:
                    buf = (buf + os.read(fd, 65536))[-20000:]
                except OSError:
                    break
            while keys and t >= keys[0][0]:
                os.write(fd, keys.pop(0)[1])
            if t >= nxt:
                m = mem(pid)
                if m is None:
                    break
                print(f"{t:6.0f} rss={m[0]:.1f} fp={m[1]:.1f}", flush=True)
                nxt += every
    finally:
        # Keep reading while the child exits: on macOS a child blocks in exit
        # until its terminal output drains, so waitpid would hang forever.
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        deadline = time.time() + 3
        while True:
            done, _ = os.waitpid(pid, os.WNOHANG)
            if done:
                break
            if time.time() > deadline:
                os.kill(pid, signal.SIGKILL)
                deadline = float("inf")
            if select.select([fd], [], [], 0.05)[0]:
                try:
                    buf = (buf + os.read(fd, 65536))[-20000:]
                except OSError:
                    os.waitpid(pid, 0)
                    break
        os.close(fd)
    if os.environ.get("SHOW_SCREEN"):
        sys.stderr.write(re.sub(r"\x1b\[[0-9;?]*[a-zA-Z]", "", buf.decode("utf-8", "replace"))[-800:] + "\n")

main()
