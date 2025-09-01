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
/////////////////////////////// EDITOR DOCUMENT_SAVE //////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////

class ServiceManagerFileSave {
    constructor(mng_ctx_sel, renderBtn_elem, documentName_elem) {

        EditorManagerContentSelection.assertInstance(mng_ctx_sel)

        this.mng_ctx_sel = mng_ctx_sel;
        this.renderBtn_elem = renderBtn_elem;
        this.documentName_elem = documentName_elem;
        this.setup_listeners()
    }

    setup_listeners()
    {
        // Save/render button
        this.renderBtn_elem.addEventListener('click', this.saveDocument);
    }

    saveDocument = async (e) => {
        const docName = this.documentName_elem.value.trim();
        const content = this.mng_ctx_sel.contentGet();

        if (!docName) {
            alert('Please enter a document name before saving');
            return;
        }

        if (!content.trim()) {
            alert('Document is empty - nothing to save');
            return;
        }

        try {
            // Show saving state
            this.renderBtn_elem.textContent = '💾 Saving...';
            this.renderBtn_elem.disabled = true;
            this.renderBtn_elem.style.backgroundColor = '#f59e0b';
            this.renderBtn_elem.style.color = 'white';

            const response = await fetch('/api/save-document', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    documentName: docName,
                    content: content
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Save failed');
            }

            const result = await response.json();
            console.log('Document saved:', result.path);

            // Success feedback
            this.renderBtn_elem.textContent = '✓ Saved!';
            this.renderBtn_elem.style.backgroundColor = '#16a34a';
            this.renderBtn_elem.style.color = 'white';

            setTimeout(() => {
                this.renderBtn_elem.textContent = 'Render';
                this.renderBtn_elem.disabled = false;
                this.renderBtn_elem.style.backgroundColor = '';
                this.renderBtn_elem.style.color = '';
            }, 2000);

        } catch (error) {
            console.error('Save error:', error);
            alert(`Failed to save document: ${error.message}`);

            // Reset button state
            this.renderBtn_elem.textContent = 'Render';
            this.renderBtn_elem.disabled = false;
            this.renderBtn_elem.style.backgroundColor = '';
            this.renderBtn_elem.style.color = '';
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
  constructor(editor, state_change_clbk, on_keypress_SAVE_clbk , on_keypress_COMMAND_PALETTE_clbk) {
    if (!editor) {
      throw new Error("EditorManagerContentSelection requires a valid editor element");
    }

    if (typeof state_change_clbk !== "function") {
      throw new Error("state_change_clbk must be a function");
    }
    if (typeof on_keypress_SAVE_clbk !== "function") {
      throw new Error("on_keypress_SAVE_clbk must be a function");
    }
    if (typeof on_keypress_COMMAND_PALETTE_clbk !== "function") {
      throw new Error("on_keypress_COMMAND_PALETTE_clbk must be a function");
    }

    this.editor_elem = editor;
    this.state_change_clbk = state_change_clbk;
    this.on_keypress_SAVE_clbk = on_keypress_SAVE_clbk;
    this.on_keypress_COMMAND_PALETTE_clbk = on_keypress_COMMAND_PALETTE_clbk;
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
            this.on_keypress_COMMAND_PALETTE_clbk(); // openCommandPalette();
        } else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undo_history.performUndo();
        } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            this.on_keypress_SAVE_clbk(); //saveDocument();
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
///////////////////////////////////// COMMAND PALLETE /////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////

class AIManagerResult {
    constructor(
        mng_ctx_sel,
        aiModal_elem,
        aiModal_commandName_elem , aiModal_attemptNumber_elem,
        aiModal_originalText_elem, aiModal_originalTextSection_elem,
        aiModal_resultText_elem  , aiModal_resultTextSection_elem,
        aiModal_acceptBtn, aiModal_rerunBtn, aiModal_cancelBtn
    ) {
        EditorManagerContentSelection.assertInstance(mng_ctx_sel);

        if (
            !aiModal_elem ||
            !aiModal_commandName_elem  || !aiModal_attemptNumber_elem       ||
            !aiModal_originalText_elem || !aiModal_originalTextSection_elem ||
            !aiModal_resultText_elem   || !aiModal_resultTextSection_elem   ||
            !aiModal_acceptBtn || !aiModal_rerunBtn || !aiModal_cancelBtn
        ) {
            throw new Error('AIManagerResult: Missing required DOM elements');
        }

        this.mng_ctx_sel = mng_ctx_sel;
        this.aiModal_elem = aiModal_elem;

        this.aiModal_commandName_elem = aiModal_commandName_elem;
        this.aiModal_attemptNumber_elem = aiModal_attemptNumber_elem;

        this.aiModal_originalText_elem = aiModal_originalText_elem;
        this.aiModal_originalTextSection_elem = aiModal_originalTextSection_elem;

        this.aiModal_resultText_elem = aiModal_resultText_elem;
        this.aiModal_resultTextSection_elem = aiModal_resultTextSection_elem;

        this.aiModal_acceptBtn = aiModal_acceptBtn;
        this.aiModal_rerunBtn = aiModal_rerunBtn;
        this.aiModal_cancelBtn = aiModal_cancelBtn;

        this.state = {
            isOpen: false,
            command: null,
            attempts: 0,
            history: [],
            selectionStart: 0,
            selectionEnd: 0,
            selectedText: '',
        };

        this.setup_listeners();
    }

    setup_listeners = () => {
        this.aiModal_elem.addEventListener('click', (e) => {
            if (e.target === this.aiModal_elem) {
                this.closeResultModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (!this.state.isOpen) return;
            if (this.aiModal_acceptBtn.disabled) return;

            if (e.key === 'Enter') {
                e.preventDefault();
                this.acceptResult();
            } else if (e.key.toLowerCase() === 'x') {
                e.preventDefault();
                this.rerunCommand();
            } else if (e.key === 'Escape') {
                this.closeResultModal();
            }
        });

        this.aiModal_acceptBtn.addEventListener('click', () => this.acceptResult());
        this.aiModal_rerunBtn.addEventListener('click', () => this.rerunCommand());
        this.aiModal_cancelBtn.addEventListener('click', () => this.closeResultModal());
    };

    closeResultModal = () => {
        this.state.isOpen = false;
        this.aiModal_elem.classList.add('hidden');
    };

    acceptResult = () => {
        const resultText = this.aiModal_resultText_elem.textContent;
        this.mng_ctx_sel.stateSet_insertORedit(resultText, this.state.selectionStart, this.state.selectionEnd);
        this.closeResultModal();
    };

    destroy = () => {
        this.closeResultModal();
    };

    processTextWithAPI = async (text, command) => {
        try {
            const contextBefore = this.mng_ctx_sel.getContextBefore();
            const contextAfter = this.mng_ctx_sel.getContextAfter();

            const response = await fetch('/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    prompt: command.customPrompt,
                    attempt: this.state.attempts || 1,
                    context: { before: contextBefore, after: contextAfter },
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'API request failed');
            }

            const data = await response.json();
            return data.result;
        } catch (error) {
            console.error('API Error:', error);
            return `[API Error: ${error.message}]\n\nFallback response for "${command.customPrompt}"`;
        }
    };

    executeCommand = async (command, selectedText, selectionStart, selectionEnd) => {
        this.state.command = command;
        this.state.attempts = 1;
        this.state.selectedText = selectedText;
        this.state.selectionStart = selectionStart;
        this.state.selectionEnd = selectionEnd;

        this.showLoadingModal(command.customPrompt);
        this.mng_ctx_sel.maintainSelection();

        try {
            const result = await this.processTextWithAPI(selectedText, command);
            this.showResultModal(result);
            this.mng_ctx_sel.maintainSelection();
        } catch (error) {
            console.error('Command execution failed:', error);
            this.showResultModal(`Error: ${error.message}`);
        }
    };

    rerunCommand = async () => {
        if (!this.state.command) return;
        this.state.attempts++;
        this.showLoadingModal(this.state.command.customPrompt);
        this.mng_ctx_sel.maintainSelection();

        try {
            const result = await this.processTextWithAPI(this.state.selectedText, this.state.command);
            this.showResultModal(result);
            this.mng_ctx_sel.maintainSelection();
        } catch (error) {
            console.error('Rerun command failed:', error);
            this.showResultModal(`Error: ${error.message}`);
        }
    };

    showLoadingModal = (prompt) => {
        this.aiModal_commandName_elem.textContent = prompt;
        this.aiModal_attemptNumber_elem.textContent = this.state.attempts;

        if (this.state.selectedText) {
            this.aiModal_originalText_elem.textContent = this.state.selectedText;
            this.aiModal_originalTextSection_elem.style.display = 'block';
        } else {
            this.aiModal_originalTextSection_elem.style.display = 'none';
        }

        this.aiModal_resultTextSection_elem.style.display = 'block';
        this.aiModal_resultText_elem.innerHTML = `
            <div class="flex items-center gap-2 text-gray-500">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
                Processing your request...
            </div>
        `;

        this.aiModal_acceptBtn.disabled = true;
        this.aiModal_rerunBtn.disabled = true;

        this.state.isOpen = true;
        this.aiModal_elem.classList.remove('hidden');
    };

    showResultModal = (result) => {
        this.aiModal_commandName_elem.textContent = this.state.command.customPrompt;
        this.aiModal_attemptNumber_elem.textContent = this.state.attempts;
        this.aiModal_resultText_elem.textContent = result;

        if (this.state.selectedText) {
            this.aiModal_originalText_elem.textContent = this.state.selectedText;
            this.aiModal_originalTextSection_elem.style.display = 'block';
        } else {
            this.originalTextSection_elem.style.display = 'none';
        }

        this.aiModal_acceptBtn.disabled = false;
        this.aiModal_rerunBtn.disabled = false;

        this.state.isOpen = true;
        this.aiModal_elem.classList.remove('hidden');
    };

}

///////////////////////////////////////////////////////////////////////////////////////

class CommandPaletteManager {
    constructor(
        mng_ctx_sel,
        mng_ai_result,
        commandPalette_elem,
        promptInput_elem,
        selectionPreview_elem,
        selectionPreviewContainer_elem,
    ) {
        EditorManagerContentSelection.assertInstance(mng_ctx_sel);

        if (!commandPalette_elem || !promptInput_elem || !selectionPreview_elem || !selectionPreviewContainer_elem) {
            throw new Error('CommandPaletteManager: Missing required DOM elements');
        }

        this.mng_ctx_sel = mng_ctx_sel;
        this.commandPalette_elem = commandPalette_elem;
        this.promptInput_elem = promptInput_elem;
        this.selectionPreview_elem = selectionPreview_elem;
        this.selectionPreviewContainer_elem = selectionPreviewContainer_elem;
        this.mng_ai_result = mng_ai_result;

        this.state = {
            selectedText: '',
            selectionStart: 0,
            selectionEnd: 0,
            commandPalette: { isOpen: false },
        };

        this.setup_listeners();
    }

    setup_listeners = () => {
        this.promptInput_elem.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.submitPrompt();
            } else if (e.key === 'Escape') {
                this.closeCommandPalette();
            }
        });

