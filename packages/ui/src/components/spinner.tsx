import { cn } from "cn";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon } from "@hugeicons/core-free-icons";

// HugeiconsIcon types strokeWidth as a number only, unlike a plain <svg>.
function Spinner({
	className,
	...props
}: Omit<React.ComponentProps<"svg">, "strokeWidth">) {
	return (
		<HugeiconsIcon
			icon={Loading03Icon}
			strokeWidth={2}
			data-slot="spinner"
			role="status"
			aria-label="Loading"
			className={cn("size-4 animate-spin", className)}
			{...props}
		/>
	);
}

export { Spinner };
