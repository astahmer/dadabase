import { useEffect, useRef } from "react";

interface SqlMonacoEditorProps {
	/** The SQL code to display/edit */
	sql: string;
	/** Callback when editor content changes */
	onChange?: (value: string) => void;
	/** Optional CSS class */
	className?: string;
}

/**
 * Monaco SQL Editor component using modern-monaco
 * Lazy-loads the editor for optimal performance
 */
export function SqlMonacoEditor({
	sql,
	onChange,
	className = "",
}: SqlMonacoEditorProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<any>(null);
	const monacoRef = useRef<any>(null);
	const modelRef = useRef<any>(null);

	useEffect(() => {
		let mounted = true;

		const initializeEditor = async () => {
			if (!containerRef.current) return;

			try {
				// Dynamically import modern-monaco
				const { init } = await import("modern-monaco");

				// Initialize monaco
				const monaco = await init();
				monacoRef.current = monaco;

				if (!mounted) return;

				// Create editor instance
				const editor = monaco.editor.create(containerRef.current, {
					language: "sql",
					theme: "vs-light",
					automaticLayout: true,
					minimap: { enabled: false },
					fontSize: 13,
					fontFamily: '"Fira Code", "Cascadia Code", monospace',
					scrollBeyondLastLine: false,
					wordWrap: "on",
					readOnly: false,
					padding: { top: 8, bottom: 8 },
				});

				editorRef.current = editor;

				// Create and attach model
				const model = monaco.editor.createModel(sql, "sql");
				modelRef.current = model;
				editor.setModel(model);

				// Handle changes
				if (onChange) {
					const disposable = model.onDidChangeContent(() => {
						onChange(model.getValue());
					});

					return () => {
						disposable.dispose();
					};
				}
			} catch (error) {
				console.error("Failed to initialize Monaco editor:", error);
			}
		};

		initializeEditor();

		return () => {
			mounted = false;
		};
	}, []);

	// Update model content when sql prop changes (from external updates)
	useEffect(() => {
		if (modelRef.current && editorRef.current) {
			const currentValue = modelRef.current.getValue();
			if (currentValue !== sql) {
				// Preserve cursor position
				const position = editorRef.current.getPosition();
				modelRef.current.setValue(sql);
				if (position) {
					editorRef.current.setPosition(position);
				}
			}
		}
	}, [sql]);

	return (
		<div
			ref={containerRef}
			className={`w-full h-full ${className}`}
			style={{ display: "flex" }}
		/>
	);
}
