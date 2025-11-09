import { useEffect, useState } from "react";

export interface OpenTab {
	schema: string;
	table: string;
	id: string; // "schema.table"
}

const getLocalStorageKey = (connectionName: string) =>
	`open-tabs-${connectionName}`;

export const useOpenTabs = (connectionName: string) => {
	const [tabs, setTabs] = useState<OpenTab[]>([]);
	const [activeTabId, setActiveTabId] = useState<string | null>(null);

	// Load tabs from localStorage on mount
	useEffect(() => {
		const stored = localStorage.getItem(getLocalStorageKey(connectionName));
		if (stored) {
			try {
				const parsedTabs = JSON.parse(stored) as OpenTab[];
				setTabs(parsedTabs);
				if (parsedTabs.length > 0) {
					setActiveTabId(parsedTabs[0].id);
				}
			} catch {
				// Invalid stored data, ignore
			}
		}
	}, [connectionName]);

	// Save tabs to localStorage whenever they change
	useEffect(() => {
		localStorage.setItem(
			getLocalStorageKey(connectionName),
			JSON.stringify(tabs),
		);
	}, [tabs, connectionName]);

	const addTab = (schema: string, table: string) => {
		const id = `${schema}.${table}`;
		setTabs((prev) => {
			// Check if tab already exists
			if (prev.some((tab) => tab.id === id)) {
				// Tab already exists, just switch to it
				setActiveTabId(id);
				return prev;
			}
			// Add new tab
			const newTabs = [...prev, { schema, table, id }];
			setActiveTabId(id);
			return newTabs;
		});
	};

	const closeTab = (tabId: string) => {
		setTabs((prev) => {
			const filtered = prev.filter((tab) => tab.id !== tabId);
			// If we closed the active tab, switch to the last remaining tab
			if (activeTabId === tabId && filtered.length > 0) {
				setActiveTabId(filtered[filtered.length - 1].id);
			} else if (filtered.length === 0) {
				setActiveTabId(null);
			}
			return filtered;
		});
	};

	const closeAllTabs = () => {
		setTabs([]);
		setActiveTabId(null);
	};

	const setActiveTab = (tabId: string) => {
		setActiveTabId(tabId);
	};

	return {
		tabs,
		activeTabId,
		addTab,
		closeTab,
		closeAllTabs,
		setActiveTab,
	};
};
