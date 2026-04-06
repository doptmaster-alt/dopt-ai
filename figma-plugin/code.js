// DIOPT AI Designer - Figma Plugin v2
// Auto Layout 기반 프레임 중첩 지원

figma.showUI(__html__, { width: 350, height: 500 });

// ── 프레임 스택 (중첩 Auto Layout 지원) ──
var frameStack = [];
var currentFrame = null;

function pushFrame(frame) {
  if (currentFrame) frameStack.push(currentFrame);
  currentFrame = frame;
}

function popFrame() {
  currentFrame = frameStack.length > 0 ? frameStack.pop() : null;
}

// ── 자식 노드 Auto Layout 속성 설정 ──
function configureChildLayout(node, cmd) {
  if (!currentFrame) return;

  // Auto Layout 프레임에 추가된 자식인 경우
  if (currentFrame.layoutMode && currentFrame.layoutMode !== 'NONE') {
    // fill_width: 부모 너비에 맞춤
    if (cmd.fill_width) {
      node.layoutAlign = 'STRETCH';
      try { node.layoutSizingHorizontal = 'FILL'; } catch(e) {}
    }
    // fixed_width: 고정 너비
    if (cmd.fixed_width) {
      node.layoutAlign = 'INHERIT';
      try { node.layoutSizingHorizontal = 'FIXED'; } catch(e) {}
    }
    // hug_height: 높이 자동
    if (cmd.hug_height !== false) {
      try { node.layoutSizingVertical = 'HUG'; } catch(e) {}
    }
    if (cmd.fixed_height) {
      try { node.layoutSizingVertical = 'FIXED'; } catch(e) {}
    }
  }
}

// UI에서 메시지 수신
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'execute-commands') {
    const results = [];
    frameStack = [];
    currentFrame = null;
    for (const cmd of msg.commands) {
      try {
        const result = await executeCommand(cmd);
        results.push({ success: true, command: cmd.action, result });
      } catch (e) {
        results.push({ success: false, command: cmd.action, error: e.message });
      }
    }
    figma.ui.postMessage({ type: 'command-results', results });
  }
};

async function executeCommand(cmd) {
  switch (cmd.action) {
    case 'create_page':
      return createPage(cmd);
    case 'create_frame':
      return createFrame(cmd);
    case 'create_text':
      return createText(cmd);
    case 'create_rectangle':
      return createRectangle(cmd);
    case 'create_image':
      return createImage(cmd);
    case 'create_section':
      return createSection(cmd);
    case 'set_background':
      return setBackground(cmd);
    case 'create_auto_layout':
      return createAutoLayout(cmd);
    case 'close_frame':
      popFrame();
      return '프레임 닫힘 (상위 프레임으로 복귀)';
    default:
      return `알 수 없는 명령: ${cmd.action}`;
  }
}

// ── 자식 노드를 현재 프레임에 추가하는 헬퍼 ──
function appendToCurrentFrame(node, cmd) {
  if (cmd.parent_id) {
    const parent = figma.getNodeById(cmd.parent_id);
    if (parent && 'appendChild' in parent) {
      parent.appendChild(node);
      return;
    }
  }
  if (currentFrame) {
    currentFrame.appendChild(node);
    configureChildLayout(node, cmd);
  }
}

// 새 페이지 생성
function createPage(cmd) {
  const page = figma.createPage();
  page.name = cmd.name || '새 페이지';
  figma.currentPage = page;
  frameStack = [];
  currentFrame = null;
  return `페이지 "${page.name}" 생성됨`;
}

// 프레임 생성 (대지)
function createFrame(cmd) {
  const frame = figma.createFrame();
  frame.name = cmd.name || 'Frame';
  frame.resize(cmd.width || 1920, cmd.height || 1080);
  frame.x = cmd.x || 0;
  frame.y = cmd.y || 0;
  frame.clipsContent = cmd.clip !== undefined ? cmd.clip : true;

  if (cmd.fill) {
    frame.fills = [{ type: 'SOLID', color: hexToRgb(cmd.fill) }];
  }

  // Auto Layout 설정
  if (cmd.auto_layout) {
    frame.layoutMode = cmd.auto_layout.direction || 'VERTICAL';
    frame.primaryAxisSizingMode = cmd.auto_layout.primary_sizing || 'AUTO';
    frame.counterAxisSizingMode = cmd.auto_layout.counter_sizing || 'FIXED';
    if (cmd.auto_layout.gap !== undefined) frame.itemSpacing = cmd.auto_layout.gap;
    if (cmd.auto_layout.padding !== undefined) {
      frame.paddingTop = cmd.auto_layout.padding;
      frame.paddingBottom = cmd.auto_layout.padding;
      frame.paddingLeft = cmd.auto_layout.padding;
      frame.paddingRight = cmd.auto_layout.padding;
    }
    if (cmd.auto_layout.padding_top !== undefined) frame.paddingTop = cmd.auto_layout.padding_top;
    if (cmd.auto_layout.padding_bottom !== undefined) frame.paddingBottom = cmd.auto_layout.padding_bottom;
    if (cmd.auto_layout.padding_left !== undefined) frame.paddingLeft = cmd.auto_layout.padding_left;
    if (cmd.auto_layout.padding_right !== undefined) frame.paddingRight = cmd.auto_layout.padding_right;
    if (cmd.auto_layout.align) {
      frame.primaryAxisAlignItems = cmd.auto_layout.align;
    }
    if (cmd.auto_layout.counter_align) {
      frame.counterAxisAlignItems = cmd.auto_layout.counter_align;
    }
  }

  if (cmd.parent_id) {
    const parent = figma.getNodeById(cmd.parent_id);
    if (parent && 'appendChild' in parent) {
      parent.appendChild(frame);
    }
  } else if (currentFrame) {
    currentFrame.appendChild(frame);
    configureChildLayout(frame, cmd);
  }

  // push: 이 프레임을 현재 활성 프레임으로 설정 (기본)
  if (cmd.no_push !== true) {
    pushFrame(frame);
  }

  return `프레임 "${frame.name}" 생성됨 (${frame.width}x${frame.height})`;
}

