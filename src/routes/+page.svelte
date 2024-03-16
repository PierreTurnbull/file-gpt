<script lang="ts">
    import { enhance } from "$app/forms"
    import type { SubmitFunction } from "@sveltejs/kit"
    import { onMount } from "svelte"

	let files: FileList | null
	let prompt: string = ""
	let answer: string = ""
	let isLoadingAnswer: boolean = false

	const handleSubmit = () => {
		files = null
		answer = ""
		isLoadingAnswer = true
	}

	const enhanceHandler: SubmitFunction<Record<string, string>, undefined> = () => {
		return async (response) => {
			console.log(response)
			if (response.result.type === "success") {
				if (response.result.data) {
					answer = response.result.data.data
				}
			}
			isLoadingAnswer = false
		}
	}

	const onPromptInput = (event: Event) => {
		localStorage.prompt = (event.target as HTMLTextAreaElement)?.value
	}

	onMount(() => {
		prompt = localStorage.prompt || "Résume moi le contenu de ce fichier en moins de 20 mots."
	})
</script>

<form
	method="post"
	use:enhance={(enhanceHandler)}
	enctype="multipart/form-data"
	on:submit|preventDefault={handleSubmit}
>
	<label for="file">Upload multiple files of any type:</label>
	<input
		bind:files
		type="file"
		id="file"
		name="file"
		accept=".pdf"
		required
	/>
	<textarea
		bind:value={prompt}
		name="prompt"
		on:input={onPromptInput}
	/>

	<button type="submit" disabled={!files?.length}>Submit</button>
	<div>
		<p>Answer:</p>
		{#if isLoadingAnswer}
		<p>Chargement en cours...</p>
		{/if}
		<p>{answer}</p>
	</div>
</form>

<style>
	textarea {
		width: 300px;
		height: 100px;
	}
</style>