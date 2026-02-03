#!/bin/bash
# Safe Test Script - Concrete Computing Philosophy
# "Measure twice, load once. Better small and working than large and frozen."
#
# Usage: ./safe-test.sh [probe|tiny|base|small]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=== Concrete Computing: Resource Probe ===${NC}"
echo ""

# Step 1: ALWAYS probe resources first
probe_resources() {
    echo -e "${YELLOW}Step 1: Probing system resources...${NC}"

    # Parse memory info
    MEM_AVAILABLE=$(free -b | awk '/^Mem:/{print $7}')
    MEM_AVAILABLE_GB=$(echo "scale=1; $MEM_AVAILABLE / 1073741824" | bc)

    SWAP_TOTAL=$(free -b | awk '/^Swap:/{print $2}')
    SWAP_USED=$(free -b | awk '/^Swap:/{print $3}')

    if [ "$SWAP_TOTAL" -gt 0 ]; then
        SWAP_PERCENT=$(echo "scale=0; $SWAP_USED * 100 / $SWAP_TOTAL" | bc)
    else
        SWAP_PERCENT=0
    fi

    echo "  RAM available: ${MEM_AVAILABLE_GB}GB"
    echo "  Swap used: ${SWAP_PERCENT}%"

    # Check GPU
    if command -v nvidia-smi &> /dev/null; then
        GPU_FREE=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits 2>/dev/null | head -1)
        echo "  GPU VRAM free: ${GPU_FREE}MB"
    else
        GPU_FREE=0
        echo "  GPU: Not available"
    fi

    # CRITICAL: Check swap state
    if [ "$SWAP_PERCENT" -gt 90 ]; then
        echo ""
        echo -e "${RED}⚠️  SWAP CRITICAL (${SWAP_PERCENT}%)${NC}"
        echo -e "${RED}System may freeze if large model is loaded.${NC}"
        echo -e "${RED}Recommendation: Free up RAM before proceeding.${NC}"
        SAFE_TO_PROCEED=false
    elif [ "$SWAP_PERCENT" -gt 70 ]; then
        echo ""
        echo -e "${YELLOW}⚠️  SWAP WARNING (${SWAP_PERCENT}%)${NC}"
        echo -e "${YELLOW}Use only tiny models.${NC}"
        SAFE_TO_PROCEED=true
    else
        echo ""
        echo -e "${GREEN}✓ System resources OK${NC}"
        SAFE_TO_PROCEED=true
    fi

    # RAM check
    if (( $(echo "$MEM_AVAILABLE_GB < 1.0" | bc -l) )); then
        echo -e "${RED}⚠️  RAM CRITICAL (<1GB)${NC}"
        echo -e "${RED}Only CPU-only models safe (Vosk).${NC}"
        SAFE_TO_PROCEED=false
    fi

    export SAFE_TO_PROCEED
    export MEM_AVAILABLE_GB
    export GPU_FREE
    export SWAP_PERCENT
}

# Step 2: Test with timeout
run_safe_test() {
    local MODEL=$1
    local TIMEOUT_SEC=${2:-30}

    echo ""
    echo -e "${YELLOW}Step 2: Running safe test (${TIMEOUT_SEC}s timeout)...${NC}"
    echo "  Model: $MODEL"

    # Create test audio if not exists
    TEST_AUDIO="/tmp/test_audio_10s.wav"
    if [ ! -f "$TEST_AUDIO" ]; then
        echo "  Creating 10s test audio..."
        ffmpeg -f lavfi -i "sine=frequency=440:duration=10" -ar 16000 -ac 1 "$TEST_AUDIO" -y 2>/dev/null
    fi

    echo "  Starting inference with timeout..."
    START_TIME=$(date +%s%N)

    # Run with timeout to prevent freezes
    if timeout ${TIMEOUT_SEC}s python3 -c "
import whisper
import time

start = time.time()
model = whisper.load_model('$MODEL')
load_time = time.time() - start

start = time.time()
result = model.transcribe('$TEST_AUDIO')
inference_time = time.time() - start

print(f'LOAD_TIME:{load_time:.2f}')
print(f'INFERENCE_TIME:{inference_time:.2f}')
print(f'SUCCESS:true')
" 2>&1; then
        echo -e "${GREEN}✓ Test completed successfully${NC}"
    else
        echo -e "${RED}✗ Test failed or timed out${NC}"
    fi
}

# Main
case "${1:-probe}" in
    probe)
        probe_resources
        echo ""
        echo -e "${CYAN}=== Recommendation ===${NC}"
        if [ "$SWAP_PERCENT" -gt 90 ]; then
            echo "  Status: BLOCKED"
            echo "  Action: Free memory before running any tests"
            echo "  Try: Close browsers, IDEs, other applications"
        elif (( $(echo "$MEM_AVAILABLE_GB < 2.0" | bc -l) )); then
            echo "  Status: CAUTION"
            echo "  Safe to test: tiny only"
            echo "  Command: ./safe-test.sh tiny"
        else
            echo "  Status: OK"
            echo "  Safe to test: tiny, base"
            echo "  Command: ./safe-test.sh tiny"
        fi
        ;;
    tiny)
        probe_resources
        if [ "$SAFE_TO_PROCEED" = true ]; then
            run_safe_test "tiny" 30
        else
            echo -e "${RED}Aborting: System not safe for model loading${NC}"
            exit 1
        fi
        ;;
    base)
        probe_resources
        if [ "$SAFE_TO_PROCEED" = true ] && (( $(echo "$MEM_AVAILABLE_GB >= 2.0" | bc -l) )); then
            run_safe_test "base" 45
        else
            echo -e "${RED}Aborting: Insufficient resources for base model${NC}"
            echo "  Need: 2GB+ available RAM"
            echo "  Have: ${MEM_AVAILABLE_GB}GB"
            exit 1
        fi
        ;;
    small)
        probe_resources
        if [ "$SAFE_TO_PROCEED" = true ] && (( $(echo "$MEM_AVAILABLE_GB >= 3.0" | bc -l) )); then
            run_safe_test "small" 60
        else
            echo -e "${RED}Aborting: Insufficient resources for small model${NC}"
            echo "  Need: 3GB+ available RAM"
            echo "  Have: ${MEM_AVAILABLE_GB}GB"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 [probe|tiny|base|small]"
        echo ""
        echo "  probe  - Check system resources (default)"
        echo "  tiny   - Test with whisper-tiny (safest)"
        echo "  base   - Test with whisper-base (needs 2GB+)"
        echo "  small  - Test with whisper-small (needs 3GB+)"
        exit 1
        ;;
esac

echo ""
echo -e "${CYAN}=== Concrete Computing Complete ===${NC}"
