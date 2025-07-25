import { App, Modal, TFile } from "obsidian";

export class DeleteContactModal extends Modal {
	constructor(
		app: App,
		private file: TFile,
		private onDelete: () => Promise<void>
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
                const plugin = (this.app as any).plugins.getPlugin("collaborator-tracker");
                contentEl.createEl("h2", { text: plugin?.t("delete_contact") || "Delete contact" });
                contentEl.createEl("p", {
                        text: plugin?.t("delete_confirm")?.replace("{name}", this.file.basename) || `Are you sure you want to delete ${this.file.basename}?`,
                });

		const buttonContainer = contentEl.createEl("div", {
			cls: "collaborator-tracker-modal-buttons",
		});

		// Cancel button
                const cancelButton = buttonContainer.createEl("button", {
                        text: plugin?.t("cancel") || "Cancel",
                        cls: "collaborator-tracker-modal-button",
                });
		cancelButton.addEventListener("click", () => this.close());

		// Delete button
                const deleteButton = buttonContainer.createEl("button", {
                        text: plugin?.t("delete") || "Delete",
                        cls: "collaborator-tracker-modal-button collaborator-tracker-modal-button-danger",
                });
		deleteButton.addEventListener("click", async () => {
			await this.onDelete();
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
