#!/bin/bash

echo "============================================================"
echo "    AIVENTRA - OLLAMA LOCAL INFERENCE SETUP                 "
echo "============================================================"

# Check if Ollama is running
if ! curl -s http://localhost:11434 > /dev/null; then
    echo "[!] Ollama is not running. Please start Ollama before continuing."
    echo "    Linux: systemctl start ollama OR run 'ollama serve'"
    echo "    Mac: Open the Ollama app"
    exit 1
fi

echo "[+] Ollama is running locally. Pulling required AI models..."

# Define the models required by the project
MODELS=("llama3:8b" "mistral:7b" "nomic-embed-text")

for model in "${MODELS[@]}"; do
    echo "------------------------------------------------------------"
    echo "Checking model: $model"
    
    # Check if the model is already downloaded
    if ollama list | grep -q "$model"; then
        echo "[✓] Model '$model' is already installed."
    else
        echo "[-] Pulling '$model' (This may take several minutes depending on your connection)..."
        ollama pull "$model"
        echo "[✓] Successfully downloaded '$model'."
    fi
done

echo "------------------------------------------------------------"
echo "[✓] All models are ready! AIVentra local AI engine is primed."
echo "============================================================"
