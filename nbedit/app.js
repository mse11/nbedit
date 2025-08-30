class StateUndoHistory {
  constructor(content, selectionStart, selectionEnd, timestamp = Date.now()) {
    this.content        = content;
    this.selectionStart = selectionStart;
    this.selectionEnd   = selectionEnd;
    this.timestamp      = timestamp;
  }

  // Static method to enforce type
  static assertInstance(state_undo_history) {
    if (!(state_undo_history instanceof StateUndoHistory)) {
      throw new Error("Argument must be an instance of StateUndoHistory");
    }
  }
}

///////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////// EDITOR UNDO_HISTORY ///////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////

class EditorManagerUndoHistory {
  constructor(mng_ctx_sel, maxUndoStates = 50, debouncedDelay = 100) {

    EditorManagerContentSelection.assertInstance(mng_ctx_sel)

    this.mng_ctx_sel = mng_ctx_sel

    this.maxUndoStates = maxUndoStates;

    this.undoHistory = [];
    this.undoDebounceTimer = null;
    this.undoDebounceTimerDelay = debouncedDelay
  }

  saveUndoState() {
    // get editor content and selection
    const state = this.mng_ctx_sel.stateGet();

    const lastState = this.undoHistory[this.undoHistory.length - 1];
    if (lastState && JSON.stringify(lastState.data) === JSON.stringify(state.data)) {
      return;
    }

    this.undoHistory.push(state);

    if (this.undoHistory.length > this.maxUndoStates) {
      this.undoHistory.shift();
    }

    console.log(`Undo state saved. History size: ${this.undoHistory.length}`);
  }

  debouncedSaveUndoState() {
    if (this.undoDebounceTimer) {
      clearTimeout(this.undoDebounceTimer);
    }

    this.undoDebounceTimer = setTimeout(() => {
      this.saveUndoState();
    }, this.undoDebounceTimerDelay);
  }

  performUndo() {
    if (this.undoHistory.length === 0) {
      console.log("No undo history available");
      return;
    }

    const lastState = this.undoHistory.pop();
    console.log(`Undid to previous state. History size: ${this.undoHistory.length}`);

    // Restore editor content and selection
    this.mng_ctx_sel.stateSet(lastState)
  }
}














///////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////// EDITOR COMNTENT/SELECTION /////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////

class EditorManagerContentSelection {
  constructor(editor, state_change_clbk) {
    if (!editor) {
      throw new Error("EditorManagerContentSelection requires a valid editor element");
    }

    if (typeof state_change_clbk !== "function") {
      throw new Error("state_change_clbk must be a function");
    }

    this.editor_elem = editor;
    this.state_change_clbk = state_change_clbk;
    this.undo_history = new EditorManagerUndoHistory(this)
    this.setup_listeners()
  }

  // Static method to enforce type
  static assertInstance(obj) {
    if (!(obj instanceof EditorManagerContentSelection)) {
      throw new Error("Argument must be an instance of EditorManagerContentSelection");
    }
  }

