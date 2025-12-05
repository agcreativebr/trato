import * as React from 'react';
import clsx from 'classnames';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: 'primary' | 'secondary' | 'ghost';
	size?: 'sm' | 'md' | 'lg';
	isLoading?: boolean;
	leftIcon?: React.ReactNode;
	rightIcon?: React.ReactNode;
};

export function Button({
	className,
	variant = 'primary',
	size = 'md',
	isLoading,
	leftIcon,
	rightIcon,
	children,
	...props
}: ButtonProps) {
	const base =
		'inline-flex items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none';
	const variants: Record<string, string> = {
		primary: 'bg-black text-white hover:bg-neutral-800 focus:ring-black',
		secondary: 'bg-neutral-200 text-black hover:bg-neutral-300 focus:ring-neutral-400',
		ghost: 'bg-transparent hover:bg-neutral-100 text-black focus:ring-neutral-300'
	};
	const sizes: Record<string, string> = {
		sm: 'h-8 px-3 text-sm',
		md: 'h-10 px-4 text-sm',
		lg: 'h-12 px-5 text-base'
	};
	return (
		<button
			className={clsx(base, variants[variant], sizes[size], className)}
			aria-busy={isLoading}
			{...props}
		>
			{leftIcon && <span className="mr-2">{leftIcon}</span>}
			{children}
			{rightIcon && <span className="ml-2">{rightIcon}</span>}
		</button>
	);
}