        document.addEventListener('click', (e) => {
            if (this.state.commandPalette.isOpen && !this.commandPalette_elem.contains(e.target)) {
                this.closeCommandPalette();
            }
        });
    };

    openCommandPalette = () => {
        const [start, end, text] = this.mng_ctx_sel.selectionDatatGet();
        this.state.selectionStart = start;
        this.state.selectionEnd = end;

        if (text) {
            this.state.selectedText = text;
            this.selectionPreview_elem.textContent = text;
            this.selectionPreviewContainer_elem.classList.remove('hidden');
            this.promptInput_elem.placeholder = "What would you like to do with this text?";
        } else {
            this.state.selectedText = '';
            this.selectionPreviewContainer_elem.classList.add('hidden');
            this.promptInput_elem.placeholder = "What would you like to write?";
        }

        this.state.commandPalette.isOpen = true;
        this.promptInput_elem.value = '';
        this.commandPalette_elem.classList.remove('hidden');
        setTimeout(() => this.promptInput_elem.focus(), 10);
    };

    closeCommandPalette = () => {
        this.state.commandPalette.isOpen = false;
        this.commandPalette_elem.classList.add('hidden');
    };

    submitPrompt = () => {
        const prompt = this.promptInput_elem.value.trim();
        if (prompt) {
            const command = { id: 'custom', name: 'Custom Prompt', customPrompt: prompt };
            this.closeCommandPalette();
            this.mng_ctx_sel.maintainSelection();
            this.mng_ai_result.executeCommand(
                command,
                this.state.selectedText,
                this.state.selectionStart,
                this.state.selectionEnd
            );
        }
    };

    open = () => this.openCommandPalette();
    close = () => this.closeCommandPalette();
    isOpen = () => this.state.commandPalette.isOpen;
    getSelectedText = () => this.state.selectedText || '';
    destroy = () => { this.closeCommandPalette();};
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

