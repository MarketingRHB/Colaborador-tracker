import {
	App,
	PluginSettingTab,
	Setting,
	AbstractInputSuggest,
	TFolder,
	normalizePath,
} from "obsidian";
import type CollaboratorTracker from "@/main";
import type { ContactWithCountdown } from "@/types";
import {
        CollaboratorTrackerView,
        VIEW_TYPE_COLLABORATOR_TRACKER,
} from "./index";
import {
        ContactPageView,
        VIEW_TYPE_CONTACT_PAGE,
} from "@/views/ContactPageView";

class FolderSuggest extends AbstractInputSuggest<string> {
	inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
	}

	getSuggestions(inputStr: string): string[] {
		const folders = this.app.vault
			.getAllLoadedFiles()
			.filter((f) => f instanceof TFolder)
			.map((f) => f.path);
		return folders.filter((f) =>
			f.toLowerCase().includes(inputStr.toLowerCase())
		);
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value);
	}

	selectSuggestion(value: string): void {
		this.inputEl.value = value;
		this.inputEl.trigger("input");
		this.close();
	}
}

export class CollaboratorTrackerSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: CollaboratorTracker) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const sortColumns: Array<{
			value: keyof Omit<ContactWithCountdown, "file">;
			label: string;
		}> = [
			{ value: "name", label: "Name" },
			{ value: "age", label: "Age" },
			{ value: "birthday", label: "Birthday" },
			{ value: "daysUntilBirthday", label: "Days until birthday" },
			{ value: "relationship", label: "Relationship" },
			{ value: "lastInteraction", label: "Last interaction" },
		];

		new Setting(containerEl)
			.setName("Contacts folder")
			.setDesc("Folder where contact files will be stored")
			.addText((text) => {
				new FolderSuggest(this.app, text.inputEl);
				return text
					.setPlaceholder("Enter folder name")
					.setValue(this.plugin.settings.contactsFolder)
					.onChange(async (value) => {
						this.plugin.settings.contactsFolder =
							normalizePath(value);
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Default sort")
			.setDesc("Choose how contacts are sorted by default")
			.addDropdown((dropdown) => {
				sortColumns.forEach(({ value, label }) => {
					dropdown.addOption(value, label);
				});
				return dropdown
					.setValue(this.plugin.settings.defaultSortColumn)
					.onChange(async (value) => {
						this.plugin.settings.defaultSortColumn =
							value as keyof Omit<ContactWithCountdown, "file">;
						await this.plugin.saveSettings();
					});
			})
			.addDropdown((dropdown) => {
				dropdown
					.addOption("asc", "Ascending")
					.addOption("desc", "Descending")
					.setValue(this.plugin.settings.defaultSortDirection)
					.onChange(async (value) => {
						this.plugin.settings.defaultSortDirection = value as
							| "asc"
							| "desc";
						await this.plugin.saveSettings();
					});
			});

		const headerContainer = containerEl.createEl("div", {
			cls: "collaborator-tracker-relationship-header",
		});

		headerContainer.createEl("h3", { text: "Relationship types" });

		new Setting(headerContainer).addButton((button) =>
			button.setButtonText("Add relationship type").onClick(async () => {
				// Create a temporary input field
				const tempInput = document.createElement("input");
				tempInput.type = "text";
				tempInput.placeholder = "Enter relationship type";
				tempInput.className =
					"collaborator-tracker-modal-input relationship-type-input";

				// Replace button with input temporarily
				button.buttonEl.replaceWith(tempInput);
				tempInput.focus();

				const handleAdd = async () => {
					const fullValue = tempInput.value || "";
					const value = fullValue.trim();

					if (value) {
						const newType = value.toLowerCase();
						if (
							!this.plugin.settings.relationshipTypes.includes(
								newType
							)
						) {
							this.plugin.settings.relationshipTypes.push(
								newType
							);
							await this.plugin.saveSettings();
						}
					}
					// Schedule the display update after the current event
					setTimeout(() => this.display(), 0);
				};

				tempInput.addEventListener("keydown", async (e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						await handleAdd();
					} else if (e.key === "Escape") {
						this.display();
					}
				});

				// Only handle blur if there's a value
				tempInput.addEventListener("blur", async () => {
					if (tempInput.value?.trim()) {
						await handleAdd();
					} else {
						this.display();
					}
				});
			})
		);

		const relationshipContainer = containerEl.createEl("div", {
			cls: "collaborator-tracker-relationship-types",
		});

		this.plugin.settings.relationshipTypes.forEach((type) => {
			new Setting(relationshipContainer)
				.addText((text) =>
					text
						.setValue(type)
						.setPlaceholder("Type name")
						.then((textComponent) => {
							// Save on Enter
							textComponent.inputEl.addEventListener(
								"keypress",
								async (e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										textComponent.inputEl.blur();
									}
								}
							);

							// Save on blur
							textComponent.inputEl.addEventListener(
								"blur",
								async () => {
									const value = textComponent.inputEl.value;
									const index =
										this.plugin.settings.relationshipTypes.indexOf(
											type
										);
									if (
										value.toLowerCase() !== type ||
										value !== value.toLowerCase()
									) {
										const newType = value.toLowerCase();
										this.plugin.settings.relationshipTypes =
											[
												...this.plugin.settings.relationshipTypes.filter(
													(t, i) =>
														i === index ||
														t.toLowerCase() !==
															newType
												),
											];
										this.plugin.settings.relationshipTypes[
											index
										] = newType;
										await this.plugin.saveSettings();
										// Schedule the display update after the current event
										setTimeout(() => this.display(), 0);
									}
								}
							);
						})
				)
				.addExtraButton((button) => {
					button
						.setIcon("trash")
						.setTooltip("Delete relationship type")
						.onClick(async () => {
							const index =
								this.plugin.settings.relationshipTypes.indexOf(
									type
								);
							this.plugin.settings.relationshipTypes.splice(
								index,
								1
							);
							await this.plugin.saveSettings();
							this.display();
						});
				});
		});

                new Setting(containerEl)
                        .setName("Default tab")
                        .setDesc("Choose which tab opens by default")
                        .addDropdown((dropdown) => {
                                dropdown
                                        .addOption("notes", "Notes")
                                        .addOption("interactions", "Interactions")
                                        .addOption("markdown", "Markdown")
                                        .setValue(this.plugin.settings.defaultActiveTab)
                                        .onChange(
                                                async (
                                                        value: "notes" | "interactions" | "markdown"
                                                ) => {
                                                        this.plugin.settings.defaultActiveTab = value;
                                                        await this.plugin.saveSettings();
                                                }
                                        );
                        });

                new Setting(containerEl)
                        .setName("Language")
                        .setDesc("Select plugin language")
                        .addDropdown((dropdown) => {
                                dropdown
                                        .addOption("en", "English")
                                        .addOption("pt", "Português")
                                        .addOption("zh", "中文")
                                        .addOption("ja", "日本語")
                                        .setValue(this.plugin.settings.language)
                                        .onChange(async (value) => {
                                                this.plugin.settings.language = value;
                                                await this.plugin.saveSettings();
                                                await this.plugin.loadTranslations();

                                                // Refresh all open plugin views to apply new translations
                                                const trackerLeaves = this.app.workspace.getLeavesOfType(
                                                        VIEW_TYPE_COLLABORATOR_TRACKER
                                                );
                                                for (const leaf of trackerLeaves) {
                                                        const view = await leaf.view;
                                                        if (view instanceof CollaboratorTrackerView) {
                                                                await view.refresh();
                                                        }
                                                }

                                                const contactLeaves = this.app.workspace.getLeavesOfType(
                                                        VIEW_TYPE_CONTACT_PAGE
                                                );
                                                for (const leaf of contactLeaves) {
                                                        const view = await leaf.view;
                                                        if (view instanceof ContactPageView) {
                                                                view.render();
                                                        }
                                                }

                                                this.display();
                                        });
                        });
	}
}
