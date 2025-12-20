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
	/** Available tables for intellisense suggestions */
	tables?: Array<{ schema: string; name: string }>;
}

// https://shiki.style/themes
// tm-themes/OneDarkPro
// https://github.com/esm-dev/modern-monaco/blob/0dad413a046c2a1b329ee1d2b6d4fe11492ba633/src/shiki-monaco.ts#L47

/**
 * Monaco SQL Editor component using @monaco-editor/react
 * Provides a simple wrapper around the Monaco Editor with SQL highlighting and intellisense
 */
export function SqlMonacoEditor({
	sql,
	onChange,
	className = "",
	tables = [],
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

	// Setup SQL intellisense with table suggestions
	useEffect(() => {
		const monaco = monacoRef.current;
		if (!monaco || tables.length === 0) return;

		const disposable = monaco.languages.registerCompletionItemProvider("sql", {
			provideCompletionItems: (
				model: OriginalMonacoEditor.editor.ITextModel,
				position: OriginalMonacoEditor.Position,
			) => {
				// Get the current word/context
				const word = model.getWordUntilPosition(position);
				const range = {
					startLineNumber: position.lineNumber,
					endLineNumber: position.lineNumber,
					startColumn: word.startColumn,
					endColumn: word.endColumn,
				};

				// Create completion items for tables
				const suggestions: OriginalMonacoEditor.languages.CompletionItem[] =
					tables.map((table) => ({
						label: table.name,
						kind: monaco.languages.CompletionItemKind.Struct,
						detail: `Table in schema: ${table.schema}`,
						insertText: `"${table.schema}"."${table.name}"`,
						range: range as any,
						sortText: table.name,
					}));

				return { suggestions };
			},
		});

		return () => {
			disposable.dispose();
		};
	}, [tables]);

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
			defaultValue={sql}
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
				quickSuggestions: {
					other: true,
					comments: false,
					strings: false,
				},
			}}
		/>
	);
}