class ServiceManagerFileUploader {
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

    // EDITOR MANAGERs 
    const editor            = document.getElementById('editor');

    let mng_ctx_sel         = new EditorManagerContentSelection(editor, 
                                                           /*state_change_clbk                */ function () { window.app.mng_preview.updatePreview()  }, 
                                                           /*on_keypress_SAVE_clbk            */ function () { window.app.srv_file_save.saveDocument() }, 
                                                           /*on_keypress_COMMAND_PALETTE_clbk */ function () { window.app.mng_cmd_pallete.openCommandPalette() });
  
    this.mng_ctx_sel        = mng_ctx_sel
    this.mng_paste          = new EditorManagerPaste(mng_ctx_sel);
    this.mng_drag_drop      = new EditorManagerDragAndDrop(mng_ctx_sel, (file) => { window.app.srv_file_uploader.uploadImage(file); /* arrow to capture local var*/ } );

    // EDITOR SERVICESs
    const documentName      = document.getElementById('documentName');
    const renderBtn         = document.getElementById('renderBtn')

    this.srv_file_uploader  = new ServiceManagerFileUploader(mng_ctx_sel, documentName);
    this.srv_file_save      = new ServiceManagerFileSave(mng_ctx_sel, renderBtn, documentName);
    
    // PREVIEW
    const preview           = document.getElementById('preview');
    this.mng_preview        = new PreviewManager(mng_ctx_sel, preview, documentName);

