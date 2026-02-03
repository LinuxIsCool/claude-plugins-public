# Purpose

ONNX optimization delivers 5-10x faster CPU inference for embedding models through graph optimization and quantization. This guide covers conversion, quantization strategies, and production deployment patterns.

## Variables

ONNX_OPSET: 17
QUANTIZATION_TYPES: dynamic, static, QAT
SUPPORTED_MODELS: all-MiniLM-L6-v2, bge-small-en-v1.5, bge-base-en-v1.5, nomic-embed-text
SPEEDUP_FACTOR: 5-10x (CPU)
QUALITY_RETENTION: 99%+ (dynamic quantization)

## Instructions

### Installation

```bash
# Core ONNX packages
pip install onnx onnxruntime

# For GPU support
pip install onnxruntime-gpu

# For quantization tools
pip install onnxruntime-tools

# Optimum for easy conversion
pip install optimum[onnxruntime]

# All together
pip install sentence-transformers onnx onnxruntime optimum[onnxruntime]
```

### Quick Start: Pre-optimized Models

Many popular models have pre-optimized ONNX versions on HuggingFace:

```python
from optimum.onnxruntime import ORTModelForFeatureExtraction
from transformers import AutoTokenizer
import numpy as np

# Load pre-optimized ONNX model
model = ORTModelForFeatureExtraction.from_pretrained(
    "sentence-transformers/all-MiniLM-L6-v2",
    export=True  # Converts to ONNX if needed
)
tokenizer = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")

def get_embedding_onnx(text: str) -> np.ndarray:
    """Get embedding using ONNX runtime."""
    inputs = tokenizer(text, return_tensors="np", truncation=True, max_length=256)
    outputs = model(**inputs)
    # Mean pooling
    embedding = outputs.last_hidden_state.mean(axis=1).squeeze()
    return embedding

embedding = get_embedding_onnx("Hello world")
print(f"Shape: {embedding.shape}")  # (384,)
```

### Converting PyTorch to ONNX

#### Using Optimum (Recommended)

```python
from optimum.onnxruntime import ORTModelForFeatureExtraction
from transformers import AutoTokenizer
from pathlib import Path

def convert_to_onnx(
    model_name: str,
    output_dir: str,
    optimize: bool = True
):
    """Convert HuggingFace model to optimized ONNX."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Export to ONNX
    model = ORTModelForFeatureExtraction.from_pretrained(
        model_name,
        export=True
    )

    # Save ONNX model
    model.save_pretrained(output_path)

    # Save tokenizer
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    tokenizer.save_pretrained(output_path)

    print(f"Model saved to {output_path}")

    # Get file sizes
    for f in output_path.glob("*.onnx"):
        size_mb = f.stat().st_size / (1024 * 1024)
        print(f"  {f.name}: {size_mb:.1f} MB")

# Convert popular models
convert_to_onnx("sentence-transformers/all-MiniLM-L6-v2", "./onnx_models/minilm")
convert_to_onnx("BAAI/bge-small-en-v1.5", "./onnx_models/bge-small")
```

#### Manual Conversion

```python
import torch
from transformers import AutoModel, AutoTokenizer
import onnx
from onnxruntime.quantization import quantize_dynamic, QuantType

def manual_onnx_export(model_name: str, output_path: str):
    """Manual ONNX export with full control."""
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModel.from_pretrained(model_name)
    model.eval()

    # Create dummy input
    dummy_input = tokenizer(
        "This is a sample input",
        return_tensors="pt",
        padding="max_length",
        max_length=256,
        truncation=True
    )

    # Export to ONNX
    torch.onnx.export(
        model,
        (dummy_input['input_ids'], dummy_input['attention_mask']),
        output_path,
        input_names=['input_ids', 'attention_mask'],
        output_names=['last_hidden_state'],
        dynamic_axes={
            'input_ids': {0: 'batch_size', 1: 'sequence'},
            'attention_mask': {0: 'batch_size', 1: 'sequence'},
            'last_hidden_state': {0: 'batch_size', 1: 'sequence'}
        },
        opset_version=17,
        do_constant_folding=True
    )

    print(f"Exported to {output_path}")
    return output_path

manual_onnx_export(
    "sentence-transformers/all-MiniLM-L6-v2",
    "./model.onnx"
)
```

### Quantization

#### Dynamic Quantization (Recommended Start)

