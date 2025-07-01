import { App, Modal } from "obsidian";
import type { Interaction } from "@/types";

export class InteractionModal extends Modal {
	private interaction: Interaction | null;
	private onSubmit: (date: string, text: string) => void;

	constructor(
		app: App,
		interaction: Interaction | null,
		onSubmit: (date: string, text: string) => void
	) {
		super(app);
		this.interaction = interaction;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

                const plugin = (this.app as any).plugins.getPlugin("collaborator-tracker");
                contentEl.createEl("h2", {
                        text: this.interaction
                                ? plugin?.t("edit_interaction") || "Edit interaction"
                                : plugin?.t("add_interaction") || "Add interaction",
                });

		const form = contentEl.createEl("form");
		form.addEventListener("submit", (e) => {
			e.preventDefault();
			const dateInput = form.querySelector(
				"[type=date]"
			) as HTMLInputElement;
			const textInput = form.querySelector(
				"textarea"
			) as HTMLTextAreaElement;

			if (dateInput?.value && textInput?.value) {
				this.onSubmit(dateInput.value, textInput.value);
				this.close();
			}
		});

		// Date input
		form.createEl("input", {
			attr: {
				type: "date",
				value:
					this.interaction?.date ||
					new Date().toISOString().split("T")[0],
				required: "true",
			},
			cls: "contact-interaction-date-input",
		});

		// Text input
                const textInput = form.createEl("textarea", {
                        attr: {
                                placeholder: plugin?.t("what_happened") || "What happened?",
                                required: "true",
                        },
			cls: "contact-interaction-text-input",
		});
		textInput.value = this.interaction?.text || "";

		// Submit button
                form.createEl("button", {
                        text:
                                this.interaction
                                        ? plugin?.t("save_changes") || "Save changes"
                                        : plugin?.t("add_interaction") || "Add interaction",
                        attr: { type: "submit" },
                        cls: "collaborator-tracker-button button-primary",
                });
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
