import {
	ItemView,
	WorkspaceLeaf,
	Notice,
	TFile,
	setIcon,
	parseYaml,
	MarkdownRenderer,
} from "obsidian";
import type FriendTracker from "@/main";
import { ContactFields } from "@/components/ContactFields";
import { InteractionView } from "@/components/InteractionView";
import type { Interaction } from "@/types";
import { AddFieldModal } from "@/modals/AddFieldModal";
import { InteractionModal } from "@/modals/InteractionModal";
import { VIEW_TYPE_FRIEND_TRACKER } from "@/views/FriendTrackerView";
import { FriendTrackerView } from "@/views/FriendTrackerView";
import { STANDARD_FIELDS, SYSTEM_FIELDS } from "@/constants";

export const VIEW_TYPE_CONTACT_PAGE = "contact-page-view";

export class ContactPageView extends ItemView {
	private _file: TFile | null = null;
	private contactData: any = {};
	private contactFields: ContactFields;
	private interactionView: InteractionView;
	public plugin: FriendTracker;
	private activeTab: "notes" | "interactions" | "markdown";

	public getRelationshipTypes(): string[] {
		return this.plugin.settings.relationshipTypes;
	}

	public async addRelationshipType(
		type: string,
		existingTypes?: string[]
	): Promise<void> {
		this.plugin.settings.relationshipTypes = [
			...(existingTypes || this.plugin.settings.relationshipTypes),
			type,
		];
		await this.plugin.saveSettings();
	}

	constructor(leaf: WorkspaceLeaf, private _plugin: FriendTracker) {
		super(leaf);
		this.plugin = _plugin;
		this.contactFields = new ContactFields(this);
		this.interactionView = new InteractionView(this);
		this.activeTab = this.plugin.settings.defaultActiveTab;
	}

	getViewType(): string {
		return VIEW_TYPE_CONTACT_PAGE;
	}

	getDisplayText(): string {
		return this._file?.basename || "Contact";
	}

	get file() {
		return this._file;
	}

	async setState(state: any, result: any) {
		const file = this.app.vault.getFileByPath(state.filePath);
		if (file) {
			await this.setFile(file);
		}
		await super.setState(state, result);
	}

	getState() {
		return {
			type: VIEW_TYPE_CONTACT_PAGE,
			filePath: this._file?.path,
		};
	}

	async setFile(file: TFile) {
		this._file = file;
		const currentFilePath = file.path;
		try {
			const content = await this.app.vault.read(file);
			// Only update if this._file is still the same file
			if (this._file?.path !== currentFilePath) return;
			const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
			this.contactData = yamlMatch ? parseYaml(yamlMatch[1]) : {};
		} catch (error) {
			console.error(`Error reading contact file ${file.path}:`, error);
			this.contactData = {};
		}
		// Only render if still the same file
		if (this._file?.path === currentFilePath) {
			this.render();
		}
	}

	render() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();

                if (!this.contactData || !this.contactData.name) {
                        container.createEl("div", {
                                text: this.plugin.t("no_contact_data"),
                                cls: "contact-empty-state",
                        });
                        return;
                }

		// Header with name
		const header = container.createEl("div", {
			cls: "contact-page-header",
		});
		const nameContainer = header.createEl("div", {
			cls: "contact-name-container",
		});
		this.renderNameSection(nameContainer);

		// Info section (always visible)
		const infoSection = container.createEl("div", {
			cls: "contact-info-section",
		});
		this.renderInfoSection(infoSection);

		// Tabs container
		const tabsContainer = container.createEl("div", {
			cls: "contact-tabs",
		});

                const tabs = [
                        { id: "notes" as const, icon: "pencil", label: this.plugin.t("notes") },
                        {
                                id: "interactions" as const,
                                icon: "clock",
                                label: this.plugin.t("interactions"),
                        },
                        {
                                id: "markdown" as const,
                                icon: "document",
                                label: this.plugin.t("markdown"),
                        },
                ];

		tabs.forEach((tab) => {
			const tabButton = tabsContainer.createEl("button", {
				cls: `contact-tab ${this.activeTab === tab.id ? "active" : ""}`,
			});

			setIcon(tabButton, tab.icon);
			tabButton.createSpan({ text: tab.label });

			tabButton.addEventListener("click", async () => {
				this.activeTab = tab.id;
				this.plugin.settings.defaultActiveTab = tab.id;
				await this.plugin.saveSettings();
				this.render();
			});
		});

		// Content container for tab content
		const contentContainer = container.createEl("div", {
			cls: "contact-content",
		});

