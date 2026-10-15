import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HelloStatus } from "./hello-status";

describe("HelloStatus", () => {
	it("shows a connecting message while loading", () => {
		render(<HelloStatus greeting={undefined} isLoading isError={false} />);

		expect(
			screen.getByText("API says: Connecting to API…"),
		).toBeInTheDocument();
	});

	it("shows an error message when the request failed", () => {
		render(<HelloStatus greeting={undefined} isLoading={false} isError />);

		expect(
			screen.getByText("API says: Could not reach the API"),
		).toBeInTheDocument();
	});

	it("shows the greeting once it has loaded", () => {
		render(
			<HelloStatus greeting="Hello World!" isLoading={false} isError={false} />,
		);

		expect(screen.getByText("API says: Hello World!")).toBeInTheDocument();
	});
});