// 텍스트 생성
async function createText(cmd) {
  const text = figma.createText();

  var fontFamily = cmd.font_family || 'Inter';
  var fontStyle = cmd.font_style || 'Regular';
  var fontLoaded = false;

  if (cmd.font_weight === 'Bold' || cmd.font_weight === 'bold') {
    fontStyle = 'Bold';
  }

  // 폰트 로드 (우선순위: 요청 폰트 → Inter → Roboto)
  var fontsToTry = [
    { family: fontFamily, style: fontStyle },
    { family: fontFamily, style: 'Regular' },
    { family: 'Inter', style: fontStyle },
    { family: 'Inter', style: 'Regular' },
    { family: 'Roboto', style: 'Regular' },
  ];
  // Bold 요청이 아니면 Regular 폴백 불필요
  if (fontStyle === 'Regular') {
    fontsToTry = fontsToTry.filter(function(f, i) { return i !== 1; });
  }

  for (var fi = 0; fi < fontsToTry.length; fi++) {
    try {
      await figma.loadFontAsync(fontsToTry[fi]);
      text.fontName = fontsToTry[fi];
      fontLoaded = true;
      break;
    } catch(e) {}
  }

  if (fontLoaded) {
    text.characters = cmd.text || '';
  }
  text.name = cmd.name || (cmd.text ? cmd.text.substring(0, 30) : 'Text');

  if (cmd.font_size) text.fontSize = cmd.font_size;

  if (cmd.color) {
    text.fills = [{ type: 'SOLID', color: hexToRgb(cmd.color) }];
  }

  // Auto Layout 내에서 텍스트 크기 제어
  if (cmd.width) {
    text.resize(cmd.width, text.height);
  }
  // textAutoResize: 높이 자동 조절
  text.textAutoResize = cmd.text_auto_resize || 'HEIGHT';

  if (cmd.x !== undefined) text.x = cmd.x;
  if (cmd.y !== undefined) text.y = cmd.y;

  if (cmd.text_align) {
    var alignMap = { LEFT: 'LEFT', CENTER: 'CENTER', RIGHT: 'RIGHT', left: 'LEFT', center: 'CENTER', right: 'RIGHT' };
    text.textAlignHorizontal = alignMap[cmd.text_align] || 'LEFT';
  }
  if (cmd.vertical_align) {
    text.textAlignVertical = cmd.vertical_align;
  }

  if (cmd.line_height) {
    text.lineHeight = { value: cmd.line_height, unit: 'PIXELS' };
  }
  if (cmd.letter_spacing) {
    text.letterSpacing = { value: cmd.letter_spacing, unit: 'PIXELS' };
  }

  // 프레임에 자동 추가
  appendToCurrentFrame(text, cmd);

  return `텍스트 "${text.characters.substring(0, 30)}" 생성됨`;
}

// 사각형 생성
function createRectangle(cmd) {
  const rect = figma.createRectangle();
  rect.name = cmd.name || 'Rectangle';
  rect.resize(cmd.width || 100, cmd.height || 100);
  if (cmd.x !== undefined) rect.x = cmd.x;
  if (cmd.y !== undefined) rect.y = cmd.y;

  if (cmd.fill) {
    rect.fills = [{ type: 'SOLID', color: hexToRgb(cmd.fill) }];
  }
  if (cmd.corner_radius) {
    rect.cornerRadius = cmd.corner_radius;
  }
  if (cmd.opacity !== undefined) {
    rect.opacity = cmd.opacity;
  }
  if (cmd.stroke_color) {
    rect.strokes = [{ type: 'SOLID', color: hexToRgb(cmd.stroke_color) }];
    rect.strokeWeight = cmd.stroke_weight || 1;
  }

  appendToCurrentFrame(rect, cmd);
  return `사각형 "${rect.name}" 생성됨`;
}