  setup_listeners() {

    // Update preview on input and debounce undo state saving
    this.editor_elem.addEventListener('input', (e) => {
        this.state_change_clbk();
        // Debounce undo state saving to avoid excessive memory usage
        if (e.inputType && e.inputType !== 'insertCompositionText') {
            this.undo_history.debouncedSaveUndoState();
        }
    });

    // keypress
    this.editor_elem.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            openCommandPalette(); // MSE_TODO
        } else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undo_history.performUndo();
        } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            saveDocument(); // MSE_TODO
        }
    });

  }

  editor() {
    return this.editor_elem;
  }

  // Capture current state of editor
  stateGet() {
    return new StateUndoHistory(
      this.editor_elem.value,
      this.editor_elem.selectionStart,
      this.editor_elem.selectionEnd
    );
  }

  // Restore editor to a previous state
  stateSet(state) {
    StateUndoHistory.assertInstance(state);

    this.editor_elem.value = state.content;
    this.editor_elem.setSelectionRange(state.selectionStart, state.selectionEnd);
    this.editor_elem.focus();

    this.state_change_clbk();
  }

  stateSet_insertORedit(selectedText, selectionStart, selectionEnd)
  {
        // Save undo state before AI edit
        this.undo_history.saveUndoState();

        if (selectedText) {
            // Editing mode - replace selected text
            const before = this.editor_elem.value.substring(0, selectionStart);
            const after = this.editor_elem.value.substring(selectionEnd);
         
            this.editor_elem.value = before + resultText + after;
         
            // Set cursor position at end of new text
            const newEnd = selectionStart + resultText.length;
            this.editor_elem.setSelectionRange(newEnd, newEnd);
        } else {
            // Generation mode - insert text at cursor position
            const before = this.editor_elem.value.substring(0, selectionStart);
            const after = this.editor_elem.value.substring(selectionStart);
         
            this.editor_elem.value = before + resultText + after;
         
            // Set cursor position at end of new text
            const newEnd = this.state.selectionStart + resultText.length;
            this.editor_elem.setSelectionRange(newEnd, newEnd);
        }
     
        this.editor_elem.focus();

        this.state_change_clbk();
  }

  stateSet_pasteReplace(selectedText, pastedText, selectionStart, selectionEnd)
  {
    console.log(selectedText, pastedText, selectionStart, selectionEnd)
    // Save undo state before link creation
    this.undo_history.saveUndoState();
   
    // Create markdown link
    const markdownLink = `[${selectedText}](${pastedText.trim()})`;
   
    // Replace selection with markdown link
    const textBefore = this.editor_elem.value.substring(0, selectionStart);
    const textAfter = this.editor_elem.value.substring(selectionEnd);
   
    this.editor_elem.value = textBefore + markdownLink + textAfter;
   
    // Set cursor position after the link
    const newCursorPos = selectionStart + markdownLink.length;
    this.editor_elem.setSelectionRange(newCursorPos, newCursorPos);

    console.log('Created markdown link:', markdownLink);
    
    this.state_change_clbk();
  }

  stateSet_dragANDdrop_Replace(markdown)
  {
    console.log('Markdown to insert:', markdown);
    console.log('Type of markdown:', typeof markdown);
    console.log('First 100 chars:', markdown.substring(0, 100));
       
    // Save undo state before modifying editor content
    this.undo_history.saveUndoState();
       
    // Insert figure markdown at cursor position
    const cursorPos = this.editor_elem.selectionStart;
    const textBefore = this.editor_elem.value.substring(0, cursorPos);
    const textAfter = this.editor_elem.value.substring(cursorPos);
       
    const newText = textBefore + markdown + '\n\n' + textAfter;
    this.editor_elem.value = newText;
       
    console.log('Editor content after insert:', this.editor_elem.value);
       
    // Update preview immediately to see the figure
    this.state_change_clbk();
       
    // Find and select the caption placeholder for easy editing
    const captionPlaceholder = 'ADD_CAPTION_HERE';
    const captionStart = newText.indexOf(captionPlaceholder, cursorPos);
       
    if (captionStart !== -1) {
        // Focus editor and select the placeholder text so user can type caption immediately
        editor.focus();
        editor.setSelectionRange(captionStart, captionStart + captionPlaceholder.length);
        console.log(`Selected "${captionPlaceholder}" at position ${captionStart}-${captionStart + captionPlaceholder.length}`);
    } else {
        // Fallback: position cursor after the figure
        const newCursorPos = cursorPos + markdown.length + 2;
        editor.focus();
        editor.setSelectionRange(newCursorPos, newCursorPos);
        console.log(`Caption placeholder not found, positioned cursor at ${newCursorPos}`);
    }
  }

  contentGet() {
    return this.editor_elem.value
  }

  selectionDatatGet() {
    const start = this.editor_elem.selectionStart;
    const end = this.editor_elem.selectionEnd;
    const sel_text = this.editor_elem.value.substring(start, end).trim();
    return [start, end, sel_text]
  }

  maintainSelection(selectionStart, selectionEnd) {
    // Keep the editor focused and selection visible
    this.editor_elem.focus();
    this.editor_elem.setSelectionRange(selectionStart, selectionEnd);
  }

  getContextBefore(selectionStart) {
    // Get ~100 characters before the selection/cursor
    const start = Math.max(0, selectionStart - 100);
    return this.editor_elem.value.substring(start, selectionStart);
  }

  getContextAfter(selectionEnd) {
     // Get ~100 characters after the selection/cursor
     const end = Math.min(this.editor_elem.value.length, selectionEnd + 100);
     return this.editor_elem.value.substring(selectionEnd, end);
  }
}