```python
from onnxruntime.quantization import quantize_dynamic, QuantType
import onnx

def quantize_dynamic_model(
    input_path: str,
    output_path: str,
    weight_type: QuantType = QuantType.QInt8
):
    """
    Apply dynamic quantization (weights only).
    Best balance of speed and quality.
    """
    quantize_dynamic(
        model_input=input_path,
        model_output=output_path,
        weight_type=weight_type,
        optimize_model=True
    )

    # Compare sizes
    original_size = Path(input_path).stat().st_size / (1024 * 1024)
    quantized_size = Path(output_path).stat().st_size / (1024 * 1024)
    reduction = (1 - quantized_size / original_size) * 100

    print(f"Original: {original_size:.1f} MB")
    print(f"Quantized: {quantized_size:.1f} MB")
    print(f"Size reduction: {reduction:.1f}%")

quantize_dynamic_model(
    "./model.onnx",
    "./model_quantized.onnx"
)
```

#### Static Quantization (Best Performance)

```python
from onnxruntime.quantization import (
    quantize_static,
    CalibrationDataReader,
    QuantType,
    QuantFormat
)
import numpy as np

class EmbeddingCalibrationData(CalibrationDataReader):
    """Calibration data reader for static quantization."""

    def __init__(self, tokenizer, calibration_texts: list, max_length: int = 256):
        self.tokenizer = tokenizer
        self.texts = calibration_texts
        self.max_length = max_length
        self.index = 0

    def get_next(self):
        if self.index >= len(self.texts):
            return None

        inputs = self.tokenizer(
            self.texts[self.index],
            return_tensors="np",
            padding="max_length",
            max_length=self.max_length,
            truncation=True
        )

        self.index += 1
        return {
            'input_ids': inputs['input_ids'],
            'attention_mask': inputs['attention_mask']
        }

def quantize_static_model(
    input_path: str,
    output_path: str,
    tokenizer,
    calibration_texts: list
):
    """
    Apply static quantization (weights + activations).
    Requires calibration data for best results.
    """
    calibration_reader = EmbeddingCalibrationData(
        tokenizer,
        calibration_texts
    )

    quantize_static(
        model_input=input_path,
        model_output=output_path,
        calibration_data_reader=calibration_reader,
        quant_format=QuantFormat.QDQ,
        weight_type=QuantType.QInt8,
        activation_type=QuantType.QUInt8,
        optimize_model=True
    )

# Calibration texts (representative sample)
calibration_texts = [
    "Machine learning is transforming technology.",
    "Python is a popular programming language.",
    "Natural language processing handles text data.",
    # Add 50-100 representative texts
]

tokenizer = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")
quantize_static_model(
    "./model.onnx",
    "./model_static_quantized.onnx",
    tokenizer,
    calibration_texts
)
```

### Production Embedding Client

