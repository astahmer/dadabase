import type { RelationshipViewMode } from "#src/components/pages/connection-page/relationships/relationship-view-mode.ts";

import { RelationshipViewMode as RelationshipViewModeEnum } from "#src/components/pages/connection-page/relationships/relationship-view-mode.ts";
import { useReducer } from "react";

interface RelationshipsPanelState {
  selectedRelationships: Set<string>;
  displayedRelationships: Set<string>;
  relationshipViewMode: Record<string, RelationshipViewMode>;
}

type RelationshipsPanelAction =
  | {
      type: "SELECT_RELATIONSHIP";
      constraintName: string;
    }
  | {
      type: "DESELECT_RELATIONSHIP";
      constraintName: string;
    }
  | {
      type: "DISPLAY_RELATIONSHIP";
      constraintName: string;
    }
  | {
      type: "HIDE_RELATIONSHIP";
      constraintName: string;
    }
  | {
      type: "SELECT_GROUP";
      constraintNames: string[];
    }
  | {
      type: "DESELECT_GROUP";
      constraintNames: string[];
    }
  | {
      type: "SET_VIEW_MODE";
      constraintName: string;
      mode: RelationshipViewMode;
    }
  | {
      type: "RESET";
    };

function relationshipsPanelReducer(
  state: RelationshipsPanelState,
  action: RelationshipsPanelAction,
): RelationshipsPanelState {
  switch (action.type) {
    case "SELECT_RELATIONSHIP": {
      const next = new Set(state.selectedRelationships);
      next.add(action.constraintName);
      return { ...state, selectedRelationships: next };
    }
    case "DESELECT_RELATIONSHIP": {
      const next = new Set(state.selectedRelationships);
      next.delete(action.constraintName);
      return { ...state, selectedRelationships: next };
    }
    case "DISPLAY_RELATIONSHIP": {
      const next = new Set(state.displayedRelationships);
      next.add(action.constraintName);
      return { ...state, displayedRelationships: next };
    }
    case "HIDE_RELATIONSHIP": {
      const next = new Set(state.displayedRelationships);
      next.delete(action.constraintName);
      return { ...state, displayedRelationships: next };
    }
    case "SELECT_GROUP": {
      const next = new Set(state.selectedRelationships);
      action.constraintNames.forEach((name) => next.add(name));
      const displayed = new Set(state.displayedRelationships);
      action.constraintNames.forEach((name) => displayed.add(name));
      return {
        ...state,
        selectedRelationships: next,
        displayedRelationships: displayed,
      };
    }
    case "DESELECT_GROUP": {
      const next = new Set(state.selectedRelationships);
      action.constraintNames.forEach((name) => next.delete(name));
      const displayed = new Set(state.displayedRelationships);
      action.constraintNames.forEach((name) => displayed.delete(name));
      return {
        ...state,
        selectedRelationships: next,
        displayedRelationships: displayed,
      };
    }
    case "SET_VIEW_MODE": {
      return {
        ...state,
        relationshipViewMode: {
          ...state.relationshipViewMode,
          [action.constraintName]: action.mode,
        },
      };
    }
    case "RESET": {
      return {
        selectedRelationships: new Set(),
        displayedRelationships: new Set(),
        relationshipViewMode: {},
      };
    }
    default:
      return state;
  }
}

export function useRelationshipsPanelState() {
  const [state, dispatch] = useReducer(relationshipsPanelReducer, {
    selectedRelationships: new Set<string>(),
    displayedRelationships: new Set<string>(),
    relationshipViewMode: {},
  });

  return {
    state,
    selectRelationship: (constraintName: string) => {
      dispatch({ type: "SELECT_RELATIONSHIP", constraintName });
      dispatch({ type: "DISPLAY_RELATIONSHIP", constraintName });
    },
    deselectRelationship: (constraintName: string) => {
      dispatch({ type: "DESELECT_RELATIONSHIP", constraintName });
      dispatch({ type: "HIDE_RELATIONSHIP", constraintName });
    },
    selectGroup: (constraintNames: string[]) => {
      dispatch({ type: "SELECT_GROUP", constraintNames });
    },
    deselectGroup: (constraintNames: string[]) => {
      dispatch({ type: "DESELECT_GROUP", constraintNames });
    },
    hideRelationship: (constraintName: string) => {
      dispatch({ type: "HIDE_RELATIONSHIP", constraintName });
    },
    setViewMode: (constraintName: string, mode: RelationshipViewMode) => {
      dispatch({ type: "SET_VIEW_MODE", constraintName, mode });
    },
    reset: () => {
      dispatch({ type: "RESET" });
    },
  };
}