///////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////// PREVIEW .MD /////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////

class PreviewManager {
    constructor(mng_ctx_sel, preview_elem, documentName_elem) {

        EditorManagerContentSelection.assertInstance(mng_ctx_sel)

        this.mng_ctx_sel = mng_ctx_sel;      // EditorManagerContentSelection
        this.preview_elem = preview_elem;         // Preview element
        this.documentName_elem = documentName_elem; // Document name element
    }

    updatePreview() {
        const markdownText = this.mng_ctx_sel.contentGet();

        console.log(`updatePreview triggered - ${markdownText}`)

        if (markdownText.trim() === '') {
            this.preview_elem.innerHTML = '<p class="text-gray-400 italic">Start typing to see your markdown preview_elem...</p>';
            return;
        }

        try {
            // Configure marked to allow HTML
            marked.setOptions({
                breaks: true,
                gfm: true,
                sanitize: false,  // Allow raw HTML
                silent: false
            });

            // Parse markdown and render HTML
            let html = marked.parse(markdownText);

            // Convert relative image paths to Flask-served paths for preview_elem
            const docName = this.documentName_elem.value.trim();
            if (docName) {
                html = html.replace(
                    /src="([^"\/]+\.(png|jpg|jpeg|gif|webp))"/g,
                    `src="/images/${encodeURIComponent(docName)}/$1"`
                );
            }

            this.preview_elem.innerHTML = html;
        } catch (error) {
            console.error('Error parsing markdown:', error);
            this.preview_elem.innerHTML = '<p class="text-red-500">Error rendering markdown preview</p>';
        }
    }
}

///////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////// EDITOR FILEUPLOAD //////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////

class EditorManagerFileUploader {
    constructor(mng_ctx_sel, documentName_elem) {

        EditorManagerContentSelection.assertInstance(mng_ctx_sel)

        this.mng_ctx_sel = mng_ctx_sel;
        this.documentName_elem = documentName_elem;
    }

    async uploadImage(file) {
        const docName = this.documentName_elem.value.trim();
        if (!docName) {
            alert('Please enter a document name before uploading images');
            return;
        }
   
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('documentName', docName);
       
            const response = await fetch('/api/upload-image', {
                method: 'POST',
                body: formData
            });
       
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Upload failed');
            }
       
            const result = await response.json();
            console.log('Upload result:', result);
            this.mng_ctx_sel.stateSet_dragANDdrop_Replace(result.markdown)

            console.log('Image uploaded:', result.filename);
       
        } catch (error) {
            console.error('Upload error:', error);
            alert(`Failed to upload image: ${error.message}`);
        }
    }
}

///////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////// EDITOR DRAG&DROP //////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////

class EditorManagerDragAndDrop {

