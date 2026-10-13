(function () {
  let isInspectorActive = false;
  let inspectorStyle = null;
  let currentHighlight = null;
  let selectedElement = null;
  let editHistory = [];
  let selectedOriginalInlineStyles = {};
  let selectedOriginalInlinePriorities = {};
  let selectedOriginalInnerHTML = '';

  // Function to get relevant styles
  function getRelevantStyles(element) {
    const computedStyles = window.getComputedStyle(element);
    const relevantProps = [
      'display',
      'position',
      'width',
      'height',
      'margin',
      'padding',
      'border',
      'border-radius',
      'background',
      'background-color',
      'color',
      'font-size',
      'font-family',
      'font-weight',
      'text-align',
      'flex-direction',
      'justify-content',
      'align-items',
    ];

    const styles = {};
    relevantProps.forEach((prop) => {
      const value = computedStyles.getPropertyValue(prop);
      if (value) styles[prop] = value;
    });

    return styles;
  }

  // Function to create a readable element selector
  function createReadableSelector(element) {
    let selector = element.tagName.toLowerCase();

    // Add ID if present
    if (element.id) {
      selector += `#${element.id}`;
    }

    // Add classes if present
    let className = '';
    if (element.className) {
      if (typeof element.className === 'string') {
        className = element.className;
      } else if (element.className.baseVal !== undefined) {
        className = element.className.baseVal;
      } else {
        className = element.className.toString();
      }

      if (className.trim()) {
        const classes = className.trim().split(/\s+/).slice(0, 3); // Limit to first 3 classes
        selector += `.${classes.join('.')}`;
      }
    }

    return selector;
  }

  // Function to create element display text
  function createElementDisplayText(element) {
    const tagName = element.tagName.toLowerCase();
    let displayText = `<${tagName}`;

    // Add ID attribute
    if (element.id) {
      displayText += ` id="${element.id}"`;
    }

    // Add class attribute (limit to first 3 classes for readability)
    let className = '';
    if (element.className) {
      if (typeof element.className === 'string') {
        className = element.className;
      } else if (element.className.baseVal !== undefined) {
        className = element.className.baseVal;
      } else {
        className = element.className.toString();
      }

      if (className.trim()) {
        const classes = className.trim().split(/\s+/);
        const displayClasses = classes.length > 3 ? classes.slice(0, 3).join(' ') + '...' : classes.join(' ');
        displayText += ` class="${displayClasses}"`;
      }
    }

    // Add other important attributes
    const importantAttrs = ['type', 'name', 'href', 'src', 'alt', 'title'];
    importantAttrs.forEach((attr) => {
      const value = element.getAttribute(attr);
      if (value) {
        const truncatedValue = value.length > 30 ? value.substring(0, 30) + '...' : value;
        displayText += ` ${attr}="${truncatedValue}"`;
      }
    });

    displayText += '>';

    // Add text content preview for certain elements
    const textElements = ['span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'a', 'label'];
    if (textElements.includes(tagName) && element.textContent) {
      const textPreview = element.textContent.trim().substring(0, 50);
      if (textPreview) {
        displayText += textPreview.length < element.textContent.trim().length ? textPreview + '...' : textPreview;
      }
    }

    displayText += `</${tagName}>`;

    return displayText;
  }

  // Function to create element info
  function createElementInfo(element) {
    const rect = element.getBoundingClientRect();

    return {
      tagName: element.tagName,
      className: getElementClassName(element),
      id: element.id || '',
      textContent: element.textContent?.slice(0, 100) || '',
      styles: getRelevantStyles(element),
      inlineStyles: Object.fromEntries(
        [
          'color',
          'background-color',
          'font-size',
          'font-weight',
          'text-align',
          'padding',
          'margin',
          'border-radius',
          'width',
          'height',
        ].map((property) => [property, element.style.getPropertyValue(property)]),
      ),
      inlineStylePriorities: Object.fromEntries(
        [
          'color',
          'background-color',
          'font-size',
          'font-weight',
          'text-align',
          'padding',
          'margin',
          'border-radius',
          'width',
          'height',
        ].map((property) => [property, element.style.getPropertyPriority(property)]),
      ),
      hasChildElements: element.children.length > 0,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
      },
      // Add new readable formats
      selector: createReadableSelector(element),
      displayText: createElementDisplayText(element),
      elementPath: getElementPath(element),
    };
  }

  // Helper function to get element class name consistently
  function getElementClassName(element) {
    if (!element.className) return '';

    if (typeof element.className === 'string') {
      return element.className;
    } else if (element.className.baseVal !== undefined) {
      return element.className.baseVal;
    } else {
      return element.className.toString();
    }
  }

  // Function to get element path (breadcrumb)
  function getElementPath(element) {
    const path = [];
    let current = element;

    while (current && current !== document.body && current !== document.documentElement) {
      let pathSegment = current.tagName.toLowerCase();

      if (current.id) {
        pathSegment += `#${current.id}`;
      } else if (current.className) {
        const className = getElementClassName(current);
        if (className.trim()) {
          const firstClass = className.trim().split(/\s+/)[0];
          pathSegment += `.${firstClass}`;
        }
      }

      path.unshift(pathSegment);
      current = current.parentElement;

      // Limit path length
      if (path.length >= 5) break;
    }

    return path.join(' > ');
  }

  // Event handlers
  function handleMouseMove(e) {
    if (!isInspectorActive) return;

    const target = e.target;
    if (!target || target === document.body || target === document.documentElement) return;

    // Remove previous highlight
    if (currentHighlight) {
      currentHighlight.classList.remove('inspector-highlight');
    }

    // Add highlight to current element
    target.classList.add('inspector-highlight');
    currentHighlight = target;

    const elementInfo = createElementInfo(target);

    // Send message to parent
    window.parent.postMessage(
      {
        type: 'INSPECTOR_HOVER',
        elementInfo: elementInfo,
      },
      '*',
    );
  }

  function handleClick(e) {
    if (!isInspectorActive) return;

    e.preventDefault();
    e.stopPropagation();

    const target = e.target;
    if (!target || target === document.body || target === document.documentElement) return;

    if (selectedElement && selectedElement !== target && editHistory.length > 0) {
      window.parent.postMessage({ type: 'INSPECTOR_PENDING_CHANGES' }, '*');
      return;
    }

    if (selectedElement === target) return;

    const elementInfo = createElementInfo(target);
    selectedElement = target;
    editHistory = [];
    selectedOriginalInlineStyles = elementInfo.inlineStyles || {};
    selectedOriginalInlinePriorities = elementInfo.inlineStylePriorities || {};
    selectedOriginalInnerHTML = target.innerHTML;

    // Send message to parent
    window.parent.postMessage(
      {
        type: 'INSPECTOR_CLICK',
        elementInfo: elementInfo,
      },
      '*',
    );
  }

  function restoreEdit(edit) {
    if (!edit.element?.isConnected) return;

    if (edit.type === 'style') {
      if (edit.previousValue) {
        edit.element.style.setProperty(edit.property, edit.previousValue, edit.previousPriority);
      } else {
        edit.element.style.removeProperty(edit.property);
      }
    } else if (edit.type === 'text') {
      edit.element.innerHTML = edit.previousValue;
    }
  }

  function handleEditMessage(message) {
    if (!selectedElement?.isConnected) return;

    if (
      message.type === 'INSPECTOR_EDIT_STYLE' &&
      typeof message.property === 'string' &&
      typeof message.value === 'string'
    ) {
      editHistory.push({
        type: 'style',
        element: selectedElement,
        property: message.property,
        previousValue: selectedElement.style.getPropertyValue(message.property),
        previousPriority: selectedElement.style.getPropertyPriority(message.property),
      });
      if (message.value === message.originalComputedValue) {
        editHistory = editHistory.filter((edit) => edit.type !== 'style' || edit.property !== message.property);
        const originalInlineValue = selectedOriginalInlineStyles[message.property] || '';
        const originalInlinePriority = selectedOriginalInlinePriorities[message.property] || '';

        if (originalInlineValue) {
          selectedElement.style.setProperty(message.property, originalInlineValue, originalInlinePriority);
        } else {
          selectedElement.style.removeProperty(message.property);
        }
      } else {
        selectedElement.style.setProperty(message.property, message.value);
      }
    } else if (message.type === 'INSPECTOR_EDIT_TEXT' && typeof message.value === 'string') {
      editHistory.push({ type: 'text', element: selectedElement, previousValue: selectedElement.innerHTML });
      if (message.value === message.originalText) {
        editHistory = editHistory.filter((edit) => edit.type !== 'text');
        selectedElement.innerHTML = selectedOriginalInnerHTML;
      } else {
        selectedElement.textContent = message.value;
      }
    } else if (message.type === 'INSPECTOR_UNDO') {
      restoreEdit(editHistory.pop());
    } else if (message.type === 'INSPECTOR_RESET') {
      while (editHistory.length) restoreEdit(editHistory.pop());
    } else if (message.type === 'INSPECTOR_DESELECT') {
      while (editHistory.length) restoreEdit(editHistory.pop());
      selectedElement = null;
      selectedOriginalInlineStyles = {};
      selectedOriginalInlinePriorities = {};
      selectedOriginalInnerHTML = '';
    }
  }

  function handleMouseLeave() {
    if (!isInspectorActive) return;

    // Remove highlight
    if (currentHighlight) {
      currentHighlight.classList.remove('inspector-highlight');
      currentHighlight = null;
    }

    // Send message to parent
    window.parent.postMessage(
      {
        type: 'INSPECTOR_LEAVE',
      },
      '*',
    );
  }

  // Function to activate/deactivate inspector
  function setInspectorActive(active) {
    isInspectorActive = active;

    if (active) {
      // Add inspector styles
      if (!inspectorStyle) {
        inspectorStyle = document.createElement('style');
        inspectorStyle.textContent = `
          .inspector-active * {
            cursor: crosshair !important;
          }
          .inspector-highlight {
            outline: 2px solid #3b82f6 !important;
            outline-offset: -2px !important;
            background-color: rgba(59, 130, 246, 0.1) !important;
          }
        `;
        document.head.appendChild(inspectorStyle);
      }

      document.body.classList.add('inspector-active');

      // Add event listeners
      document.addEventListener('mousemove', handleMouseMove, true);
      document.addEventListener('click', handleClick, true);
      document.addEventListener('mouseleave', handleMouseLeave, true);
    } else {
      document.body.classList.remove('inspector-active');

      // Remove highlight
      if (currentHighlight) {
        currentHighlight.classList.remove('inspector-highlight');
        currentHighlight = null;
      }

      // Remove event listeners
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('mouseleave', handleMouseLeave, true);

      // Remove styles
      if (inspectorStyle) {
        inspectorStyle.remove();
        inspectorStyle = null;
      }
    }
  }

  // Listen for messages from parent
  window.addEventListener('message', function (event) {
    if (event.source !== window.parent) return;

    if (event.data.type === 'INSPECTOR_ACTIVATE') {
      setInspectorActive(event.data.active);
    } else if (
      event.data.type === 'INSPECTOR_EDIT_STYLE' ||
      event.data.type === 'INSPECTOR_EDIT_TEXT' ||
      event.data.type === 'INSPECTOR_UNDO' ||
      event.data.type === 'INSPECTOR_RESET' ||
      event.data.type === 'INSPECTOR_DESELECT'
    ) {
      handleEditMessage(event.data);
    }
  });

  // Auto-inject if inspector is already active
  window.parent.postMessage({ type: 'INSPECTOR_READY' }, '*');
})();
