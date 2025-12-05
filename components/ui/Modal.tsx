import * as React from 'react';
import clsx from 'classnames';

type ModalProps = {
	open: boolean;
	onClose: () => void;
	children: React.ReactNode;
	className?: string;
};

export function Modal({ open, onClose, children, className }: ModalProps) {
	if (!open) return null;
	return (
		<div className="fixed inset-0 z-[100]">
			<div className="absolute inset-0 bg-black/30" onClick={onClose} />
			<div className="absolute inset-0 overflow-auto">
				<div className="mx-auto max-w-5xl p-6">
					<div className={clsx('bg-white rounded-xl shadow-lg border', className)}>
						{children}
					</div>
				</div>
			</div>
		</div>
	);
}