  constructor(mng_ctx_sel,
              handleDropPerFileFilter_clbk,
              highlightClasses = ['border-blue-400', 'bg-blue-50'],
              fileFilter = 'image/')
  {

    EditorManagerContentSelection.assertInstance(mng_ctx_sel)

    this.handleDropPerFileFilter_clbk = handleDropPerFileFilter_clbk;
    this.mng_ctx_sel = mng_ctx_sel;
    this.highlightClasses = highlightClasses;
    this.fileFilter = fileFilter;

    this.dragCounter = 0;

    this.setup_listeners();
  }

  setup_listeners() {
    const preventDefaults = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const highlight = () => {
      this.dragCounter++;
      this.mng_ctx_sel.editor().classList.add(...this.highlightClasses);
    };

    const unhighlight = () => {
      this.dragCounter--;
      if (this.dragCounter === 0) {
        this.mng_ctx_sel.editor().classList.remove(...this.highlightClasses);
      }
    };

    const handleDropPerFileFilter = async (e) => {
      this.dragCounter = 0;
      this.mng_ctx_sel.editor().classList.remove(...this.highlightClasses);

      const files = Array.from(e.dataTransfer.files);

      for (const file of files) {
        if (!this.fileFilter || file.type.startsWith(this.fileFilter)) {
          await this.handleDropPerFileFilter_clbk(file);
        }
      }
    };

    // Register listeners
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      this.mng_ctx_sel.editor().addEventListener(eventName, preventDefaults, false);
      document.body.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      this.mng_ctx_sel.editor().addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      this.mng_ctx_sel.editor().addEventListener(eventName, unhighlight, false);
    });

    this.mng_ctx_sel.editor().addEventListener('drop', handleDropPerFileFilter, false);
  }
}

///////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////// EDITOR PASTE //////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////

class EditorManagerPaste
{
    constructor(mng_ctx_sel) {

        EditorManagerContentSelection.assertInstance(mng_ctx_sel)

        this.mng_ctx_sel = mng_ctx_sel;
        this.setup_listeners()
    }

    setup_listeners() {
        // Paste link functionality
        this.mng_ctx_sel.editor().addEventListener('paste', this.handlePaste);
    }

    handlePaste = (e) => { // use arraow to correct call
        // Get clipboard data
        const clipboardData = e.clipboardData || window.clipboardData;
        const pastedText = clipboardData.getData('text');

        // Check if it looks like a URL
        const urlRegex = /^https?:\/\/[^\s]+$/;
        if (!urlRegex.test(pastedText.trim())) {
            return; // Let default paste behavior happen
        }

        // Check if text is selected
        const [start, end, selectedText] = this.mng_ctx_sel.selectionDatatGet()

        if (start === end) {
            return; // No selection, let default paste happen
        }

        // Prevent default paste
        e.preventDefault();

        this.mng_ctx_sel.stateSet_pasteReplace(selectedText,pastedText, start, end)
    }
}

///////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////// EDITOR APP ////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////

class EditorApp {
  constructor()
  {

    // DOM elements
    const editor = document.getElementById('editor');
    const preview = document.getElementById('preview');
    const documentName = document.getElementById('documentName');
    const commandPalette = document.getElementById('commandPalette');
    const resultModal = document.getElementById('resultModal');
    const selectionPreview = document.querySelector('#selectionPreview > div');
    const promptInput = document.getElementById('promptInput');

    function state_change_clbk() {
      window.app.mng_preview.updatePreview();
    }

    let mng_ctx_sel = new EditorManagerContentSelection(editor, state_change_clbk);

    this.mng_ctx_sel = mng_ctx_sel
    this.mng_preview = new PreviewManager(mng_ctx_sel, preview, documentName);
    this.mng_paste = new EditorManagerPaste(mng_ctx_sel);

    let file_uploader = new EditorManagerFileUploader(mng_ctx_sel, documentName);
    this.mng_drag_drop = new EditorManagerDragAndDrop(mng_ctx_sel, (file) => { file_uploader.uploadImage(file); } );

  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  window.app = new EditorApp();
  window.app.mng_preview.updatePreview();
});
