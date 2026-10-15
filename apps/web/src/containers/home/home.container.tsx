import { HomeProvider } from "./home.context";
import { HomePage } from "./home.page";

export function HomeContainer() {
	return (
		<HomeProvider>
			<HomePage />
		</HomeProvider>
	);
}
