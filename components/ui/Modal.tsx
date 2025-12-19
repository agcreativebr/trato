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

	// Evita "pulo" da barra superior ao abrir o modal (lock scroll + compensação do scrollbar)
	React.useEffect(() => {
		const doc = document.documentElement;
		const body = document.body;
		const prevOverflow = doc.style.overflow;
		const prevBodyOverflow = body.style.overflow;
		doc.style.overflow = 'hidden';
		body.style.overflow = 'hidden';
		return () => {
			doc.style.overflow = prevOverflow;
			body.style.overflow = prevBodyOverflow;
		};
	}, []);

	return (
		<div className="fixed inset-0 z-[100] flex items-start justify-center">
			<div className="absolute inset-0 bg-black/40" onClick={onClose} />
			<div className="relative my-10 mx-4 w-full max-w-[1100px]">
				<div className={clsx('bg-white rounded-xl shadow-lg border', className)}>
					{children}
				</div>
			</div>
		</div>
	);
}


