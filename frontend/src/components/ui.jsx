import { forwardRef } from "react";
function cx(...classes) {
    return classes.filter(Boolean).join(" ");
}
export function Card({ className, children }) {
    return <div className={cx("rounded-3xl border border-line bg-card shadow-soft", className)}>{children}</div>;
}
export function CardHeader({ className, children }) {
    return <div className={cx("border-b border-line px-5 py-4 sm:px-6", className)}>{children}</div>;
}
export function CardBody({ className, children }) {
    return <div className={cx("px-5 py-5 sm:px-6", className)}>{children}</div>;
}
export function Title({ className, children }) {
    return <h1 className={cx("text-2xl font-semibold tracking-tight text-ink sm:text-3xl", className)}>{children}</h1>;
}
export function Subtitle({ className, children }) {
    return <p className={cx("mt-2 text-sm text-muted", className)}>{children}</p>;
}
export function Button({ className, variant = "primary", type = "button", disabled, title, children, onClick }) {
    const styles = {
        primary: "bg-accent text-white hover:bg-teal-700",
        secondary: "bg-white text-ink border border-line hover:bg-slate-50",
        ghost: "bg-transparent text-ink hover:bg-slate-100",
        danger: "bg-rose-600 text-white hover:bg-rose-700"
    };
    return (<button type={type} onClick={onClick} disabled={disabled} title={title} className={cx("inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50", styles[variant], className)}>
      {children}
    </button>);
}
export const Input = forwardRef(function Input({ className, ...props }, ref) {
    return (<input ref={ref} {...props} className={cx("h-11 w-full rounded-2xl border border-line bg-white px-4 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/10", className)}/>);
});
export function Select({ className, ...props }) {
    return (<select {...props} className={cx("h-11 w-full rounded-2xl border border-line bg-white px-4 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10", className)}/>);
}
export function Label({ children }) {
    return <label className="mb-2 block text-sm font-medium text-ink">{children}</label>;
}
export function Badge({ children, className }) {
    return <span className={cx("inline-flex items-center rounded-full bg-accentSoft px-3 py-1 text-xs font-semibold text-accent", className)}>{children}</span>;
}
export { cx };