		// Render content based on active tab
		switch (this.activeTab) {
			case "notes":
				this.renderNotesSection(contentContainer);
				break;
			case "interactions":
				this.renderInteractionsSection(contentContainer);
				break;
			case "markdown":
				this.renderExtrasSection(contentContainer);
				break;
		}
	}

	private renderNameSection(container: HTMLElement) {
		const nameSection = container.createEl("div", {
			cls: "contact-name-section",
		});

		const nameDisplay = nameSection.createEl("div", {
			cls: "contact-name-display",
		});

		const editContainer = nameDisplay.createEl("div", {
			cls: "contact-name-row",
		});

                const nameText = editContainer.createEl("h1", {
                        text: this.contactData.name || this.plugin.t("unnamed_contact"),
                });

		const nameInput = editContainer.createEl("input", {
			type: "text",
			value: this.contactData.name || "",
                        placeholder: this.plugin.t("contact_name_placeholder"),
			cls: "contact-name-input",
		});

		const editButton = editContainer.createEl("button", {
			cls: "friend-tracker-button button-icon contact-name-edit",
		});
		setIcon(editButton, "pencil");

		// Add age display if birthday exists
		if (this.contactData.birthday) {
			const ageText = this.plugin.contactOperations.calculateDetailedAge(
				this.contactData.birthday
			);
			nameDisplay.createEl("span", {
				text: ageText,
				cls: "contact-age-display",
			});

			// Add both zodiac displays
			const [year, month, day] = this.contactData.birthday
				.split("-")
				.map(Number);
			const animals = [
				"Rat",
				"Ox",
				"Tiger",
				"Rabbit",
				"Dragon",
				"Snake",
				"Horse",
				"Goat",
				"Monkey",
				"Rooster",
				"Dog",
				"Pig",
			];
			const chineseZodiac = animals[(year - 4) % 12];
			const westernZodiac = this.getZodiacSign(month, day);

			const season = this.getSeason(month, day);
			const birthstone = this.getBirthstone(month);

			nameDisplay.createEl("span", {
				text: `${westernZodiac} • Year of the ${chineseZodiac}`,
				cls: "contact-age-display",
			});
			nameDisplay.createEl("span", {
				text: `${season} baby • Birthstone: ${birthstone}`,
				cls: "contact-age-display",
			});

			const daysUntil = this.calculateDaysUntilBirthday(
				this.contactData.birthday
			);
			if (daysUntil !== null) {
				const countdownContainer = nameDisplay.createEl("div", {
					cls: "contact-birthday-countdown",
				});

				if (daysUntil === 0) {
					// Birthday today - show cake
					countdownContainer.createEl("div", {
						cls: "table-birthday-indicator birthday-today",
						text: "🎂",
					});
					countdownContainer.createSpan({
						text: "Birthday today!",
					});
				} else {
					// Show dot if within a week
					if (daysUntil <= 7) {
						const dotContainer = countdownContainer.createEl(
							"div",
							{
								cls: "birthday-status-dot",
							}
						);
						dotContainer.createEl("div", {
							cls: "birthday-status-dot-inner",
						});
					}

					const daysText =
						daysUntil === 1
							? "Birthday tomorrow!"
							: `${daysUntil} days until birthday`;

					countdownContainer.createSpan({
						text: daysText,
					});
				}
			}
		}

		editButton.addEventListener("click", () => {
			if (!nameInput.classList.contains("editing")) {
				nameText.classList.add("editing");
				nameInput.classList.add("editing");
				setIcon(editButton, "checkmark");
				nameInput.focus();
			} else {
				saveNameChange();
			}
		});

		const saveNameChange = async () => {
			if (!this._file) return;
			const newName = nameInput.value.trim();
			if (newName) {
				this.contactData.name = nameInput.value;
				await this.saveContactData();

				// Rename the file
				if (this._file.parent) {
					const newPath = `${this._file.parent.path}/${newName}.md`;
					try {
						await this.app.fileManager.renameFile(
							this._file,
							newPath
						);
                                                new Notice(this.plugin.t("updated_contact_name"));

                                                // Refresh Colaborador Tracker view
						const friendTrackerLeaves =
							this.app.workspace.getLeavesOfType(
								VIEW_TYPE_FRIEND_TRACKER
							);
						for (const leaf of friendTrackerLeaves) {
							const view = await leaf.view;
							if (view instanceof FriendTrackerView) {
								await view.refresh();
								break;
							}
						}
                                        } catch (error) {
                                                new Notice(this.plugin.t("error_updating_filename") + ": " + error);
                                        }
				}
			}
                        nameText.textContent = nameInput.value || this.plugin.t("unnamed_contact");
			nameText.classList.remove("editing");
			nameInput.classList.remove("editing");
			setIcon(editButton, "pencil");
		};

		nameInput.addEventListener("change", saveNameChange);
	}

	private calculateDetailedAge(birthday: string): string {
		const birthDate = new Date(birthday + "T00:00:00Z");
		const today = new Date();

		// Reset times to midnight UTC to ensure consistent date comparison
		const todayUTC = new Date(
			Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
		);

		let years = todayUTC.getUTCFullYear() - birthDate.getUTCFullYear();
		let months = todayUTC.getUTCMonth() - birthDate.getUTCMonth();
		let days = todayUTC.getUTCDate() - birthDate.getUTCDate();

		// Adjust for negative days
		if (days < 0) {
			months--;
			// Get last day of previous month
			const lastMonth = new Date(
				Date.UTC(todayUTC.getFullYear(), todayUTC.getMonth(), 0)
			);
			days += lastMonth.getUTCDate();
		}

		// Adjust for negative months
		if (months < 0) {
			years--;
			months += 12;
		}

		// Format the output
		if (days === 0) {
			return `${years} years, ${months} months old`;
		}
		return `${years} years, ${months} months, ${days} days old`;
	}

	private calculateDaysUntilBirthday(birthday: string): number | null {
		return this.plugin.contactOperations.calculateDaysUntilBirthday(
			birthday
		);
	}

	private getZodiacSign(month: number, day: number): string {
		if ((month === 3 && day >= 21) || (month === 4 && day <= 19))
			return "Aries";
		if ((month === 4 && day >= 20) || (month === 5 && day <= 20))
			return "Taurus";
		if ((month === 5 && day >= 21) || (month === 6 && day <= 20))
			return "Gemini";
		if ((month === 6 && day >= 21) || (month === 7 && day <= 22))
			return "Cancer";
		if ((month === 7 && day >= 23) || (month === 8 && day <= 22))
			return "Leo";
		if ((month === 8 && day >= 23) || (month === 9 && day <= 22))
			return "Virgo";
		if ((month === 9 && day >= 23) || (month === 10 && day <= 22))
			return "Libra";
		if ((month === 10 && day >= 23) || (month === 11 && day <= 21))
			return "Scorpio";
		if ((month === 11 && day >= 22) || (month === 12 && day <= 21))
			return "Sagittarius";
		if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
			return "Capricorn";
		if ((month === 1 && day >= 20) || (month === 2 && day <= 18))
			return "Aquarius";
		return "Pisces";
	}

	private getSeason(month: number, day: number): string {
		// Northern hemisphere seasons
		if (
			(month === 3 && day >= 20) ||
			month === 4 ||
			month === 5 ||
			(month === 6 && day < 21)
		)
			return "Spring";
		if (
			(month === 6 && day >= 21) ||
			month === 7 ||
			month === 8 ||
			(month === 9 && day < 22)
		)
			return "Summer";
		if (
			(month === 9 && day >= 22) ||
			month === 10 ||
			month === 11 ||
			(month === 12 && day < 21)
		)
			return "Autumn";
		return "Winter";
	}

	private getBirthstone(month: number): string {
		const stones: Record<number, string> = {
			1: "Garnet",
			2: "Amethyst",
			3: "Aquamarine",
			4: "Diamond",
			5: "Emerald",
			6: "Pearl",
			7: "Ruby",
			8: "Peridot",
			9: "Sapphire",
			10: "Opal",
			11: "Topaz",
			12: "Turquoise",
		};
		return stones[month] || "Unknown";
	}

	private renderInfoSection(container: HTMLElement) {
		const infoSection = container.createEl("div", {
			cls: "contact-info-section",
		});

		const fieldsContainer = infoSection.createEl("div", {
			cls: "contact-fields-container",
		});

		const renderViewMode = () => {
			fieldsContainer.empty();
			fieldsContainer.classList.remove("editing");

			// Render each field as read-only text
			Object.entries(this.contactData)
				.filter(
					([key]) =>
						![
							"name",
							"notes",
							"interactions",
							"created",
							"updated",
						].includes(key)
				)
				.forEach(([key, value]) => {
					if (!value) return; // Skip empty values

					const field = fieldsContainer.createEl("div", {
						cls: "contact-field-view",
						attr: {
							"data-field": key.toLowerCase(),
						},
					});

					field.createEl("div", {
						cls: "contact-field-label",
						text: key,
					});

					// Format birthday in view mode
					const displayValue =
						key === "birthday" && value
							? (() => {
									const [year, month, day] = (value as string)
										.split("-")
										.map(Number);
									const date = new Date(year, month - 1, day);
									date.setHours(0, 0, 0, 0);
									return date.toLocaleDateString("en-US", {
										month: "long",
										day: "numeric",
										year: "numeric",
									});
							  })()
							: value;

					field.createEl("div", {
						cls: "contact-field-value",
						text: displayValue as string,
					});
				});

			// Add edit button at the bottom
                        const editButton = fieldsContainer.createEl("button", {
                                cls: "friend-tracker-button",
                                text: this.plugin.t("edit"),
                        });

			editButton.addEventListener("click", () => {
				renderEditMode();
			});
		};

		const renderEditMode = () => {
			fieldsContainer.empty();
			fieldsContainer.classList.add("editing");

			// Standard fields first
			Object.values(STANDARD_FIELDS)
				.filter((field) => !SYSTEM_FIELDS.includes(field))
				.forEach((field) => {
					this.createInfoField(
						fieldsContainer,
						field,
						this.contactData[field]
					);
				});

			// Then custom fields
			const excludedFields = [
				...SYSTEM_FIELDS,
				...Object.values(STANDARD_FIELDS).map((f) => f.toLowerCase()),
				"created",
				"updated",
			];
			Object.entries(this.contactData)
				.filter(([key]) => !excludedFields.includes(key.toLowerCase()))
				.forEach(([key, value]) => {
					this.createInfoField(fieldsContainer, key, value as string);
				});

			// Add custom field button
                        const addFieldButton = fieldsContainer.createEl("button", {
                                cls: "friend-tracker-button button-outlined",
                                text: this.plugin.t("add_custom_field"),
                        });
			addFieldButton.addEventListener("click", () => {
				this.openAddFieldModal();
			});

			// Add done button
                        const doneButton = fieldsContainer.createEl("button", {
                                cls: "friend-tracker-button button-primary button-full-width",
                                text: this.plugin.t("done"),
                        });

			doneButton.addEventListener("click", async () => {
				await this.saveContactData();
				renderViewMode();
			});
		};

		// Initial render in view mode
		renderViewMode();
	}

	private createInfoField(
		container: HTMLElement,
		field: string,
		value: string
	) {
		const fieldContainer = container.createEl("div", {
			cls: "contact-field",
		});

		fieldContainer.createEl("label", {
			text: field,
		});

		const input = fieldContainer.createEl("input", {
			cls: "contact-field-input",
			attr: {
				type: field === "birthday" ? "date" : "text",
				placeholder: `Enter ${field.toLowerCase()}`,
				value: value || "",
				...(field === "relationship" && {
					list: "relationship-types",
				}),
			},
		});

		input.addEventListener("change", () => {
			this.updateContactData(field, input.value);
		});
	}

	private renderNotesSection(container: HTMLElement) {
		const notesSection = container.createEl("div", {
			cls: "contact-notes-section",
		});

                const notesInput = notesSection.createEl("textarea", {
                        cls: "contact-notes-input",
                        attr: {
                                placeholder: this.plugin.t("notes_placeholder"),
                        },
                });
		notesInput.value = this.contactData.notes || "";

		notesInput.addEventListener("input", () => {
			this.adjustTextareaHeight(notesInput);
		});

		setTimeout(() => {
			this.adjustTextareaHeight(notesInput);
		}, 0);

		notesInput.addEventListener("change", async () => {
			if (!this._file) return;
			this.contactData.notes = notesInput.value;
			await this.saveContactData();
		});
	}

	private renderInteractionsSection(container: HTMLElement) {
		const interactions = container.createEl("div", {
			cls: "contact-interactions",
		});

		const headerContainer = interactions.createEl("div", {
			cls: "contact-interactions-header",
		});

		// Add helper text if no interactions
		if (
			!Array.isArray(this.contactData.interactions) ||
			this.contactData.interactions.length === 0
		) {
                        headerContainer.createEl("div", {
                                cls: "section-helper-text",
                                text: this.plugin.t("log_touchpoints_help"),
                        });
		}

                const addButton = headerContainer.createEl("button", {
                        cls: "friend-tracker-button button-align-right",
                        text: this.plugin.t("add_interaction"),
                });
		addButton.addEventListener("click", () => {
			this.openAddInteractionModal();
		});

		if (Array.isArray(this.contactData.interactions)) {
			this.interactionView.render(
				interactions,
				this.contactData.interactions
			);
		}
	}

	private async renderExtrasSection(container: HTMLElement) {
		const extrasSection = container.createEl("div", {
			cls: "contact-extras-section",
		});

		if (!this._file) return;

		const headerContainer = extrasSection.createEl("div", {
			cls: "contact-extras-header",
		});

		// Add helper text if no markdown content
		const content = await this.app.vault.read(this._file);
		const extrasContent =
			content.split(/^---\n([\s\S]*?)\n---/).pop() || "";

                if (!extrasContent.trim()) {
                        headerContainer.createEl("div", {
                                cls: "section-helper-text",
                                text: this.plugin.t("add_markdown_help"),
                        });
                }

                const editButton = headerContainer.createEl("button", {
                        cls: "friend-tracker-button button-align-right",
                        text: this.plugin.t("edit_markdown"),
                });

		editButton.addEventListener("click", () => {
			this.app.workspace.openLinkText(this._file?.path || "", "", true);
		});

		try {
			const content = await this.app.vault.read(this._file);
			const extrasContent =
				content.split(/^---\n([\s\S]*?)\n---/).pop() || "";

			if (extrasContent.trim()) {
				const contentDiv = extrasSection.createEl("div", {
					cls: "contact-extras-content",
				});

				await MarkdownRenderer.renderMarkdown(
					extrasContent,
					contentDiv,
					this._file.path,
					this
				);

				// Add click handlers for internal links
				contentDiv.addEventListener("click", (event) => {
					const target = event.target as HTMLElement;
					if (target.tagName === "A") {
						const anchor = target as HTMLAnchorElement;
						const href = anchor.getAttribute("href");

						if (href?.startsWith("#")) {
							// Handle internal anchor links
							event.preventDefault();
							const targetEl = contentDiv.querySelector(href);
							targetEl?.scrollIntoView();
						} else if (!href?.startsWith("http")) {
							// Handle internal Obsidian links
							event.preventDefault();
							this.app.workspace.openLinkText(
								href || "",
								this._file?.path || "",
								event.ctrlKey || event.metaKey
							);
						}
					}
				});
			}
		} catch (error) {
			console.error(
				`Error reading extras from file ${this._file.path}:`,
				error
			);
		}
	}

	private adjustTextareaHeight(textarea: HTMLTextAreaElement) {
		textarea.classList.add("measuring");
		textarea.style.setProperty(
			"--scroll-height",
			`${textarea.scrollHeight}px`
		);
		textarea.classList.remove("measuring");
	}

	async saveContactData() {
		if (!this._file) return;

		// Sort interactions by date in descending order (newest first)
		if (this.contactData.interactions) {
			this.contactData.interactions.sort(
				(a: Interaction, b: Interaction) =>
					new Date(b.date).getTime() - new Date(a.date).getTime()
			);
		}

		await this.app.fileManager.processFrontMatter(
			this._file,
			(frontmatter) => {
				Object.assign(frontmatter, this.contactData);
			}
		);
	}

	// Modal methods
        private async openAddFieldModal() {
                const modal = new AddFieldModal(this.app, this.plugin, async (fieldName) => {
			if (!this.contactData[fieldName]) {
				this.contactData[fieldName] = "";
				await this.saveContactData();
				this.render();
			} else {
				new Notice("Field already exists!");
			}
		});
		modal.open();
	}

	private async openAddInteractionModal() {
		const modal = new InteractionModal(
			this.app,
			null,
			async (date: string, text: string) => {
				if (!Array.isArray(this.contactData.interactions)) {
					this.contactData.interactions = [];
				}
				this.contactData.interactions.push({ date, text });
				await this.saveContactData();
				this.render();
			}
		);
		modal.open();
	}

	public async openEditInteractionModal(
		index: number,
		interaction: Interaction
	) {
		const modal = new InteractionModal(
			this.app,
			interaction,
			async (date: string, text: string) => {
				if (!Array.isArray(this.contactData.interactions)) {
					this.contactData.interactions = [];
				}
				this.contactData.interactions[index] = { date, text };
				await this.saveContactData();
				this.render();
			}
		);
		modal.open();
	}

	public async deleteInteraction(index: number) {
		this.contactData.interactions.splice(index, 1);
		await this.saveContactData();
		this.render();
	}

	async updateContactData(field: string, value: string) {
		this.contactData[field] = value;
		await this.saveContactData();
	}
}
