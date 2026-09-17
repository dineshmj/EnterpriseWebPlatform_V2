export interface WorkspaceContextItem {
  title: string;
  value: string | number | boolean;
}

export interface WorkspaceContext {
  /** Items that should remain visible as the user moves between MFEs. */
  persistentContext: WorkspaceContextItem[];

  /** The entity/focus that is most relevant to the page currently displayed. */
  currentContext: WorkspaceContextItem[];

  /** Previously established context retained for downstream MFEs. */
  retainedContext: WorkspaceContextItem[];
}

export const EMPTY_WORKSPACE_CONTEXT: WorkspaceContext = {
  persistentContext: [],
  currentContext: [],
  retainedContext: [],
};
