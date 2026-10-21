import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ChatDto, ThreadIdPipe, toChatRequest } from "./agents.dto.js";

async function errors(body: object): Promise<string[]> {
	const found = await validate(plainToInstance(ChatDto, body));
	return found.map((error) => error.property);
}

describe("ChatDto", () => {
	it("accepts a message, with or without a thread to continue", async () => {
		expect(await errors({ message: "Oi" })).toEqual([]);
		expect(await errors({ message: "Oi", threadId: "abc_123-x" })).toEqual([]);
	});

	it.each([
		[{ message: "" }, "message"],
		[{ message: "Oi", threadId: "org-1:eve:assistant:t1" }, "threadId"],
		[{ message: "Oi", threadId: "x".repeat(65) }, "threadId"],
	])("rejects %j", async (body, property) => {
		expect(await errors(body)).toEqual([property]);
	});

	it("becomes the agents service's request", () => {
		expect(toChatRequest({ message: "Oi" })).toEqual({
			message: "Oi",
			thread_id: null,
		});
		expect(toChatRequest({ message: "Oi", threadId: "t1" })).toEqual({
			message: "Oi",
			thread_id: "t1",
		});
	});
});

describe("ThreadIdPipe", () => {
	it("passes a valid id and rejects anything else with a 400", () => {
		const pipe = new ThreadIdPipe();

		expect(pipe.transform("t1")).toBe("t1");
		expect(() => pipe.transform("../jobs")).toThrow(BadRequestException);
	});
});
