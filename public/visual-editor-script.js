(function () {
  'use strict';

  let isActive = false;
  let elementIdCounter = 0;
  const elementIdMap = new WeakMap();

  function getElementId(element) {
    if (!elementIdMap.has(element)) {
      elementIdMap.set(element, `ve-${elementIdCounter++}`);
    }
    return elementIdMap.get(element);
  }

  function getComputedStylesForElement(element) {
    const computed = window.getComputedStyle(element);
    return {
      position: computed.position,
      display: computed.display,
      backgroundColor: computed.backgroundColor,
      color: computed.color,
      padding: computed.padding,
      margin: computed.margin,
      borderRadius: computed.borderRadius,
      borderTopLeftRadius: computed.borderTopLeftRadius,
      borderTopRightRadius: computed.borderTopRightRadius,
      borderBottomLeftRadius: computed.borderBottomLeftRadius,
      borderBottomRightRadius: computed.borderBottomRightRadius,
      borderWidth: computed.borderWidth,
      borderStyle: computed.borderStyle,
      borderColor: computed.borderColor,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      opacity: computed.opacity,
      boxShadow: computed.boxShadow,
    };
  }

  function generateSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }

    const parts = [];
    let current = element;

    while (current && current !== document.body && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector = `#${current.id}`;
        parts.unshift(selector);
        break;
      } else if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(Boolean);
        if (classes.length > 0) {
          selector += '.' + classes.join('.');
        }
      }

      // Add nth-child for specificity if needed
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (child) => child.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }

      parts.unshift(selector);
      current = current.parentElement;
    }

    return parts.join(' > ');
  }

  function generateXPath(element) {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    const parts = [];
    let current = element;

    while (current && current !== document.body) {
      let part = current.tagName.toLowerCase();
      const parent = current.parentElement;

      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (child) => child.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          part += `[${index}]`;
        }
      }

      parts.unshift(part);
      current = parent;
    }

    return '//' + parts.join('/');
  }

  function getElementAttributes(element) {
    const attrs = {};
    for (const attr of element.attributes) {
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  function getParentChain(element) {
    const chain = [];
    let current = element.parentElement;

    while (current && current !== document.body && chain.length < 5) {
      let descriptor = current.tagName.toLowerCase();
      if (current.id) {
        descriptor += `#${current.id}`;
      } else if (current.className && typeof current.className === 'string') {
        const firstClass = current.className.trim().split(/\s+/)[0];
        if (firstClass) {
          descriptor += `.${firstClass}`;
        }
      }
      chain.push(descriptor);
      current = current.parentElement;
    }

    return chain;
  }

  function getElementInfo(element) {
    const rect = element.getBoundingClientRect();
    return {
      id: getElementId(element),
      tagName: element.tagName,
      className: element.className || '',
      textContent: element.textContent?.slice(0, 50) || '',
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
      },
      styles: {},
      computedStyles: getComputedStylesForElement(element),
      sourceInfo: {
        selector: generateSelector(element),
        xpath: generateXPath(element),
        attributes: getElementAttributes(element),
        parentChain: getParentChain(element),
      },
    };
  }

  function findElementById(id) {
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      if (elementIdMap.get(el) === id) {
        return el;
      }
    }
    return null;
  }

  function handleMouseOver(event) {
    if (!isActive) return;
    event.stopPropagation();

    const element = event.target;
    if (element === document.body || element === document.documentElement) return;

    window.parent.postMessage(
      {
        type: 'VISUAL_EDITOR_HOVER',
        elementInfo: getElementInfo(element),
      },
      '*'
    );
  }

  function handleMouseOut(event) {
    if (!isActive) return;
    event.stopPropagation();

    window.parent.postMessage(
      {
        type: 'VISUAL_EDITOR_HOVER_OUT',
      },
      '*'
    );
  }

  function handleClick(event) {
    if (!isActive) return;
    event.preventDefault();
    event.stopPropagation();

    const element = event.target;
    if (element === document.body || element === document.documentElement) return;

    console.log('[Visual Editor] Click on element:', element.tagName, element.className);
    const info = getElementInfo(element);
    console.log('[Visual Editor] Sending SELECT message:', info);

    window.parent.postMessage(
      {
        type: 'VISUAL_EDITOR_SELECT',
        elementInfo: info,
      },
      '*'
    );
  }

  function handleMessage(event) {
    const { type, active, elementId, styles, text } = event.data;

    switch (type) {
      case 'VISUAL_EDITOR_ACTIVATE':
        isActive = active;
        if (isActive) {
          document.body.style.cursor = 'crosshair';
          // Send READY message when activated to confirm script is loaded
          window.parent.postMessage({ type: 'VISUAL_EDITOR_READY' }, '*');
        } else {
          document.body.style.cursor = '';
        }
        break;

      case 'VISUAL_EDITOR_UPDATE_STYLE':
        if (elementId && styles) {
          const element = findElementById(elementId);
          if (element) {
            Object.assign(element.style, styles);

            // Send back updated element info
            window.parent.postMessage(
              {
                type: 'VISUAL_EDITOR_ELEMENT_UPDATED',
                elementInfo: getElementInfo(element),
              },
              '*'
            );
          }
        }
        break;

      case 'VISUAL_EDITOR_UPDATE_TEXT':
        if (elementId && text !== undefined) {
          const element = findElementById(elementId);
          if (element) {
            element.textContent = text;

            // Send back updated element info
            window.parent.postMessage(
              {
                type: 'VISUAL_EDITOR_ELEMENT_UPDATED',
                elementInfo: getElementInfo(element),
              },
              '*'
            );
          }
        }
        break;

      case 'VISUAL_EDITOR_GET_ELEMENT':
        if (elementId) {
          const element = findElementById(elementId);
          if (element) {
            window.parent.postMessage(
              {
                type: 'VISUAL_EDITOR_ELEMENT_INFO',
                elementInfo: getElementInfo(element),
              },
              '*'
            );
          }
        }
        break;
    }
  }

  // Initialize
  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mouseout', handleMouseOut, true);
  document.addEventListener('click', handleClick, true);
  window.addEventListener('message', handleMessage);

  // Notify parent that visual editor script is ready
  console.log('[Visual Editor] Script loaded and ready');
  window.parent.postMessage({ type: 'VISUAL_EDITOR_READY' }, '*');
})();
