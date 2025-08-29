# /// script
# dependencies = [
# requires-python = ">=3.10"
#     python-fasthtml>=0.12.25",
#     "flask>=3.0.0",
#     "flask-cors>=4.0.0",
#     "llm>=0.13.1",
#     "typer>=0.9.0",
# ]
# ///

from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from flask_cors import CORS
import llm
import logging
import os
import typer
import uuid
from datetime import datetime
from pathlib import Path

from fasthtml.common import (
    Html, Head, Title, Meta, Script, Style, Body, Span, H3,
    Div, Input, Textarea, H2, Button, P, to_xml
)

#############################################################################################
##################################### UIE ###################################################
#############################################################################################
class DraftIndex:
    """FastHTML class-style component for draft/index.html."""

    def __init__(self):
        self.title = "Draft - AI-Powered Markdown Editor"

    def uie_head(self):
        return Head(
            Meta(charset="UTF-8"),
            Meta(name="viewport", content="width=device-width, initial-scale=1.0"),
            Title(self.title),
            Script(src="https://cdn.tailwindcss.com"),
            Script(src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"),
            Style("""
                button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                button:disabled:hover {
                    background-color: inherit !important;
                }
                .markdown-preview { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; line-height: 1.6; max-width: 100%; word-wrap: break-word; overflow-wrap: break-word; }
                .markdown-preview h1, .markdown-preview h2, .markdown-preview h3,
                .markdown-preview h4, .markdown-preview h5, .markdown-preview h6 { margin-top: 1.5em; margin-bottom: 0.5em; font-weight: 600; }
                .markdown-preview h1 { font-size: 2em; }
                .markdown-preview h2 { font-size: 1.5em; }
                .markdown-preview h3 { font-size: 1.25em; }
                .markdown-preview p { margin-bottom: 1em; }
                .markdown-preview code { background-color: #f5f5f5; padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-family: 'Monaco', 'Menlo', monospace; font-size: 0.875em; }
                .markdown-preview pre { background-color: #f5f5f5; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; margin-bottom: 1em; max-width: 100%; white-space: pre; word-break: normal; overflow-wrap: normal; }
                .markdown-preview pre code { background: none; padding: 0; display: block; white-space: pre; word-break: normal; overflow-wrap: normal; }
                .markdown-preview blockquote { border-left: 4px solid #e5e5e5; margin: 1em 0; padding-left: 1em; color: #666; }
                .markdown-preview ul, .markdown-preview ol { margin-bottom: 1em; padding-left: 1.5em; }
                .markdown-preview li { margin-bottom: 0.25em; }
                .markdown-preview figure { margin: 1.5em 0; text-align: center; }
                .markdown-preview figure img { max-width: 100%; height: auto; border-radius: 0.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
                .markdown-preview figcaption { margin-top: 0.5em; font-size: 0.875em; color: #6b7280; font-style: italic; }
                .markdown-preview a { color: #2563eb; text-decoration: underline; }
                .markdown-preview a:hover { color: #1d4ed8; text-decoration: none; }
            """),
        )

    def uie_editor_pane(self):
        # Editor pane header
        editor_header = Div(
            Input(
                id="documentName",
                type="text",
                _class="w-full text-sm font-mono text-gray-700 bg-transparent border-none focus:outline-none placeholder-gray-400",
                placeholder="Untitled document"
            ),
            _class="p-4 border-b border-gray-200 bg-gray-50 flex items-center"
        )
        # Main editor textarea
        editor_textarea = Textarea(
            id="editor",
            _class="flex-1 w-full p-8 text-gray-800 bg-white font-mono text-base leading-relaxed resize-none focus:outline-none border-2 border-transparent selection:bg-yellow-100 transition-colors",
            placeholder="Start writing your markdown here...\n\nTip: Drag and drop images here to upload them!"
        )
        # Editor pane
        editor_pane = Div(
            editor_header, 
            editor_textarea, 
            _class="flex-1 flex flex-col border-r border-gray-200" 
            )
        return editor_pane

    def uie_preview_pane(self):
        # Preview pane header
        preview_header = Div(
            H2("Preview", _class="text-sm font-medium text-gray-700"),
            Button(
                "Render",
                id="renderBtn",
                _class="px-2 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 hover:text-gray-700 transition-colors"
            ),
            _class="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between"
        )
        # Preview content area
        preview_content = Div(
            P("Start typing to see your markdown preview...", _class="text-gray-400 italic"),
            id="preview",
            _class="flex-1 p-8 overflow-y-auto overflow-x-auto markdown-preview text-gray-800"
        )
        # Preview pane
        preview_pane = Div(
            preview_header,
            preview_content,
            _class="flex-1 flex flex-col bg-white min-w-0"
        )
        return preview_pane
    
    def uie_command_palette(self):
        # Command palette selection preview
        selection_preview = Div(
            Span("Selected:", _class="text-xs text-amber-600 font-medium uppercase tracking-wide"),
            Div(_class="mt-1 text-sm text-gray-700 font-mono line-clamp-2"),
            id="selectionPreview",
            _class="px-6 py-3 bg-amber-50 border-b border-amber-200"
        )
        # Command palette prompt input
        prompt_section = Div(
            Input(
                id="promptInput",
                type="text",
                _class="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                placeholder="What would you like to do with this text?",
                autocomplete="off"
            ),
            Div(
                'Examples: "make this more formal", "fix grammar", "simplify", "translate to Spanish"',
                _class="mt-3 text-xs text-gray-500"
            ),
            _class="p-6"
        )
        # Command palette
        command_palette = Div(
            Div(
                selection_preview,
                prompt_section,
                _class="w-full max-w-2xl bg-white rounded-lg shadow-2xl border border-gray-200"
            ),
            id="commandPalette",
            _class="hidden fixed top-16 left-1/2 transform -translate-x-1/2 z-40"
        )

        return command_palette
    
    def uie_result_modal(self):
        # Result modal original text section
        original_section = Div(
            Span("Original:", _class="text-xs text-red-600 font-medium uppercase tracking-wide"),
            Div(id="originalText", _class="mt-2 text-sm text-gray-700 font-mono"),
            _class="mb-4 p-4 bg-red-50 rounded-lg border border-red-200"
        )
        
        # Result modal result text section
        result_section = Div(
            Span("Result:", _class="text-xs text-green-600 font-medium uppercase tracking-wide"),
            Div(id="resultText", _class="mt-2 text-sm text-gray-700 font-mono"),
            _class="mb-6 p-4 bg-green-50 rounded-lg border border-green-200"
        )
        
        # Result modal actions
        modal_actions = Div(
            Button("Accept (Enter)",id="acceptBtn",_class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"),
            Button("Try Again (X)" ,id="rerunBtn" ,_class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"),
            Button("Cancel (Esc)"  ,id="cancelBtn",_class="ml-auto px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"),
            _class="flex gap-2"
        )
        # Result modal content
        modal_content = Div(
            H3(
                Span("Result", id="commandName"),
                Span("Attempt ",
                    Span("1", id="attemptNumber"),
                    _class="text-sm text-gray-500 ml-2"
                ),
                _class="text-lg font-medium text-gray-900 mb-4"
            ),
            original_section, 
            result_section, 
            modal_actions,
            _class="relative top-8 mx-auto max-w-2xl bg-white rounded-lg shadow-xl border border-gray-200 p-6 my-8 max-h-[calc(100vh-4rem)] overflow-y-auto"
        )

        # Result modal
        result_modal = Div(
            Div(_class="absolute inset-0 bg-black bg-opacity-25"),  # Backdrop
            modal_content,
            id="resultModal",
            _class="hidden fixed inset-0 z-50"
        )

        return result_modal

    def uie_main_layout(self):
        return Div(
            self.uie_editor_pane(),
            self.uie_preview_pane(),
            _class="h-screen flex",
        )

    def uie_page(self):
        return Html(
            self.uie_head(),
            Body(
                self.uie_main_layout(),
                self.uie_command_palette(),
                self.uie_result_modal(),
                Script(src="app.js"),
                _class="bg-gray-50",
            ),
        )

    @staticmethod
    def render_html() -> str:
        page = DraftIndex().uie_page()
        return to_xml(page)

#############################################################################################
##################################### SERVER (FLASK) ########################################
#############################################################################################

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from frontend

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Flask app configuration will be used instead of globals

@app.route('/')
def index():
    """Serve the main application"""
    package_dir = Path(__file__).parent
    #return send_from_directory(str(package_dir), 'index.html')
    return DraftIndex().render_html()

@app.route('/app.js')
def app_js():
    """Serve the JavaScript file"""
    package_dir = Path(__file__).parent
    return send_from_directory(str(package_dir), 'app.js')

@app.route('/images/<document_name>/<filename>')
def serve_image(document_name, filename):
    """Serve images from document folders"""
    try:
        logger.info(f"Image request: {document_name}/{filename}")
        
        # Validate document name
        sanitized_name = sanitize_document_name(document_name)
        if not sanitized_name:
            logger.error(f"Invalid document name: {document_name}")
            return "Invalid document name", 400
        
        # Get document folder
        doc_folder = get_document_folder(document_name)
        logger.info(f"Looking for image in: {doc_folder}")
        
        if not doc_folder.exists():
            logger.error(f"Document folder not found: {doc_folder}")
            return "Document folder not found", 404
        
        # Check if file exists
        file_path = doc_folder / filename
        if not file_path.exists():
            logger.error(f"Image file not found: {file_path}")
            return "Image file not found", 404
        
        logger.info(f"Serving image: {file_path}")
        # Serve the image file
        return send_from_directory(str(doc_folder), filename)
        
    except Exception as e:
        logger.error(f"Error serving image: {e}")
        return "Image not found", 404

@app.route('/api/process', methods=['POST'])
def process_text():
    """Process text with AI based on custom prompt"""
    try:
        data = request.get_json()
        
        # Extract required fields
        text = data.get('text', '').strip()
        prompt = data.get('prompt', '').strip()
        
        if not prompt:
            return jsonify({'error': 'Prompt is required'}), 400
        
        # Optional fields
        attempt = data.get('attempt', 1)
        context_before = data.get('context', {}).get('before', '')
        context_after = data.get('context', {}).get('after', '')
        
        logger.info(f"Processing request - Prompt: '{prompt[:50]}...', Text length: {len(text)}")
        
        # Build the full prompt with context
        full_prompt = build_prompt(text, prompt, context_before, context_after)
        
        # Use LLM to process the text
        model_name = app.config.get('MODEL_NAME', 'gpt-3.5-turbo')
        model = llm.get_model(model_name)
        response = model.prompt(full_prompt)
        
        result = response.text().strip()
        
        return jsonify({
            'id': f"result_{attempt}_{hash(text + prompt) % 10000}",
            'original': text,
            'result': result,
            'prompt': prompt,
            'attempt': attempt,
            'metadata': {
                'model': model_name,
                'tokens': len(full_prompt.split()) + len(result.split()),
                'success': True
            }
        })
        
    except Exception as e:
        logger.error(f"Error processing text: {str(e)}")
        return jsonify({
            'error': 'Failed to process text',
            'message': str(e)
        }), 500

def build_prompt(text, user_prompt, context_before="", context_after=""):
    """Build the full prompt for the LLM"""
    
    # Start with system prompt if available
    system_prompt = app.config.get('SYSTEM_PROMPT', '')
    if system_prompt:
        system_section = f"{system_prompt}\n\n"
    else:
        system_section = ""
    
    # Handle text generation vs text editing
    if not text.strip():
        # Generation mode - no text selected
        if system_prompt:
            # If we have a system prompt, just add the user request
            base_instruction = f"The user wants you to generate text based on this request: {user_prompt}"
        else:
            # Default instruction if no system prompt
            base_instruction = f"""You are a helpful writing assistant. The user wants you to generate text based on this request: {user_prompt}

Please respond with ONLY the generated text, without any explanation or additional commentary."""
        
        # Add context if available for generation
        if context_before or context_after:
            context_section = "\n\nHere's the context where the text should be inserted:"
            if context_before:
                context_section += f"\n\nBEFORE: ...{context_before}"
            context_section += f"\n\n[INSERT NEW TEXT HERE]"
            if context_after:
                context_section += f"\n\nAFTER: {context_after}..."
            context_section += "\n\nGenerated text:"
        else:
            context_section = "\n\nGenerated text:"
            
    else:
        # Editing mode - text is selected
        if system_prompt:
            # If we have a system prompt, just add the user request
            base_instruction = f"The user has selected some text and wants you to: {user_prompt}"
        else:
            # Default instruction if no system prompt
            base_instruction = f"""You are a helpful writing assistant. The user has selected some text and wants you to: {user_prompt}

Please respond with ONLY the modified text, without any explanation or additional commentary."""
        
        # Add context if available
        if context_before or context_after:
            context_section = "\n\nHere's the context around the selected text:"
            if context_before:
                context_section += f"\n\nBEFORE: ...{context_before}"
            context_section += f"\n\nSELECTED TEXT: {text}"
            if context_after:
                context_section += f"\n\nAFTER: {context_after}..."
        else:
            context_section = f"\n\nSelected text to modify:\n{text}"
        
        context_section += "\n\nModified text:"
    
    full_prompt = system_section + base_instruction + context_section
    
    return full_prompt

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Test that llm is working
        model_name = app.config.get('MODEL_NAME', 'gpt-3.5-turbo')
        model = llm.get_model(model_name)
        return jsonify({
            'status': 'healthy',
            'model': model_name,
            'available': True
        })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500

@app.route('/api/models', methods=['GET'])
def list_models():
    """List available LLM models"""
    try:
        models = []
        for model in llm.get_models():
            models.append({
                'id': model.model_id,
                'name': getattr(model, 'name', model.model_id)
            })
        
        return jsonify({'models': models})
    except Exception as e:
        logger.error(f"Error listing models: {str(e)}")
        return jsonify({
            'error': 'Failed to list models',
            'message': str(e)
        }), 500

def sanitize_document_name(name: str) -> str:
    """Sanitize document name for use as folder/file name"""
    if not name or not name.strip():
        return None
    
    # Remove/replace problematic characters
    import re
    sanitized = re.sub(r'[<>:"/\\|?*]', '-', name.strip())
    sanitized = re.sub(r'\s+', '-', sanitized)  # Replace spaces with hyphens
    sanitized = sanitized.strip('-')  # Remove leading/trailing hyphens
    sanitized = sanitized.lower()  # Convert to lowercase for nice URLs
    
    return sanitized if sanitized else None

def get_document_folder(document_name: str) -> Path:
    """Get the folder path for a document"""
    write_folder = app.config.get('WRITE_FOLDER')
    if not write_folder:
        raise ValueError("Write folder not configured")
    
    sanitized_name = sanitize_document_name(document_name)
    if not sanitized_name:
        raise ValueError("Invalid document name")
    
    return write_folder / sanitized_name

def create_frontmatter_content(title: str, content: str) -> str:
    """Create markdown content with frontmatter"""
    today = datetime.now().date().isoformat()
    frontmatter = f"""---
title: "{title}"
date: {today}
---

{content}"""
    return frontmatter

@app.route('/api/validate-name', methods=['POST'])
def validate_document_name():
    """Validate document name"""
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        
        if not name:
            return jsonify({
                'valid': False,
                'warning': 'Document name cannot be empty'
            })
        
        sanitized = sanitize_document_name(name)
        if not sanitized:
            return jsonify({
                'valid': False,
                'warning': 'Document name contains only invalid characters'
            })
        
        return jsonify({
            'valid': True,
            'sanitized': sanitized
        })
        
    except Exception as e:
        logger.error(f"Error validating document name: {e}")
        return jsonify({'error': 'Validation failed'}), 500

@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    """Upload image and return markdown syntax"""
    try:
        logger.info(f"Upload request received - Content-Type: {request.content_type}")
        logger.info(f"Form data: {list(request.form.keys())}")
        logger.info(f"Files: {list(request.files.keys())}")
        
        # Check if document name is provided
        document_name = request.form.get('documentName', '').strip()
        logger.info(f"Document name: '{document_name}'")
        if not document_name:
            return jsonify({'error': 'Document name is required'}), 400
        
        # Validate document name
        sanitized_name = sanitize_document_name(document_name)
        logger.info(f"Sanitized name: '{sanitized_name}'")
        if not sanitized_name:
            return jsonify({'error': 'Invalid document name'}), 400
        
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        logger.info(f"File received: {file.filename}, Content-Type: {file.content_type}")
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Validate file type
        allowed_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}
        file_ext = Path(file.filename).suffix.lower()
        logger.info(f"File extension: '{file_ext}'")
        if file_ext not in allowed_extensions:
            return jsonify({'error': f'Unsupported file type: {file_ext}'}), 400
        
        # Get document folder and create if needed
        doc_folder = get_document_folder(document_name)
        logger.info(f"Document folder: {doc_folder}")
        doc_folder.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename with UUID
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = doc_folder / unique_filename
        logger.info(f"Saving to: {file_path}")
        
        # Save the file
        file.save(str(file_path))
        logger.info(f"Successfully saved image: {file_path}")
        
        try:
            # Create figure with caption placeholder using relative path for downstream blog
            # Images are in the same folder as the markdown file
            figure_markdown = f"""<figure>
    <img src="{unique_filename}" alt="Uploaded image" />
    <figcaption>ADD_CAPTION_HERE</figcaption>
</figure>"""
            logger.info(f"Generated figure markdown: {figure_markdown}")
            
            response_data = {
                'success': True,
                'filename': unique_filename,
                'markdown': figure_markdown,
                'path': str(file_path),
                'document_name': sanitized_name
            }
            logger.info(f"Returning response: {response_data}")
            return jsonify(response_data)
        except Exception as e:
            logger.error(f"Error creating response: {e}")
            raise
        
    except Exception as e:
        logger.error(f"Error uploading image: {e}")
        logger.error(f"Exception type: {type(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({'error': f'Image upload failed: {str(e)}'}), 500

@app.route('/api/save-document', methods=['POST'])
def save_document():
    """Save document with frontmatter"""
    try:
        data = request.get_json()
        document_name = data.get('documentName', '').strip()
        content = data.get('content', '')
        
        if not document_name:
            return jsonify({'error': 'Document name is required'}), 400
        
        # Validate and get document folder
        doc_folder = get_document_folder(document_name)
        doc_folder.mkdir(parents=True, exist_ok=True)
        
        # Create markdown file with frontmatter - always save as index.md
        markdown_content = create_frontmatter_content(document_name, content)
        file_path = doc_folder / "index.md"
        
        file_path.write_text(markdown_content, encoding='utf-8')
        
        logger.info(f"Saved document: {file_path}")
        
        return jsonify({
            'success': True,
            'path': str(file_path),
            'folder': str(doc_folder)
        })
        
    except Exception as e:
        logger.error(f"Error saving document: {e}")
        return jsonify({'error': 'Save failed'}), 500

def load_system_prompt(file_path: Path) -> str:
    """Load system prompt from markdown file"""
    try:
        return file_path.read_text(encoding='utf-8').strip()
    except Exception as e:
        logger.error(f"Error loading system prompt from {file_path}: {e}")
        return ""

#############################################################################################
##################################### CLI (TYPER) ###########################################
#############################################################################################
cli = typer.Typer()
@cli.command()
def serve(
    write_folder: str = typer.Option(
        ..., 
        "--write-folder", 
        "-w",
        help="Path to folder where documents and images will be saved"
    ),
    system_prompt: str = typer.Option(
        None, 
        "--system-prompt", 
        "-s",
        help="Path to markdown file containing system prompt"
    ),
    model: str = typer.Option(
        "gpt-3.5-turbo",
        "--model",
        "-m",
        help="LLM model to use (e.g., gpt-3.5-turbo, gpt-4, claude-3-opus)"
    ),
    host: str = typer.Option("127.0.0.1", "--host", help="Host to bind to"),
    port: int = typer.Option(5000, "--port", help="Port to bind to"),
    debug: bool = typer.Option(False, "--debug", help="Enable debug mode")
):
    """Start the AI Writing Assistant Flask Server"""
    # Validate and set write folder
    write_path = Path(write_folder)
    if not write_path.exists():
        try:
            write_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created write folder: {write_path}")
        except Exception as e:
            typer.echo(f"Error: Cannot create write folder {write_path}: {e}", err=True)
            raise typer.Exit(1)
    elif not write_path.is_dir():
        typer.echo(f"Error: Write folder path exists but is not a directory: {write_path}", err=True)
        raise typer.Exit(1)
    
    app.config['WRITE_FOLDER'] = write_path.resolve()
    logger.info(f"Using write folder: {app.config['WRITE_FOLDER']}")
    
    # Store model name
    app.config['MODEL_NAME'] = model
    logger.info(f"Using model: {app.config['MODEL_NAME']}")
    
    # Load system prompt if provided
    if system_prompt:
        prompt_path = Path(system_prompt)
        if prompt_path.exists():
            app.config['SYSTEM_PROMPT'] = load_system_prompt(prompt_path)
            logger.info(f"Loaded system prompt from {prompt_path} ({len(app.config['SYSTEM_PROMPT'])} characters)")
        else:
            typer.echo(f"Error: System prompt file not found: {prompt_path}", err=True)
            raise typer.Exit(1)
    else:
        app.config['SYSTEM_PROMPT'] = ''
    
    print("Starting AI Writing Assistant Flask Server...")
    print("Available endpoints:")
    print("  POST /api/process - Process text with AI")
    print("  GET  /api/health  - Health check")
    print("  GET  /api/models  - List available models")
    print("  POST /api/upload-image - Upload images")
    print("  POST /api/save-document - Save document with frontmatter")
    print("  GET  /api/validate-name - Validate document name")
    print(f"\nWrite folder: {app.config['WRITE_FOLDER']}")
    print(f"Model: {app.config['MODEL_NAME']}")
    print("\nMake sure to set up your API keys:")
    print("  export OPENAI_API_KEY=your_key_here")
    print("  or configure other models with: llm install llm-claude-3")
    
    if app.config.get('SYSTEM_PROMPT'):
        system_prompt_preview = app.config['SYSTEM_PROMPT']
        print(f"\nUsing system prompt: {system_prompt_preview[:100]}{'...' if len(system_prompt_preview) > 100 else ''}")
    
    app.run(debug=debug, host=host, port=port)

if __name__ == '__main__':
    cli()