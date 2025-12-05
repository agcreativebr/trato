import * as React from 'react';
import { createPortal } from 'react-dom';

export function Popover({
	open,
	onClose,
	anchorRect,
	children,
	width = 320
}: {
	open: boolean;
	onClose: () => void;
	anchorRect?: DOMRect | null;
	children: React.ReactNode;
	width?: number;
}) {
	if (!open) return null;
	const top = (anchorRect?.bottom ?? 100) + 6;
	const left = Math.min(
		Math.max((anchorRect?.left ?? 100) - width / 2, 12),
		(window.innerWidth - width - 12)
	);
	return createPortal(
		<div className="fixed inset-0 z-[200]">
			<div className="absolute inset-0" onClick={onClose} />
			<div
				className="absolute bg-white border rounded-xl shadow-lg p-3"
				style={{ top, left, width }}
			>
				{children}
			</div>
		</div>,
		document.body
	);
}


