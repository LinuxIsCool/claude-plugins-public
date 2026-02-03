# Marimo Deployment

## Deployment Options Overview

| Method | Use Case | Python Required |
|--------|----------|-----------------|
| `marimo run` | Local app server | Yes (server) |
| Static HTML | Simple sharing | No |
| WASM export | Interactive, no server | No (runs in browser) |
| Docker | Production deployment | Yes (container) |
| Hugging Face Spaces | Public sharing | Yes (hosted) |
| Railway | Cloud deployment | Yes (hosted) |
| Kubernetes | Enterprise scale | Yes (cluster) |
| Framework embed | Existing web app | Yes (app server) |

## Local App Server

Run as a web application (code hidden from users):

```bash
# Basic
marimo run notebook.py

# Custom port
marimo run notebook.py --port 8080

# Allow external access
marimo run notebook.py --host 0.0.0.0

# With auto-reload during development
marimo run notebook.py --watch
```

## Static HTML Export

Export to a standalone HTML file:

```bash
# Basic export
marimo export html notebook.py -o output.html

# With embedded assets
marimo export html notebook.py --include-code -o output.html
```

**Limitations:**
- No Python execution (static snapshot)
- Good for reports and documentation
- Widgets show final state only

## WASM Export (Browser Python)

Export with WebAssembly - Python runs entirely in the browser:

```bash
# Run mode (recommended for apps)
marimo export html-wasm notebook.py -o output_dir --mode run

# Edit mode (users can modify code)
marimo export html-wasm notebook.py -o output_dir --mode edit
```

Note: WASM export creates a **directory** with multiple files (HTML + assets), not a single file.

**Benefits:**
- Fully interactive
- No server needed
- Can be hosted on GitHub Pages, S3, etc.
- Users can modify and run code (edit mode)

**Limitations:**
- Initial load time (downloads Python runtime)
- Not all Python packages available
- ~10MB download for Pyodide runtime

## Docker Deployment

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install marimo and dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy notebook
COPY notebook.py .

# Expose port
EXPOSE 8080

# Run marimo
CMD ["marimo", "run", "notebook.py", "--host", "0.0.0.0", "--port", "8080"]
```

### Build and Run

```bash
docker build -t my-marimo-app .
docker run -p 8080:8080 my-marimo-app
```

## Framework Integration

### FastAPI

```python
from fastapi import FastAPI
import marimo

app = FastAPI()

# Create marimo ASGI app with multiple notebooks
server = (
    marimo.create_asgi_app()
    .with_app(path="/", root="./pages/index.py")
    .with_app(path="/analysis", root="./notebook.py")
)

# Mount marimo server
app.mount("/", server.build())

# Your other routes (must be defined before mounting)
@app.get("/api/data")
def get_data():
    return {"data": [1, 2, 3]}
```

### Starlette

```python
from starlette.applications import Starlette
from starlette.routing import Mount
import marimo

server = marimo.create_asgi_app().with_app(path="/", root="./notebook.py")

app = Starlette(
    routes=[Mount("/marimo", app=server.build())]
)
```

### FastHTML

```python
from fasthtml import FastHTML
import marimo

app = FastHTML()

# Create and mount marimo server
server = marimo.create_asgi_app().with_app(path="/", root="./notebook.py")
app.mount("/analysis", server.build())
```

## Hugging Face Spaces

1. Create a new Space with "Docker" SDK
2. Add your notebook and Dockerfile
3. Push to the Space repository

**Example `app.py`:**
```python
import subprocess
subprocess.run(["marimo", "run", "notebook.py", "--host", "0.0.0.0", "--port", "7860"])
```

## Railway / Render / Fly.io

Most PaaS platforms work with:

1. A `requirements.txt` with marimo
2. A start command: `marimo run notebook.py --host 0.0.0.0 --port $PORT`

## Kubernetes

Use the `marimo-operator` for Kubernetes deployments:

```yaml
apiVersion: marimo.io/v1alpha1
kind: MarimoNotebook
metadata:
  name: my-notebook
spec:
  notebook: notebook.py
  replicas: 3
  resources:
    requests:
      memory: "256Mi"
      cpu: "100m"
```

## GitHub Pages (WASM)

1. Export with WASM:
   ```bash
   marimo export html-wasm notebook.py -o docs/index.html
   ```

2. Enable GitHub Pages for `docs/` folder

3. Access at `https://username.github.io/repo/`

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Code execution | Use `marimo run` (hides code) for untrusted users |
| Data exposure | Don't embed secrets in notebooks |
| Resource limits | Set memory/CPU limits in Docker/K8s |
| Network access | Use firewall rules, reverse proxy |

## Performance Tips

- **Lazy mode** for expensive computations
- **Pre-compute** static data before deployment
- **Cache** external API calls
- **Minimize** package imports
- Use **WASM** for client-side compute when possible
