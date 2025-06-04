/*
Desc: This displays basic user/browser/session information
SPDX-FileCopyrightText: © 2025 Justin Burdine <justin@cyburdine.com>
SPDX-License-Identifier: BSD-3-Clause
*/

document.addEventListener("DOMContentLoaded", () => {
  // Customize the content displayed in the widget
  const info = {
    "Browser": navigator.userAgent,
    "Language / Platform / Resolution": `${navigator.language} // ${navigator.platform} // ${screen.width}x${screen.height}`,
    "Time / Timezone / Network": `${new Date().toLocaleString()} // ${Intl.DateTimeFormat().resolvedOptions().timeZone} // ${navigator.connection ? navigator.connection.effectiveType : "Unknown"}`
  };

  // Create the widget container
  const widget = document.createElement('div');
  widget.classList.add('user-widget');
  widget.innerHTML = `
    <div class="widget-header">
      <span>Connection Info</span>
      <button class="close-btn">×</button>
    </div>
    <div class="widget-content"></div>
  `;

  // Populate the widget with key/value pairs
  const content = widget.querySelector('.widget-content');
  for (let key in info) {
    const line = document.createElement('div');

    const label = document.createElement('span');
    label.classList.add('key-label');
    label.textContent = `:: ${key.toUpperCase()} :: `;

    const value = document.createElement('span');
    value.classList.add('key-value');
    value.textContent = info[key];

    line.appendChild(label);
    line.appendChild(value);
    content.appendChild(line);
  }

  // Add widget to the terminal screen
  const screenDiv = document.querySelector('.terminal-screen');
  if (screenDiv) {
    screenDiv.style.position = 'relative';
    screenDiv.appendChild(widget);

    // Clear any conflicting layout properties
    widget.style.bottom = '';
    widget.style.right = '';
    widget.style.top = 'auto';
    widget.style.left = 'auto';

    // === CUSTOMIZABLE START POSITION ===
    const distanceFromBottom = 50; // px from bottom of terminal screen
    const distanceFromRight = 450;  // px from right edge of terminal screen
    const widgetWidth = 480;       // Must match your .user-widget width in CSS

    // Calculate initial top/left to position bottom-right
    const containerRect = screenDiv.getBoundingClientRect();
    const widgetHeight = widget.offsetHeight;

    widget.style.top = `${containerRect.height - widgetHeight - distanceFromBottom}px`;
    widget.style.left = `${containerRect.width - widgetWidth - distanceFromRight}px`;
  }

  // === CLOSE BUTTON ===
  widget.querySelector('.close-btn').addEventListener('click', () => {
    widget.remove();
  });

  // === DRAGGABLE HEADER ===
  const header = widget.querySelector('.widget-header');
  let isDragging = false, offsetX = 0, offsetY = 0;

  header.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('close-btn')) return; // Skip if clicking close
    isDragging = true;
    offsetX = e.clientX - widget.offsetLeft;
    offsetY = e.clientY - widget.offsetTop;
    widget.style.cursor = 'move';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      // Update widget position as you move it
      widget.style.top = `${e.clientY - offsetY}px`;
      widget.style.left = `${e.clientX - offsetX}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    widget.style.cursor = 'default';
  });
});