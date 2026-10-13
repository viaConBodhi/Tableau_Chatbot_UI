export const PANEL_WIDTH = 420;
export const PANEL_HEIGHT = 700;
export const MARGIN = 8;
export const MIN_DASHBOARD_WIDTH = 320;
export const MIN_DASHBOARD_HEIGHT = 300;

export function objectRectangle(object) {
  const rectangle = {
    x: object?.position?.x,
    y: object?.position?.y,
    width: object?.size?.width,
    height: object?.size?.height,
  };
  if (!Object.values(rectangle).every(Number.isFinite) || rectangle.width <= 0 || rectangle.height <= 0) {
    throw new Error('Tableau did not provide a valid position and size for this extension.');
  }
  return rectangle;
}

export function validDashboardSize(size) {
  if (!Number.isFinite(size?.width) || !Number.isFinite(size?.height) || size.width <= 0 || size.height <= 0) {
    throw new Error('Tableau did not provide valid dashboard dimensions.');
  }
  return { width: size.width, height: size.height };
}

export function sameRectangle(left, right) {
  return Boolean(left && right && ['x', 'y', 'width', 'height'].every(key => Math.abs(left[key] - right[key]) <= 1));
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function expandedRectangle(authored, dashboardSize) {
  const size = validDashboardSize(dashboardSize);
  if (size.width < MIN_DASHBOARD_WIDTH || size.height < MIN_DASHBOARD_HEIGHT) {
    throw new Error(`AI Guide needs a dashboard of at least ${MIN_DASHBOARD_WIDTH} × ${MIN_DASHBOARD_HEIGHT} pixels. Enlarge the dashboard and try again.`);
  }
  const width = Math.min(PANEL_WIDTH, size.width - 2 * MARGIN);
  const height = Math.min(PANEL_HEIGHT, size.height - 2 * MARGIN);
  return {
    x: clamp(authored.x + authored.width - width, MARGIN, size.width - MARGIN - width),
    y: clamp(authored.y, MARGIN, size.height - MARGIN - height),
    width,
    height,
  };
}

export function collapsedRectangle(authored, dashboardSize) {
  const size = validDashboardSize(dashboardSize);
  const width = Math.min(authored.width, size.width);
  const height = Math.min(authored.height, size.height);
  return {
    x: clamp(authored.x, 0, size.width - width),
    y: clamp(authored.y, 0, size.height - height),
    width,
    height,
  };
}
