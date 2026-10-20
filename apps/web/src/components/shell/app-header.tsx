import { Link } from "@tanstack/react-router";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Separator } from "@workspace/ui/components/separator";
import { SidebarTrigger } from "@workspace/ui/components/sidebar";
import { Fragment } from "react";
import { useBreadcrumbs } from "@/lib/breadcrumbs";

export function AppHeader() {
	const breadcrumbs = useBreadcrumbs();

	return (
		<header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
			<div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
				<SidebarTrigger className="-ml-1" />
				<Separator
					orientation="vertical"
					className="mx-2 h-4 data-vertical:self-auto"
				/>
				<Breadcrumb>
					<BreadcrumbList>
						{breadcrumbs.map((crumb, index) => (
							<Fragment key={crumb.id}>
								{index > 0 && <BreadcrumbSeparator />}
								<BreadcrumbItem>
									{index === breadcrumbs.length - 1 ? (
										<BreadcrumbPage>{crumb.title}</BreadcrumbPage>
									) : (
										<BreadcrumbLink render={<Link to={crumb.pathname} />}>
											{crumb.title}
										</BreadcrumbLink>
									)}
								</BreadcrumbItem>
							</Fragment>
						))}
					</BreadcrumbList>
				</Breadcrumb>
			</div>
		</header>
	);
}
