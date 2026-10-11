import React, { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import FormatBold from '@mui/icons-material/FormatBold';
import FormatItalic from '@mui/icons-material/FormatItalic';
import FormatUnderlined from '@mui/icons-material/FormatUnderlined';
import StrikethroughS from '@mui/icons-material/StrikethroughS';
import FormatColorText from '@mui/icons-material/FormatColorText';
import FormatColorFill from '@mui/icons-material/FormatColorFill';
import FormatAlignLeft from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenter from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRight from '@mui/icons-material/FormatAlignRight';
import FormatAlignJustify from '@mui/icons-material/FormatAlignJustify';
import FormatListBulleted from '@mui/icons-material/FormatListBulleted';
import FormatListNumbered from '@mui/icons-material/FormatListNumbered';
import Checklist from '@mui/icons-material/Checklist';
import FormatQuote from '@mui/icons-material/FormatQuote';
import Code from '@mui/icons-material/Code';
import DataObject from '@mui/icons-material/DataObject';
import HorizontalRule from '@mui/icons-material/HorizontalRule';
import LinkIcon from '@mui/icons-material/Link';
import LinkOff from '@mui/icons-material/LinkOff';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import TableChartOutlined from '@mui/icons-material/TableChartOutlined';
import Undo from '@mui/icons-material/Undo';
import Redo from '@mui/icons-material/Redo';
import FormatClear from '@mui/icons-material/FormatClear';
import { useTranslation } from 'next-i18next';
import { uploadImages } from '../../uploads';
import { imageUrl } from './Common';
import {
	ARTICLE_CONTENT_LIMIT,
	articleText,
	readArticleContent,
	sanitizeArticleHtml,
	serializeArticleContent,
} from './articleFormat';

export interface TeditorProps {
	initialContent: string;
	disabled: boolean;
	onChange: (content: string) => void;
	onReady: (ready: boolean) => void;
	onUploadBusy: (busy: boolean) => void;
	onError: (message: string) => void;
}

export default function Teditor({ initialContent, disabled, onChange, onReady, onUploadBusy, onError }: TeditorProps) {
	const { t } = useTranslation('common');
	const id = useId();
	const [value, setValue] = useState(initialContent);
	const [uploading, setUploading] = useState(false);
	const [linkOpen, setLinkOpen] = useState(false);
	const [url, setUrl] = useState('');
	const [linkError, setLinkError] = useState(false);
	const uploadLock = useRef(false);
	const mounted = useRef(true);
	const editor = useEditor({
		immediatelyRender: false,
		shouldRerenderOnTransaction: true,
		extensions: [
			StarterKit.configure({
				heading: { levels: [1, 2, 3] },
				link: { openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } },
			}),
			TextStyle,
			Color,
			TextAlign.configure({ types: ['heading', 'paragraph'] }),
			Highlight.configure({ multicolor: true }),
			TaskList,
			TaskItem.configure({ nested: true }),
			TableKit.configure({ table: { resizable: false } }),
			Image.configure({ allowBase64: false }),
			Placeholder.configure({ placeholder: t('Tell your travel story…') }),
		],
		content: readArticleContent(initialContent).html,
		editorProps: {
			transformPastedHTML: sanitizeArticleHtml,
			attributes: {
				class: 'triplink-rich-content',
				role: 'textbox',
				'aria-multiline': 'true',
				'aria-required': 'true',
				'aria-labelledby': `${id}-label`,
				'aria-describedby': `${id}-hint`,
			},
		},
		onUpdate: ({ editor: current }) => {
			const content = serializeArticleContent(current.getHTML());
			setValue(content);
			onChange(content);
		},
	});
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);
	useEffect(() => {
		onReady(Boolean(editor));
		return () => onReady(false);
	}, [editor, onReady]);
	useEffect(() => {
		editor?.setEditable(!disabled && !uploading, false);
	}, [editor, disabled, uploading]);
	const locked = disabled || uploading || !editor;
	const tool = (label: string, icon: ReactNode, run: () => unknown, active?: boolean, unavailable = false) => (
		<button
			type="button"
			title={t(label)}
			aria-label={t(label)}
			aria-pressed={active}
			disabled={locked || unavailable}
			onMouseDown={(event) => event.preventDefault()}
			onClick={() => run()}
		>
			{icon}
		</button>
	);
	const insertImage = async (file: File) => {
		if (!editor || locked || uploadLock.current) return;
		uploadLock.current = true;
		setUploading(true);
		onUploadBusy(true);
		try {
			const [path] = await uploadImages([file], 'article');
			if (mounted.current && !editor.isDestroyed)
				editor
					.chain()
					.focus()
					.setImage({ src: imageUrl(path), alt: file.name.replace(/\.[^.]+$/, '') })
					.run();
		} catch (error: unknown) {
			if (mounted.current) onError(error instanceof Error ? error.message : 'Upload failed');
		} finally {
			uploadLock.current = false;
			if (mounted.current) {
				setUploading(false);
				onUploadBusy(false);
			}
		}
	};
	const block = editor?.isActive('heading') ? `h${editor.getAttributes('heading').level}` : 'paragraph';
	const count = value.trim().length;
	return (
		<section className="triplink-editor" aria-labelledby={`${id}-label`} aria-busy={uploading}>
			<div className="triplink-editor__heading">
				<label id={`${id}-label`}>{t('Article body')} *</label>
				<span>{t('Rich text editor')}</span>
			</div>
			<div className="triplink-editor__surface">
				<div className="triplink-editor__toolbar" role="group" aria-label={t('Article formatting')}>
					<div className="triplink-editor__group">
						<select
							aria-label={t('Text style')}
							disabled={locked}
							value={block}
							onChange={(event) => {
								const level = Number(event.target.value.slice(1)) as 1 | 2 | 3;
								if (event.target.value === 'paragraph') editor?.chain().focus().setParagraph().run();
								else editor?.chain().focus().setHeading({ level }).run();
							}}
						>
							<option value="paragraph">{t('Paragraph')}</option>
							{[1, 2, 3].map((level) => (
								<option value={`h${level}`} key={level}>
									{t('Heading {{level}}', { level })}
								</option>
							))}
						</select>
					</div>
					<div className="triplink-editor__group">
						{tool('Bold', <FormatBold />, () => editor?.chain().focus().toggleBold().run(), editor?.isActive('bold'))}
						{tool(
							'Italic',
							<FormatItalic />,
							() => editor?.chain().focus().toggleItalic().run(),
							editor?.isActive('italic'),
						)}
						{tool(
							'Underline',
							<FormatUnderlined />,
							() => editor?.chain().focus().toggleUnderline().run(),
							editor?.isActive('underline'),
						)}
						{tool(
							'Strikethrough',
							<StrikethroughS />,
							() => editor?.chain().focus().toggleStrike().run(),
							editor?.isActive('strike'),
						)}
						<label className="triplink-editor__color" title={t('Text color')}>
							<FormatColorText />
							<input
								type="color"
								aria-label={t('Text color')}
								disabled={locked}
								value={editor?.getAttributes('textStyle').color || '#1e464b'}
								onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()}
							/>
						</label>
						{tool(
							'Highlight',
							<FormatColorFill />,
							() => editor?.chain().focus().toggleHighlight({ color: '#fff0a8' }).run(),
							editor?.isActive('highlight'),
						)}
					</div>
					<div className="triplink-editor__group">
						{(['left', 'center', 'right', 'justify'] as const).map((alignment, index) => (
							<React.Fragment key={alignment}>
								{tool(
									['Align left', 'Align center', 'Align right', 'Justify'][index],
									[
										<FormatAlignLeft key="left" />,
										<FormatAlignCenter key="center" />,
										<FormatAlignRight key="right" />,
										<FormatAlignJustify key="justify" />,
									][index],
									() => editor?.chain().focus().setTextAlign(alignment).run(),
									editor?.isActive({ textAlign: alignment }),
								)}
							</React.Fragment>
						))}
					</div>
					<div className="triplink-editor__group">
						{tool(
							'Bullet list',
							<FormatListBulleted />,
							() => editor?.chain().focus().toggleBulletList().run(),
							editor?.isActive('bulletList'),
						)}
						{tool(
							'Numbered list',
							<FormatListNumbered />,
							() => editor?.chain().focus().toggleOrderedList().run(),
							editor?.isActive('orderedList'),
						)}
						{tool(
							'Checklist',
							<Checklist />,
							() => editor?.chain().focus().toggleTaskList().run(),
							editor?.isActive('taskList'),
						)}
						{tool(
							'Quote',
							<FormatQuote />,
							() => editor?.chain().focus().toggleBlockquote().run(),
							editor?.isActive('blockquote'),
						)}
					</div>
					<div className="triplink-editor__group">
						{tool(
							'Add link',
							<LinkIcon />,
							() => {
								setUrl(editor?.getAttributes('link').href || '');
								setLinkError(false);
								setLinkOpen(true);
							},
							editor?.isActive('link'),
						)}
						{tool(
							'Remove link',
							<LinkOff />,
							() => editor?.chain().focus().extendMarkRange('link').unsetLink().run(),
							undefined,
							!editor?.isActive('link'),
						)}
						<label className={`triplink-editor__image${locked ? ' is-disabled' : ''}`} title={t('Insert image')}>
							<ImageOutlined />
							<input
								type="file"
								accept="image/jpeg,image/png"
								aria-label={t('Insert image')}
								disabled={locked}
								onChange={(event) => {
									const file = event.target.files?.[0];
									event.target.value = '';
									if (file) void insertImage(file);
								}}
							/>
						</label>
						{tool('Insert table', <TableChartOutlined />, () =>
							editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
						)}
						{tool('Divider', <HorizontalRule />, () => editor?.chain().focus().setHorizontalRule().run())}
					</div>
					<div className="triplink-editor__group">
						{tool('Inline code', <Code />, () => editor?.chain().focus().toggleCode().run(), editor?.isActive('code'))}
						{tool(
							'Code block',
							<DataObject />,
							() => editor?.chain().focus().toggleCodeBlock().run(),
							editor?.isActive('codeBlock'),
						)}
						{tool('Clear formatting', <FormatClear />, () =>
							editor?.chain().focus().unsetAllMarks().clearNodes().unsetTextAlign().run(),
						)}
						{tool('Undo', <Undo />, () => editor?.chain().focus().undo().run(), undefined, !editor?.can().undo())}
						{tool('Redo', <Redo />, () => editor?.chain().focus().redo().run(), undefined, !editor?.can().redo())}
					</div>
				</div>
				{editor?.isActive('table') && (
					<div className="triplink-editor__table-tools" role="group" aria-label={t('Table tools')}>
						{tool('Add row', t('Add row'), () => editor.chain().focus().addRowAfter().run())}
						{tool('Add column', t('Add column'), () => editor.chain().focus().addColumnAfter().run())}
						{tool('Delete row', t('Delete row'), () => editor.chain().focus().deleteRow().run())}
						{tool('Delete column', t('Delete column'), () => editor.chain().focus().deleteColumn().run())}
						{tool(
							'Merge cells',
							t('Merge cells'),
							() => editor.chain().focus().mergeCells().run(),
							undefined,
							!editor.can().mergeCells(),
						)}
						{tool(
							'Split cell',
							t('Split cell'),
							() => editor.chain().focus().splitCell().run(),
							undefined,
							!editor.can().splitCell(),
						)}
						{tool('Delete table', t('Delete table'), () => editor.chain().focus().deleteTable().run())}
					</div>
				)}
				<EditorContent editor={editor} />
				<div className="triplink-editor__footer">
					<span role="status">
						{uploading
							? t('Uploading image…')
							: t('{{count}} words', { count: articleText(value).trim().split(/\s+/).filter(Boolean).length })}
					</span>
					<span className={count > ARTICLE_CONTENT_LIMIT ? 'is-over-limit' : undefined}>
						{t('{{count}} / {{limit}} characters', { count, limit: ARTICLE_CONTENT_LIMIT })}
					</span>
				</div>
			</div>
			<p id={`${id}-hint`} className="triplink-editor__hint">
				{t('Up to 2,000 characters, including formatting. Images must be JPEG or PNG.')}
			</p>
			<Dialog open={linkOpen} onClose={() => setLinkOpen(false)} fullWidth maxWidth="xs">
				<DialogTitle>{t('Add link')}</DialogTitle>
				<DialogContent>
					<TextField
						autoFocus
						fullWidth
						margin="dense"
						label={t('Link URL')}
						value={url}
						onChange={(event) => setUrl(event.target.value)}
						error={linkError}
						helperText={linkError ? t('Enter a valid http, https or mailto link.') : 'https://'}
						onKeyDown={(event) => {
							if (event.key === 'Enter') event.preventDefault();
						}}
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setLinkOpen(false)}>{t('Cancel')}</Button>
					<Button
						variant="contained"
						disabled={locked}
						onClick={() => {
							try {
								const parsed = new URL(url.trim());
								if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) throw new Error('Invalid link');
								if (editor?.state.selection.empty && !editor.isActive('link')) {
									editor
										.chain()
										.focus()
										.insertContent({
											type: 'text',
											text: parsed.href,
											marks: [{ type: 'link', attrs: { href: parsed.href } }],
										})
										.run();
								} else editor?.chain().focus().extendMarkRange('link').setLink({ href: parsed.href }).run();
								setLinkOpen(false);
							} catch {
								setLinkError(true);
							}
						}}
					>
						{t('Apply link')}
					</Button>
				</DialogActions>
			</Dialog>
		</section>
	);
}