    // AI PROMPT
    const aiModal                      = document.getElementById('resultModal');
    const aiModal_commandName          = document.getElementById('commandName');
    const aiModal_attemptNumber        = document.getElementById('attemptNumber');
    const aiModal_originalText         = document.getElementById('originalText'); 
    const aiModal_originalTextSection  = document.querySelector('#resultModal .mb-4')
    const aiModal_resultText           = document.getElementById('resultText'); 
    const aiModal_resultTextSection    = document.querySelector('#resultModal .mb-6')
    const aiModal_acceptBtn            = document.getElementById('acceptBtn')
    const aiModal_rerunBtn             = document.getElementById('rerunBtn')
    const aiModal_cancelBtn            = document.getElementById('cancelBtn')

    let mng_ai_modal_result = new AIManagerResult(
        mng_ctx_sel,
        aiModal,
        aiModal_commandName, aiModal_attemptNumber,
        aiModal_originalText, aiModal_originalTextSection,
        aiModal_resultText, aiModal_resultTextSection,
        aiModal_acceptBtn, aiModal_rerunBtn, aiModal_cancelBtn
    )
    this.mng_ai_modal_result = mng_ai_modal_result;

    const commandPalette                           = document.getElementById('commandPalette');
    const commandPalette_selectionPreviewContainer = document.getElementById('selectionPreview');
    const commandPalette_selectionPreview          = document.querySelector('#selectionPreview > div');
    const commandPalette_promptInput               = document.getElementById('promptInput');

    this.mng_cmd_pallete = new CommandPaletteManager(
        mng_ctx_sel,
        mng_ai_modal_result,
        commandPalette,
        commandPalette_promptInput,
        commandPalette_selectionPreview,
        commandPalette_selectionPreviewContainer,
    )
  }

}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  window.app = new EditorApp();
  window.app.mng_preview.updatePreview();
});
