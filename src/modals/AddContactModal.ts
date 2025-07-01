import { App, Modal, Notice } from "obsidian";
import type CollaboratorTracker from "@/main";
import { stringifyYaml } from "obsidian";
import { VIEW_TYPE_COLLABORATOR_TRACKER } from "@/views/CollaboratorTrackerView";
import { CollaboratorTrackerView } from "@/views/CollaboratorTrackerView";
import { createRelationshipInput } from "@/components/ContactFields";

export class AddContactModal extends Modal {
	constructor(app: App, private plugin: CollaboratorTracker) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
                contentEl.createEl("h2", { text: this.plugin.t("add_new_contact") });

		const form = contentEl.createEl("form", {
			cls: "collaborator-tracker-add-contact-form",
		});

		// Name field (required)
		const nameField = form.createDiv({ cls: "collaborator-tracker-modal-field" });
                nameField.createEl("label", { text: this.plugin.t("name_required") });
                const nameInput = nameField.createEl("input", {
                        attr: {
                                type: "text",
                                name: "name",
                                required: true,
                                placeholder: this.plugin.t("contact_name_placeholder"),
                        },
			cls: "collaborator-tracker-modal-input",
		});
		nameInput.focus();

		// Birthday field
		const birthdayField = form.createDiv({
			cls: "collaborator-tracker-modal-field",
		});
                birthdayField.createEl("label", { text: this.plugin.t("birthday") });
		const birthdayInput = birthdayField.createEl("input", {
			attr: {
				type: "date",
				name: "birthday",
                                placeholder: this.plugin.t("birthday_placeholder"),
				pattern: "\\d{4}-\\d{2}-\\d{2}",
			},
			cls: "collaborator-tracker-modal-input",
		});

		// Email field
		const emailField = form.createDiv({
			cls: "collaborator-tracker-modal-field",
		});
                emailField.createEl("label", { text: this.plugin.t("email") });
		const emailInput = emailField.createEl("input", {
			attr: {
				type: "email",
				name: "email",
                                placeholder: this.plugin.t("email_placeholder"),
			},
			cls: "collaborator-tracker-modal-input",
		});

		// Phone field
		const phoneField = form.createDiv({
			cls: "collaborator-tracker-modal-field",
		});
                phoneField.createEl("label", { text: this.plugin.t("phone") });
		const phoneInput = phoneField.createEl("input", {
			attr: {
				type: "tel",
				name: "phone",
                                placeholder: this.plugin.t("phone_placeholder"),
			},
			cls: "collaborator-tracker-modal-input",
		});

		// Relationship field
		const relationshipField = form.createDiv({
			cls: "collaborator-tracker-modal-field",
		});
                relationshipField.createEl("label", { text: this.plugin.t("relationship") });
		const relationshipInput = createRelationshipInput(
			relationshipField,
			this.plugin
		);

		// Submit button
                form.createEl("button", {
                        text: this.plugin.t("create_contact"),
                        attr: { type: "submit" },
                        cls: "collaborator-tracker-button button-primary",
                });

		form.addEventListener("submit", (e) => {
			e.preventDefault();
			const data: Record<string, string> = {
				name: nameInput.value,
			};

			if (birthdayInput.value) data.birthday = birthdayInput.value;
			if (emailInput.value) data.email = emailInput.value;
			if (phoneInput.value) data.phone = phoneInput.value;
			if (relationshipInput.value) {
				const relationship = relationshipInput.value.toLowerCase();
				data.relationship = relationshipInput.value.toLowerCase();
				// Add new relationship type to settings if it doesn't exist
				if (
					!this.plugin.settings.relationshipTypes.includes(
						relationship
					)
				) {
					// Remove any duplicates (case-insensitive) before adding
					this.plugin.settings.relationshipTypes = [
						...new Set(
							this.plugin.settings.relationshipTypes.filter(
								(type) => type.toLowerCase() !== relationship
							)
						),
						relationship,
					];
					this.plugin.saveSettings();
				}
			}

			if (data.name) {
				this.onSubmit(data);
				this.close();
			}
		});
	}

	private async onSubmit(data: Record<string, string>) {
		const fileName = `${data.name}.md`;
		const filePath = `${this.plugin.settings.contactsFolder}/${fileName}`;

		// Ensure folder exists before creating contact
		const folder = this.plugin.settings.contactsFolder;
		if (!this.app.vault.getFolderByPath(folder)) {
			await this.app.vault.createFolder(folder);
		}

		// Create YAML frontmatter
		const yaml = stringifyYaml(data);
		const fileContent = `---\n${yaml}\n---\n`;

		try {
			await this.app.vault.create(filePath, fileContent);

			// Wait a moment for the file to be indexed
			await new Promise((resolve) => setTimeout(resolve, 300));

                       // Refresh the Collaborator Tracker view
			const collaboratorTrackerLeaves = this.app.workspace.getLeavesOfType(
				VIEW_TYPE_COLLABORATOR_TRACKER
			);

			for (const leaf of collaboratorTrackerLeaves) {
				const view = leaf.view;
				if (view instanceof CollaboratorTrackerView) {
					await view.refresh();
					break;
				}
			}

                        new Notice(this.plugin.t("created_contact") + ": " + data.name);
                } catch (error) {
                        new Notice(this.plugin.t("error_creating_contact") + ": " + error);
                }
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