```python
import onnxruntime as ort
from transformers import AutoTokenizer
import numpy as np
from pathlib import Path
from typing import List, Union

class ONNXEmbedder:
    """
    Production-ready ONNX embedding client.

    Features:
    - Optimized inference with configurable execution providers
    - Batch processing with automatic chunking
    - Memory-efficient embedding generation
    """

    def __init__(
        self,
        model_path: str,
        tokenizer_path: str = None,
        max_length: int = 256,
        device: str = "cpu",
        num_threads: int = 4
    ):
        self.max_length = max_length
        tokenizer_path = tokenizer_path or model_path

        # Load tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(tokenizer_path)

        # Configure session options
        sess_options = ort.SessionOptions()
        sess_options.intra_op_num_threads = num_threads
        sess_options.inter_op_num_threads = num_threads
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        # Select execution provider
        if device == "cuda":
            providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
        elif device == "tensorrt":
            providers = ['TensorrtExecutionProvider', 'CUDAExecutionProvider', 'CPUExecutionProvider']
        else:
            providers = ['CPUExecutionProvider']

        # Find ONNX file
        model_dir = Path(model_path)
        if model_dir.is_dir():
            onnx_files = list(model_dir.glob("*.onnx"))
            if onnx_files:
                onnx_path = str(onnx_files[0])
            else:
                raise ValueError(f"No ONNX file found in {model_path}")
        else:
            onnx_path = model_path

        # Create session
        self.session = ort.InferenceSession(
            onnx_path,
            sess_options=sess_options,
            providers=providers
        )

        # Get model info
        self.input_names = [inp.name for inp in self.session.get_inputs()]
        self.output_names = [out.name for out in self.session.get_outputs()]

    def _mean_pooling(self, token_embeddings: np.ndarray, attention_mask: np.ndarray) -> np.ndarray:
        """Apply mean pooling to token embeddings."""
        input_mask_expanded = np.expand_dims(attention_mask, axis=-1)
        sum_embeddings = np.sum(token_embeddings * input_mask_expanded, axis=1)
        sum_mask = np.clip(np.sum(input_mask_expanded, axis=1), a_min=1e-9, a_max=None)
        return sum_embeddings / sum_mask

    def encode(
        self,
        texts: Union[str, List[str]],
        batch_size: int = 32,
        normalize: bool = True,
        show_progress: bool = False
    ) -> np.ndarray:
        """
        Encode texts to embeddings.

        Args:
            texts: Single text or list of texts
            batch_size: Batch size for processing
            normalize: L2 normalize embeddings
            show_progress: Show progress bar

        Returns:
            Embeddings as numpy array
        """
        if isinstance(texts, str):
            texts = [texts]
            single = True
        else:
            single = False

        all_embeddings = []
        num_batches = (len(texts) + batch_size - 1) // batch_size

        iterator = range(0, len(texts), batch_size)
        if show_progress:
            from tqdm import tqdm
            iterator = tqdm(iterator, total=num_batches, desc="Encoding")

        for i in iterator:
            batch_texts = texts[i:i + batch_size]

            # Tokenize
            inputs = self.tokenizer(
                batch_texts,
                padding=True,
                truncation=True,
                max_length=self.max_length,
                return_tensors="np"
            )

            # Run inference
            onnx_inputs = {
                'input_ids': inputs['input_ids'].astype(np.int64),
                'attention_mask': inputs['attention_mask'].astype(np.int64)
            }

            # Add token_type_ids if required
            if 'token_type_ids' in self.input_names:
                onnx_inputs['token_type_ids'] = inputs.get(
                    'token_type_ids',
                    np.zeros_like(inputs['input_ids'])
                ).astype(np.int64)

            outputs = self.session.run(None, onnx_inputs)

            # Mean pooling
            embeddings = self._mean_pooling(outputs[0], inputs['attention_mask'])

            all_embeddings.append(embeddings)

        embeddings = np.vstack(all_embeddings)

        # Normalize
        if normalize:
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            embeddings = embeddings / norms

        if single:
            return embeddings[0]

        return embeddings

# Usage
embedder = ONNXEmbedder(
    model_path="./onnx_models/minilm",
    device="cpu",
    num_threads=4
)

# Single embedding
emb = embedder.encode("Hello world")
print(f"Shape: {emb.shape}")

# Batch embedding
texts = ["Text 1", "Text 2", "Text 3"]
embeddings = embedder.encode(texts, batch_size=2)
print(f"Batch shape: {embeddings.shape}")
```

### Benchmarking PyTorch vs ONNX

```python
import time
import numpy as np
from sentence_transformers import SentenceTransformer

def benchmark_comparison(model_name: str, onnx_path: str, num_samples: int = 1000):
    """Compare PyTorch and ONNX inference speed."""

    # Test data
    texts = [f"Sample document number {i} with some content." for i in range(num_samples)]

    # PyTorch model
    pytorch_model = SentenceTransformer(model_name)

    # ONNX model
    onnx_embedder = ONNXEmbedder(onnx_path)

    # Warmup
    pytorch_model.encode(texts[:10])
    onnx_embedder.encode(texts[:10])

    # Benchmark PyTorch
    start = time.time()
    pytorch_embs = pytorch_model.encode(texts, batch_size=32, show_progress_bar=False)
    pytorch_time = time.time() - start

    # Benchmark ONNX
    start = time.time()
    onnx_embs = onnx_embedder.encode(texts, batch_size=32)
    onnx_time = time.time() - start

    # Verify similarity
    similarity = np.mean([
        np.dot(p, o) / (np.linalg.norm(p) * np.linalg.norm(o))
        for p, o in zip(pytorch_embs, onnx_embs)
    ])

    print(f"Benchmark Results ({num_samples} samples)")
    print("-" * 40)
    print(f"PyTorch time: {pytorch_time:.2f}s ({num_samples/pytorch_time:.0f} docs/s)")
    print(f"ONNX time: {onnx_time:.2f}s ({num_samples/onnx_time:.0f} docs/s)")
    print(f"Speedup: {pytorch_time/onnx_time:.1f}x")
    print(f"Embedding similarity: {similarity:.6f}")

benchmark_comparison(
    "sentence-transformers/all-MiniLM-L6-v2",
    "./onnx_models/minilm"
)
```

