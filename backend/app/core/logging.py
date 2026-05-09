"""
Structured logging setup — all services import `logger` from here.
"""
import logging
import sys
from pathlib import Path


def setup_logging(debug: bool = True) -> logging.Logger:
    level = logging.DEBUG if debug else logging.INFO

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    fmt = logging.Formatter(
        "[%(asctime)s] %(levelname)-8s %(name)-30s  %(message)s",
        datefmt="%H:%M:%S",
    )
    handler.setFormatter(fmt)

    root = logging.getLogger("aiventra")
    root.setLevel(level)
    root.addHandler(handler)
    root.propagate = False
    return root


logger = setup_logging()
