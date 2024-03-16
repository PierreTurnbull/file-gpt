import { env } from "$env/dynamic/private"
import { fail, type Actions } from "@sveltejs/kit"
import OpenAI from "openai"
import type { MessageContentText } from "openai/resources/beta/threads/messages/messages.mjs"

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })

const createFile = async (file: File) => {
	console.info("Creating file.")
	const storedFile = await openai.files.create({
		file: file,
		purpose: "assistants",
	})
	console.info(`Created file ${storedFile.id}.`)

	return storedFile
}

const createAssistant = async (file: OpenAI.Files.FileObject) => {
	console.info(`Creating assistant using file ${file.id}.`)
	const assistant = await openai.beta.assistants.create({
		name: "File summarizer",
		// instructions: "Ton but est de réécrire le document fourni, mais en plus concis, tout en conservant les informations importantes.",
		model: "gpt-3.5-turbo-0125",
		tools: [{"type": "retrieval"}],
		file_ids: [file.id]
	})
	console.info(`Created assistant ${assistant.id}.`)

	return assistant
}

const createThread = async (file: OpenAI.Files.FileObject, prompt: string) => {
	console.info(`Creating thread using file ${file.id}.`)
	const thread = await openai.beta.threads.create({
		messages: [
			{
				"role": "user",
				"content": prompt,
				"file_ids": [file.id]
			}
		]
	})
	console.info(`Created thread ${thread.id}.`)

	return thread
}

const createRun = async (assistantId: string, threadId: string) => {
	console.info(`Creating run for assitant ${assistantId}, thread ${threadId}.`)
	const run = await openai.beta.threads.runs.create(
		threadId,
		{ assistant_id: assistantId }
	)
	console.info(`Created run ${run.id}.`)

	return run
}

const awaitMessages = async (threadId: string, runId: string) => {
	console.info(`Awaiting messages for thread ${threadId}, run ${runId}.`)
	let i = 0
	while (i < 20) {
		i++

		if (i > 20) {
			console.info(`Timeout while awaiting messages for thread ${threadId}, run ${runId}.`)
			break
		}

		const currentRun = await fetchRun(threadId, runId)

		if (currentRun.status === "completed") break

		await new Promise<void>(r => setTimeout(r, 1000))
	}
	const messages = await fetchMessages(threadId)

	return messages.data
}

const fetchRun = async (threadId: string, runId: string) => {
	const run = await openai.beta.threads.runs.retrieve(threadId, runId)

	return run
}

const fetchMessages = async (threadId: string) => {
	console.info(`Fetching messages for thread ${threadId}.`)
	const messages = await openai.beta.threads.messages.list(threadId)
	console.info(`Fetched ${messages.data.length} messages.`)

	return messages
}

// list is not available yet (as of 2024/03/16) for threads so we can only delete the thread we created instead of cleaning all threads.
const deleteThread = async (threadId: string) => {
	console.info(`Deleting thread ${threadId}.`)
	await openai.beta.threads.del(threadId)
	console.info(`Deleted thread ${threadId}.`)
}

const cleanAssistant = async () => {
	console.info("Cleaning assistants.")
	const assistants = await openai.beta.assistants.list()
	for (let i = 0; i < assistants.data.length; i++) {
		const file = assistants.data[i]

		await openai.beta.assistants.del(file.id)
	}
	console.info(`Deleted ${assistants.data.length} assistant.`)
}

const cleanFiles = async () => {
	console.info("Cleaning files.")
	const files = await openai.files.list()
	for (let i = 0; i < files.data.length; i++) {
		const file = files.data[i]

		await openai.files.del(file.id)
	}
	console.info(`Deleted ${files.data.length} files.`)
}

const getFileIsValid = (value: unknown): value is File => {
	return (
		Boolean((value as File).name) &&
		(value as File).name !== "undefined"
	)
}

export const actions = {
	default: async ({ request }) => {
		const formData = Object.fromEntries(await request.formData())
		const file: unknown = formData.file
		const prompt: string = String(formData.prompt)

		const fileIsValid = getFileIsValid(file)
		const promptIsValid = typeof prompt === "string" && prompt.length >= 0 && prompt.length < 200

		if (!fileIsValid || !promptIsValid) {
			return fail(400, { error: true })
		}

		const storedFile = await createFile(file)
		const assistant = await createAssistant(storedFile)
		const thread = await createThread(storedFile, prompt)
		const run = await createRun(assistant.id, thread.id)
		const messages = await awaitMessages(thread.id, run.id)
		const answer = (messages[0].content[0] as MessageContentText).text.value
		await deleteThread(thread.id)
		await cleanAssistant()
		await cleanFiles()

		return {
			data: answer
		}
	},
} satisfies Actions