### Optimization Levels

```python
import onnxruntime as ort

def create_optimized_session(onnx_path: str, optimization_level: str = "all"):
    """Create ONNX session with specific optimization level."""

    sess_options = ort.SessionOptions()

    levels = {
        "none": ort.GraphOptimizationLevel.ORT_DISABLE_ALL,
        "basic": ort.GraphOptimizationLevel.ORT_ENABLE_BASIC,
        "extended": ort.GraphOptimizationLevel.ORT_ENABLE_EXTENDED,
        "all": ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    }

    sess_options.graph_optimization_level = levels[optimization_level]

    # Enable memory optimizations
    sess_options.enable_mem_pattern = True
    sess_options.enable_mem_reuse = True

    # Enable CPU optimizations
    sess_options.intra_op_num_threads = 4
    sess_options.inter_op_num_threads = 4

    return ort.InferenceSession(
        onnx_path,
        sess_options=sess_options,
        providers=['CPUExecutionProvider']
    )
```

### GPU Acceleration

```python
import onnxruntime as ort

def create_gpu_session(onnx_path: str, device_id: int = 0):
    """Create ONNX session with GPU acceleration."""

    providers = [
        ('CUDAExecutionProvider', {
            'device_id': device_id,
            'arena_extend_strategy': 'kSameAsRequested',
            'gpu_mem_limit': 2 * 1024 * 1024 * 1024,  # 2GB
            'cudnn_conv_algo_search': 'EXHAUSTIVE',
        }),
        'CPUExecutionProvider'
    ]

    sess_options = ort.SessionOptions()
    sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

    session = ort.InferenceSession(
        onnx_path,
        sess_options=sess_options,
        providers=providers
    )

    # Verify GPU is being used
    print(f"Providers: {session.get_providers()}")

    return session

# TensorRT acceleration (NVIDIA GPUs)
def create_tensorrt_session(onnx_path: str):
    """Create ONNX session with TensorRT acceleration."""

    providers = [
        ('TensorrtExecutionProvider', {
            'device_id': 0,
            'trt_max_workspace_size': 2 * 1024 * 1024 * 1024,
            'trt_fp16_enable': True,  # Enable FP16
        }),
        ('CUDAExecutionProvider', {'device_id': 0}),
        'CPUExecutionProvider'
    ]

    return ort.InferenceSession(onnx_path, providers=providers)
```

### Model Size Comparison

| Model | PyTorch | ONNX | ONNX Quantized |
|-------|---------|------|----------------|
| all-MiniLM-L6-v2 | 91 MB | 91 MB | 23 MB |
| bge-small-en-v1.5 | 133 MB | 133 MB | 34 MB |
| bge-base-en-v1.5 | 438 MB | 438 MB | 110 MB |
| bge-large-en-v1.5 | 1.3 GB | 1.3 GB | 335 MB |

## Performance Characteristics

### Latency Comparison (all-MiniLM-L6-v2)

| Backend | Batch=1 | Batch=8 | Batch=32 |
|---------|---------|---------|----------|
| PyTorch CPU | 20ms | 80ms | 200ms |
| ONNX CPU | 4ms | 12ms | 35ms |
| ONNX Quantized | 1.5ms | 5ms | 15ms |
| ONNX GPU | 2ms | 3ms | 5ms |

### Throughput (docs/second)

| Backend | Configuration | Throughput |
|---------|---------------|------------|
| PyTorch CPU | Single thread | 50 |
| ONNX CPU | 4 threads | 250 |
| ONNX Quantized | 4 threads | 650 |
| ONNX GPU | RTX 3080 | 2000 |

### Quality Retention

| Quantization | Cosine Similarity | MTEB Score |
|--------------|-------------------|------------|
| None (FP32) | 1.000 | 56.0 |
| Dynamic INT8 | 0.9998 | 55.9 |
| Static INT8 | 0.9995 | 55.8 |

## Next Steps

- **Batch Processing**: See `cookbook/batch-processing.md` for large-scale pipelines
- **Model Selection**: See `cookbook/model-selection.md` for choosing base models
- **Unified Client**: See `tools/embedding_client.py` for provider-agnostic code
- **Benchmarking**: Use `tools/embedding_benchmark.py` to test optimizations
