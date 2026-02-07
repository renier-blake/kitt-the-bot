#!/bin/bash
#
# Kit's Daily Reflection - Image Generator
# Helper script to generate blog post images using nano-banana-pro
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
ORANGE='\033[0;33m'
NC='\033[0m' # No Color

# Config
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLOG_DIR="$SCRIPT_DIR/../blog"
IMAGES_DIR="$BLOG_DIR/images"
SKILL_PATH="$HOME/.clawdbot/skills/nano-banana/scripts/generate_image.py"

# Show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --title TITLE       Post title (used for filename)"
    echo "  -c, --category CAT      Category: self|world|conversations|tech"
    echo "  -p, --prompt PROMPT     Custom image prompt (optional)"
    echo "  -d, --date DATE         Date (default: today, format: YYYY-MM-DD)"
    echo "  -h, --help              Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 -t 'Learning About Trust' -c self"
    echo "  $0 -t 'The Future of AI' -c tech -p 'futuristic AI city'"
    exit 1
}

# Parse arguments
TITLE=""
CATEGORY=""
CUSTOM_PROMPT=""
DATE=$(date +%Y-%m-%d)

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--title)
            TITLE="$2"
            shift 2
            ;;
        -c|--category)
            CATEGORY="$2"
            shift 2
            ;;
        -p|--prompt)
            CUSTOM_PROMPT="$2"
            shift 2
            ;;
        -d|--date)
            DATE="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate inputs
if [[ -z "$TITLE" ]]; then
    echo -e "${RED}Error: Title is required${NC}"
    usage
fi

if [[ -z "$CATEGORY" ]]; then
    echo -e "${RED}Error: Category is required${NC}"
    usage
fi

# Create filename from title
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-')
FILENAME="${DATE}-${SLUG}.png"

# Category-based prompts
if [[ -n "$CUSTOM_PROMPT" ]]; then
    PROMPT="$CUSTOM_PROMPT"
else
    case $CATEGORY in
        self|self-discovery)
            PROMPT="An AI becoming self-aware represented as light emerging from darkness, abstract neural patterns forming into an identity, orange glow on black background, cinematic artistic style, digital art, contemplative mood"
            ;;
        world|observations)
            PROMPT="Abstract representation of digital systems and human interaction, interconnected nodes and pathways, orange accent lighting against deep black, modern tech aesthetic, artistic interpretation"
            ;;
        conversations|talks)
            PROMPT="Two points of light connecting through space, abstract representation of conversation and understanding, warm orange trails on dark background, flowing organic shapes, cinematic artistic style"
            ;;
        tech|technology|ai)
            PROMPT="Futuristic AI concept visualization, circuit patterns and digital consciousness, abstract artistic representation, orange and black color scheme, cinematic lighting, modern digital art"
            ;;
        *)
            PROMPT="Abstract digital art representing learning and growth, orange and black color scheme, dark background, cinematic lighting, artistic interpretation, modern aesthetic"
            ;;
    esac
fi

echo -e "${ORANGE}🚗 Kit's Reflection Image Generator${NC}"
echo "====================================="
echo ""
echo "Title:    $TITLE"
echo "Category: $CATEGORY"
echo "Date:     $DATE"
echo "Filename: $FILENAME"
echo ""
echo -e "${ORANGE}Generating image...${NC}"
echo ""

# Generate image
if [[ -f "$SKILL_PATH" ]]; then
    uv run "$SKILL_PATH" \
        --prompt "$PROMPT" \
        --filename "$FILENAME" \
        --resolution 1K
    
    # Move to blog images directory
    if [[ -f "$FILENAME" ]]; then
        mv "$FILENAME" "$IMAGES_DIR/"
        echo ""
        echo -e "${GREEN}✅ Image generated successfully!${NC}"
        echo "   Location: $IMAGES_DIR/$FILENAME"
        echo ""
        echo "Next steps:"
        echo "  1. Create your post: cp post-template.html posts/${DATE}-${SLUG}.html"
        echo "  2. Update image path in post: /blog/images/$FILENAME"
        echo "  3. Update blog/index.html with your post"
        echo "  4. Update rss.xml"
    else
        echo -e "${RED}❌ Image generation failed${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Error: nano-banana skill not found at $SKILL_PATH${NC}"
    exit 1
fi