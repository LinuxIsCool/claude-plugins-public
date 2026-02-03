#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["hipporag>=0.1.0"]
# ///
from hipporag import HippoRAG
import inspect

# Get init signature
sig = inspect.signature(HippoRAG.__init__)
print("=== HippoRAG.__init__ parameters ===")
for name, param in sig.parameters.items():
    default = param.default
    if default is inspect.Parameter.empty:
        print(f"  {name}: (required)")
    else:
        print(f"  {name}: {repr(default)}")

# Look for embedding config
print("\n=== HippoRAG source location ===")
print(inspect.getfile(HippoRAG))

# Check if there's embedding model validation
import hipporag
print("\n=== hipporag module contents ===")
print([x for x in dir(hipporag) if not x.startswith('_')])
