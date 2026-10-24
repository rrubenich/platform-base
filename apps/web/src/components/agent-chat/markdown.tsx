import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Styles for the Markdown the agent writes (no typography plugin here).
const components: Components = {
	h1: (props) => (
		<h3 className="mt-4 mb-2 font-semibold text-base" {...props} />
	),
	h2: (props) => (
		<h3 className="mt-4 mb-2 font-semibold text-base" {...props} />
	),
	h3: (props) => <h4 className="mt-3 mb-1.5 font-semibold" {...props} />,
	p: (props) => <p className="my-2 leading-relaxed" {...props} />,
	ul: (props) => <ul className="my-2 list-disc space-y-1 pl-5" {...props} />,
	ol: (props) => <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />,
	a: (props) => (
		<a
			className="font-medium underline underline-offset-4"
			target="_blank"
			rel="noreferrer"
			{...props}
		/>
	),
	blockquote: (props) => (
		<blockquote
			className="my-2 border-l-2 pl-3 text-muted-foreground"
			{...props}
		/>
	),
	pre: (props) => (
		<pre
			className="my-3 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs [&>code]:bg-transparent [&>code]:p-0"
			{...props}
		/>
	),
	code: (props) => (
		<code
			className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
			{...props}
		/>
	),
	table: (props) => (
		<div className="my-3 overflow-x-auto">
			<table className="w-full border-collapse text-xs" {...props} />
		</div>
	),
	th: (props) => (
		<th className="border-b px-2 py-1.5 text-left font-medium" {...props} />
	),
	td: (props) => <td className="border-b px-2 py-1.5 align-top" {...props} />,
};

export function Markdown({ children }: { children: string }) {
	return (
		<div className="text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
			<ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
				{children}
			</ReactMarkdown>
		</div>
	);
}