// 이미지 배치
async function createImage(cmd) {
  if (!cmd.url) return '이미지 URL이 필요합니다.';

  return new Promise((resolve) => {
    figma.ui.postMessage({ type: 'fetch-image', url: cmd.url, cmd });

    const handler = (msg) => {
      if (msg.type === 'image-data') {
        figma.ui.off('message', handler);
        const imageBytes = new Uint8Array(msg.data);
        const image = figma.createImage(imageBytes);
        const rect = figma.createRectangle();
        rect.name = cmd.name || 'Image';
        rect.resize(cmd.width || 400, cmd.height || 300);
        if (cmd.x !== undefined) rect.x = cmd.x;
        if (cmd.y !== undefined) rect.y = cmd.y;
        rect.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
        appendToCurrentFrame(rect, cmd);
        resolve(`이미지 "${rect.name}" 배치됨`);
      }
    };
    figma.ui.on('message', handler);
    setTimeout(() => {
      figma.ui.off('message', handler);
      resolve('이미지 로드 시간 초과');
    }, 10000);
  });
}

// 섹션 생성
function createSection(cmd) {
  const section = figma.createFrame();
  section.name = cmd.name || 'Section';
  section.resize(cmd.width || 860, cmd.height || 600);
  if (cmd.x !== undefined) section.x = cmd.x;
  if (cmd.y !== undefined) section.y = cmd.y;
  section.layoutMode = 'VERTICAL';
  section.primaryAxisSizingMode = 'AUTO';
  section.counterAxisSizingMode = 'FIXED';
  section.paddingTop = cmd.padding || 60;
  section.paddingBottom = cmd.padding || 60;
  section.paddingLeft = cmd.padding || 40;
  section.paddingRight = cmd.padding || 40;
  section.itemSpacing = cmd.gap || 20;

  if (cmd.fill) {
    section.fills = [{ type: 'SOLID', color: hexToRgb(cmd.fill) }];
  } else {
    section.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  }

  appendToCurrentFrame(section, cmd);
  return `섹션 "${section.name}" 생성됨`;
}

// 배경색 설정
function setBackground(cmd) {
  const node = cmd.node_id ? figma.getNodeById(cmd.node_id) : figma.currentPage;
  if (!node) return '노드를 찾을 수 없습니다.';
  if ('fills' in node) {
    node.fills = [{ type: 'SOLID', color: hexToRgb(cmd.color || '#FFFFFF') }];
    return `배경색 변경됨: ${cmd.color}`;
  }
  return '이 노드는 배경색을 지원하지 않습니다.';
}

// Auto Layout 프레임 생성
function createAutoLayout(cmd) {
  const frame = figma.createFrame();
  frame.name = cmd.name || 'Auto Layout';
  frame.layoutMode = cmd.direction || 'VERTICAL';
  frame.primaryAxisSizingMode = cmd.primary_sizing || 'AUTO';
  frame.counterAxisSizingMode = cmd.counter_sizing || 'FIXED';
  frame.itemSpacing = cmd.gap || 0;
  frame.paddingTop = cmd.padding_top || cmd.padding || 0;
  frame.paddingBottom = cmd.padding_bottom || cmd.padding || 0;
  frame.paddingLeft = cmd.padding_left || cmd.padding || 0;
  frame.paddingRight = cmd.padding_right || cmd.padding || 0;

  if (cmd.width) frame.resize(cmd.width, cmd.height || 100);
  if (cmd.fill) frame.fills = [{ type: 'SOLID', color: hexToRgb(cmd.fill) }];
  else frame.fills = [];
  if (cmd.x !== undefined) frame.x = cmd.x;
  if (cmd.y !== undefined) frame.y = cmd.y;
  if (cmd.corner_radius) frame.cornerRadius = cmd.corner_radius;

  if (cmd.align) frame.primaryAxisAlignItems = cmd.align;
  if (cmd.counter_align) frame.counterAxisAlignItems = cmd.counter_align;

  if (cmd.clip !== undefined) frame.clipsContent = cmd.clip;
  if (cmd.stroke_color) {
    frame.strokes = [{ type: 'SOLID', color: hexToRgb(cmd.stroke_color) }];
    frame.strokeWeight = cmd.stroke_weight || 1;
  }

  appendToCurrentFrame(frame, cmd);

  // push: 이후 자식들이 이 프레임에 추가됨
  if (cmd.no_push !== true) {
    pushFrame(frame);
  }

  return `Auto Layout "${frame.name}" 생성됨`;
}

// HEX to RGB 변환
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  var r = parseInt(hex.substring(0, 2), 16) / 255;
  var g = parseInt(hex.substring(2, 4), 16) / 255;
  var b = parseInt(hex.substring(4, 6), 16) / 255;
  return { r: r, g: g, b: b };
}
