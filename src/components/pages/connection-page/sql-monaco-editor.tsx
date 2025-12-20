import Editor, { type Monaco } from "@monaco-editor/react";
import type * as OriginalMonacoEditor from "monaco-editor";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { formatSQL } from "#src/lib/format-sql";

interface SqlMonacoEditorProps {
	/** The SQL code to display/edit */
	sql: string;
	/** Callback when editor content changes */
	onChange?: (value: string) => void;
	/** Optional CSS class */
	className?: string;
}

// https://shiki.style/themes
// tm-themes/OneDarkPro
// https://github.com/esm-dev/modern-monaco/blob/0dad413a046c2a1b329ee1d2b6d4fe11492ba633/src/shiki-monaco.ts#L47

/**
 * Monaco SQL Editor component using @monaco-editor/react
 * Provides a simple wrapper around the Monaco Editor
 */
export function SqlMonacoEditor({
	sql,
	onChange,
	className = "",
}: SqlMonacoEditorProps) {
	const monacoRef = useRef<Monaco>(null);
	// const editorRef =
	// 	useRef<OriginalMonacoEditor.editor.IStandaloneCodeEditor | null>(null);
	const [editorRef, setEditorRef] =
		useState<OriginalMonacoEditor.editor.IStandaloneCodeEditor | null>(null);
	const [theme, setTheme] = useState<"vs-light" | "vs-dark">("vs-light");

	// Determine the current theme based on dark mode
	const getTheme = useEffectEvent((): "vs-light" | "vs-dark" => {
		return document.documentElement.classList.contains("dark")
			? "vs-dark"
			: "vs-light";
	});

	// Watch for dark mode changes
	useEffect(() => {
		const initialTheme = getTheme();
		setTheme(initialTheme);

		const observer = new MutationObserver(() => {
			const newTheme = getTheme();
			setTheme(newTheme);
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => {
			observer.disconnect();
		};
	}, []);

	useEffect(() => {
		if (!editorRef) return;

		const actionId = "editor.action.formatSQL";
		const action: OriginalMonacoEditor.editor.IActionDescriptor = {
			id: actionId,
			label: "Format SQL",
			contextMenuGroupId: "1_modification",
			contextMenuOrder: 1,
			run: (editor) => {
				const content = editor.getValue();
				const formatted = formatSQL(content);
				editor.setValue(formatted);
			},
		};

		const disposable = editorRef.addAction(action);
		return () => {
			disposable.dispose();
		};
	}, [editorRef]);

	return (
		<Editor
			onMount={(editor) => {
				// editorRef.current = editor;
				setEditorRef(editor);
			}}
			beforeMount={(monaco: typeof OriginalMonacoEditor) => {
				monacoRef.current = monaco;
			}}
			height="100%"
			defaultLanguage="sql"
			value={sql}
			onChange={(value) => {
				if (value !== undefined && onChange) {
					onChange(value);
				}
			}}
			theme={theme}
			className={className}
			options={{
				automaticLayout: true,
				minimap: { enabled: false },
				fontSize: 13,
				fontFamily: '"Fira Code", "Cascadia Code", monospace',
				scrollBeyondLastLine: false,
				wordWrap: "on",
				readOnly: false,
				padding: { top: 8, bottom: 8 },
			}}
		/>
	);
}
