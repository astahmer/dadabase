import { useState, useEffect } from "react";

export function useLocalStorage<T>(
	key: string,
	fallback?: T,
): [T | undefined, (value: T) => void] {
	const [value, setValue] = useState<T | undefined>(undefined);

	// Load from localStorage on mount
	useEffect(() => {
		try {
			const item = window.localStorage.getItem(key);
			if (item) {
				setValue(JSON.parse(item));
			} else if (fallback !== undefined) {
				setValue(fallback);
			}
		} catch (error) {
			console.error(`Error reading localStorage key "${key}":`, error);
		}
	}, [key, fallback]);

	const setValueWithStorage = (newValue: T) => {
		try {
			setValue(newValue);
			window.localStorage.setItem(key, JSON.stringify(newValue));
		} catch (error) {
			console.error(`Error writing to localStorage key "${key}":`, error);
		}
	};

	return [value, setValueWithStorage];
}
