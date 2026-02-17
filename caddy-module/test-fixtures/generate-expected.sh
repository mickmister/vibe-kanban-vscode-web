#!/bin/bash

# Script to generate expected injected HTML output
# Reads the original HTML and injection script, then injects the script before </body>

set -e

# Set paths relative to script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

INJECTION_SCRIPT="injection-scripts/phase1-test.js"
ORIGINAL_HTML="captured/original.html"
OUTPUT_HTML="expected/injected.html"

echo "=== Generating Expected Injected HTML ==="
echo ""

# Validate inputs exist
if [ ! -f "$INJECTION_SCRIPT" ]; then
    echo "ERROR: Injection script not found: $INJECTION_SCRIPT"
    exit 1
fi

if [ ! -f "$ORIGINAL_HTML" ]; then
    echo "ERROR: Original HTML not found: $ORIGINAL_HTML"
    exit 1
fi

# Read the injection script
echo "Reading injection script: $INJECTION_SCRIPT"
SCRIPT_SIZE=$(wc -c < "$INJECTION_SCRIPT" | tr -d ' ')
echo "  Script size: $SCRIPT_SIZE bytes"
echo ""

# Read the original HTML
echo "Reading original HTML: $ORIGINAL_HTML"
ORIGINAL_SIZE=$(wc -c < "$ORIGINAL_HTML" | tr -d ' ')
echo "  Original size: $ORIGINAL_SIZE bytes"
echo ""

# Create the injected version using Python
echo "Injecting script before </body> tag..."

python3 << PYTHON_SCRIPT
import sys
import re

# Read the original HTML
with open("$ORIGINAL_HTML", "r") as f:
    html = f.read()

# Read the injection script
with open("$INJECTION_SCRIPT", "r") as f:
    injection_script = f.read()

# Wrap in script tags
injection = "<script>\n" + injection_script + "\n</script>\n"

# Find </body> tag (case insensitive)
if not re.search(r'</body>', html, re.IGNORECASE):
    print("ERROR: </body> tag not found!", file=sys.stderr)
    sys.exit(1)

# Inject before </body>
result = re.sub(r'(</body>)', injection + r'\1', html, count=1, flags=re.IGNORECASE)

# Write output
with open("$OUTPUT_HTML", "w") as f:
    f.write(result)

print("Injection successful", file=sys.stderr)
PYTHON_SCRIPT

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to inject script"
    exit 1
fi

# Verify output was created
if [ ! -f "$OUTPUT_HTML" ]; then
    echo "ERROR: Output file was not created: $OUTPUT_HTML"
    exit 1
fi

OUTPUT_SIZE=$(wc -c < "$OUTPUT_HTML" | tr -d ' ')
echo "  Output size: $OUTPUT_SIZE bytes"
echo ""

# Calculate size difference
ADDED_SIZE=$((OUTPUT_SIZE - ORIGINAL_SIZE))
echo "Size Statistics:"
echo "  Original HTML:     $ORIGINAL_SIZE bytes"
echo "  Injection Script:  $SCRIPT_SIZE bytes"
echo "  Injected HTML:     $OUTPUT_SIZE bytes"
echo "  Bytes Added:       $ADDED_SIZE bytes"
echo "  Expected Added:    ~$((SCRIPT_SIZE + 19)) bytes (script + <script></script> tags + newlines)"
echo ""

# Verify the injection
echo "Verifying injection..."
if grep -q "__CADDY_INJECTION_TEST__" "$OUTPUT_HTML"; then
    echo "  ✓ Script content found in output"
else
    echo "  ✗ ERROR: Script content NOT found in output"
    exit 1
fi

if grep -q "</body>" "$OUTPUT_HTML"; then
    echo "  ✓ </body> tag still present"
else
    echo "  ✗ ERROR: </body> tag missing"
    exit 1
fi

# Check that script comes before </body>
SCRIPT_LINE=$(grep -n "__CADDY_INJECTION_TEST__" "$OUTPUT_HTML" | head -1 | cut -d: -f1)
BODY_LINE=$(grep -n "</body>" "$OUTPUT_HTML" | head -1 | cut -d: -f1)

if [ "$SCRIPT_LINE" -lt "$BODY_LINE" ]; then
    echo "  ✓ Script injected before </body> (line $SCRIPT_LINE < line $BODY_LINE)"
else
    echo "  ✗ ERROR: Script NOT before </body> (line $SCRIPT_LINE >= line $BODY_LINE)"
    exit 1
fi

echo ""
echo "=== Success! ==="
echo "Generated: $OUTPUT_HTML"
echo ""
