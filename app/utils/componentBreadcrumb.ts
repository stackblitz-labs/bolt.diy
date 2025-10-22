type BreadcrumbKind = 'react' | 'html';

export interface BreadcrumbNode<T> {
  item: T;
  displayName: string;
  kind: BreadcrumbKind;
}

export interface BreadcrumbData<T> {
  filteredNodes: Array<BreadcrumbNode<T>>;
  reactComponents: Array<BreadcrumbNode<T>>;
  htmlElements: Array<BreadcrumbNode<T>>;
  firstReact?: BreadcrumbNode<T>;
  lastReact?: BreadcrumbNode<T>;
  lastHtml?: BreadcrumbNode<T>;
}

const EXCLUDED_SUBSTRINGS = ['Provider', 'Primitive', 'Boundary', 'Router'];
const EXCLUDED_NAMES = new Set(['Presence', 'Portal', 'FocusScope', 'DismissableLayer', 'Anonymous', 'main']);

const shouldExclude = (displayName?: string) => {
  if (!displayName) {
    return false;
  }

  if (displayName.includes('$')) {
    return true;
  }

  if (EXCLUDED_NAMES.has(displayName)) {
    return true;
  }

  return EXCLUDED_SUBSTRINGS.some((needle) => displayName.includes(needle));
};

const inferKindFromName = (displayName: string): BreadcrumbKind => {
  const firstChar = displayName[0];
  if (!firstChar) {
    return 'html';
  }

  return firstChar === firstChar.toUpperCase() ? 'react' : 'html';
};

interface BuildBreadcrumbOptions<T> {
  getDisplayName: (item: T) => string | undefined;
  getKind?: (item: T, displayName: string) => BreadcrumbKind | undefined;
}

export function buildBreadcrumbData<T>(
  items: T[] | null | undefined,
  { getDisplayName, getKind }: BuildBreadcrumbOptions<T>,
): BreadcrumbData<T> | null {
  if (!items || items.length === 0) {
    return null;
  }

  const reversed = [...items].reverse();
  const mainIndex = reversed.findIndex((item) => getDisplayName(item) === 'main');
  const sliceStart = mainIndex >= 0 ? mainIndex : 0;
  const trimmed = reversed.slice(sliceStart);

  const filtered = trimmed.filter((item) => !shouldExclude(getDisplayName(item)));
  if (filtered.length === 0) {
    return null;
  }

  const filteredNodes = filtered.map<BreadcrumbNode<T>>((item) => {
    const displayName = getDisplayName(item) ?? 'Anonymous';
    const kind = getKind?.(item, displayName) ?? inferKindFromName(displayName);

    return {
      item,
      displayName,
      kind,
    };
  });

  const reactComponents = filteredNodes.filter((node) => node.kind === 'react');
  const firstReact = reactComponents[0];
  const lastReact = reactComponents[reactComponents.length - 1];

  let htmlElements: Array<BreadcrumbNode<T>>;
  if (lastReact) {
    const lastReactIndex = filteredNodes.findIndex((node) => node === lastReact);
    htmlElements = filteredNodes.slice(lastReactIndex);
  } else {
    htmlElements = filteredNodes.filter((node) => node.kind === 'html');
  }

  let lastHtml: BreadcrumbNode<T> | undefined;
  for (const node of htmlElements) {
    if (node.kind === 'html') {
      lastHtml = node;
    }
  }

  return {
    filteredNodes,
    reactComponents,
    htmlElements,
    firstReact,
    lastReact,
    lastHtml,
  };
}
