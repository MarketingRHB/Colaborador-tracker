import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	Notice,
	TFile,
	TFolder,
	ItemView,
	WorkspaceLeaf,
	parseYaml,
	Modal,
	setIcon,
} from "obsidian";
import { addIcon } from "obsidian";
import { pencil, trash2 } from "lucide";

const VIEW_TYPE_FRIEND_TRACKER = "friend-tracker-view";
const VIEW_TYPE_CONTACT_PAGE = "contact-page-view";

interface FriendTrackerSettings {
	defaultFolder: string;
}

const DEFAULT_SETTINGS: FriendTrackerSettings = {
	defaultFolder: "FriendTracker",
};

interface Contact {
	name: string;
	birthday: string;
	relationship: string;
	age: number | null;
	file: TFile;
}

interface SortConfig {
	column: keyof Omit<Contact, "file">;
	direction: "asc" | "desc";
}

interface ContactWithCountdown extends Contact {
	formattedBirthday: string;
	daysUntilBirthday: number | null;
}

export default class FriendTracker extends Plugin {
	settings: FriendTrackerSettings;

	async onload() {
		await this.loadSettings();

		// Register the custom view
		this.registerView(
			VIEW_TYPE_FRIEND_TRACKER,
			(leaf) => new FriendTrackerView(leaf, this)
		);

		// Register the contact page view
		this.registerView(
			VIEW_TYPE_CONTACT_PAGE,
			(leaf) => new ContactPageView(leaf, this)
		);

		// Add ribbon icon to open the Friend Tracker view
		this.addRibbonIcon("user", "Open Friend Tracker", () => {
			this.activateView();
		});

		// Add settings tab
		this.addSettingTab(new FriendTrackerSettingTab(this.app, this));

		// Ensure the folder exists
		await this.ensureFolderExists();
	}

	async ensureFolderExists() {
		const folder = this.settings.defaultFolder;
		const vault = this.app.vault;

		if (!vault.getAbstractFileByPath(folder)) {
			await vault.createFolder(folder);
		}
	}

	async activateView() {
		const leaves = this.app.workspace.getLeavesOfType(
			VIEW_TYPE_FRIEND_TRACKER
		);
		if (leaves.length) {
			this.app.workspace.revealLeaf(leaves[0]);
		} else {
			await this.app.workspace.getRightLeaf(false).setViewState({
				type: VIEW_TYPE_FRIEND_TRACKER,
				active: true,
			});
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class FriendTrackerSettingTab extends PluginSettingTab {
	plugin: FriendTracker;

	constructor(app: App, plugin: FriendTracker) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Default Folder")
			.setDesc("Folder to store contact files")
			.addText((text) =>
				text
					.setPlaceholder("Enter folder name")
					.setValue(this.plugin.settings.defaultFolder)
					.onChange(async (value) => {
						this.plugin.settings.defaultFolder = value.trim();
						await this.plugin.saveSettings();
					})
			);
	}
}

class FriendTrackerView extends ItemView {
	plugin: FriendTracker;
	private fileChangeHandler: EventRef | null = null;
	private currentSort: SortConfig = {
		column: "age",
		direction: "asc",
	};
	private isRefreshing = false;

	constructor(leaf: WorkspaceLeaf, plugin: FriendTracker) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_FRIEND_TRACKER;
	}

	getDisplayText() {
		return "Friend Tracker";
	}

	getIcon() {
		return "user"; // Use Obsidian's "user" icon
	}

	async onOpen() {
		// Clear any existing handlers first
		if (this.fileChangeHandler) {
			this.app.vault.offref(this.fileChangeHandler);
			this.fileChangeHandler = null;
		}

		// Register new file change handler
		this.fileChangeHandler = this.app.vault.on("modify", (file) => {
			if (file instanceof TFile && this.isContactFile(file)) {
				// Debounce the refresh call
				setTimeout(() => this.refresh(), 100);
			}
		});

		// Initial refresh
		await this.refresh();
	}

	private isContactFile(file: TFile): boolean {
		const contactFolder = this.plugin.settings.defaultFolder;
		return file.path.startsWith(contactFolder + "/");
	}

	async refresh() {
		if (this.isRefreshing) return;
		this.isRefreshing = true;

		try {
			const container = this.containerEl.children[1];
			container.empty();

			// Create header and add contact button container
			const headerContainer = container.createEl("div", {
				cls: "friend-tracker-header",
			});
			headerContainer.createEl("h2", { text: "Friend Tracker" });

			const addButton = headerContainer.createEl("button", {
				text: "Add Contact",
				cls: "friend-tracker-add-button",
			});
			addButton.addEventListener("click", () =>
				this.openAddContactModal()
			);

			// Fetch and sort contacts
			let contacts = await this.getContacts();
			contacts = this.sortContacts(contacts, this.currentSort);

			if (contacts.length === 0) {
				const emptyState = container.createEl("div", {
					cls: "friend-tracker-empty-state",
				});
				emptyState.createEl("p", {
					text: "No contacts found. Get started by creating your first contact!",
				});
				return;
			}

			// Create table for contacts
			const table = container.createEl("table");
			table.style.width = "100%";

			// Create header row with sort buttons
			const headerRow = table.createEl("tr");
			const columns: Array<{
				key: keyof Omit<ContactWithCountdown, "file">;
				label: string;
				sortable?: boolean;
			}> = [
				{ key: "name", label: "Name", sortable: true },
				{ key: "age", label: "Age", sortable: true },
				{ key: "formattedBirthday", label: "Birthday", sortable: true },
				{
					key: "daysUntilBirthday",
					label: "Days Until Birthday",
					sortable: true,
				},
				{ key: "relationship", label: "Relationship", sortable: true },
				{ key: "name", label: "", sortable: false }, // Empty label for actions column
			];

			columns.forEach(({ key, label, sortable }) => {
				const th = headerRow.createEl("th");

				if (sortable) {
					const button = th.createEl("button", {
						cls: "friend-tracker-sort-button",
					});

					// Add text span
					button.createEl("span", { text: label });

					// Add sort indicator span
					button.createEl("span", {
						cls: "sort-indicator",
						text:
							this.currentSort.column === key
								? this.currentSort.direction === "asc"
									? "↑"
									: "↓"
								: "",
					});

					button.addEventListener("click", () => {
						this.handleSort(key);
					});
				} else {
					th.setText(label);
				}
			});

			// Create table rows
			contacts.forEach((contact) => {
				const row = table.createEl("tr");
				row.createEl("td", { text: contact.name });
				row.createEl("td", { text: contact.age?.toString() || "N/A" });
				row.createEl("td", {
					text: contact.formattedBirthday || "N/A",
				});
				row.createEl("td", {
					text:
						contact.daysUntilBirthday !== null
							? `${contact.daysUntilBirthday} days`
							: "N/A",
				});
				row.createEl("td", { text: contact.relationship || "N/A" });

				// Add actions cell with both edit and delete buttons
				const actionsCell = row.createEl("td", {
					cls: "friend-tracker-actions",
				});

				// Add delete button
				const deleteButton = actionsCell.createEl("button", {
					cls: "friend-tracker-delete-button",
					attr: { "aria-label": "Remove contact" },
				});
				setIcon(deleteButton, "trash");

				// Add click handlers
				row.addEventListener("click", (e) => {
					if (!(e.target as HTMLElement).closest("button")) {
						this.openContact(contact.file);
					}
				});

				deleteButton.addEventListener("click", (e) => {
					e.stopPropagation();
					this.openDeleteModal(contact.file);
				});
			});
		} finally {
			this.isRefreshing = false;
		}
	}

	private handleSort(column: keyof Omit<Contact, "file">) {
		if (this.currentSort.column === column) {
			// Toggle direction if clicking the same column
			this.currentSort.direction =
				this.currentSort.direction === "asc" ? "desc" : "asc";
		} else {
			// New column, default to ascending
			this.currentSort = {
				column,
				direction: "asc",
			};
		}
		this.refresh();
	}

	private sortContacts(contacts: Contact[], sort: SortConfig): Contact[] {
		return [...contacts].sort((a, b) => {
			let valueA = a[sort.column];
			let valueB = b[sort.column];

			// Handle null/undefined values
			if (valueA == null) valueA = "";
			if (valueB == null) valueB = "";

			// Convert to strings for comparison
			const strA = valueA.toString().toLowerCase();
			const strB = valueB.toString().toLowerCase();

			const comparison = strA.localeCompare(strB);
			return sort.direction === "asc" ? comparison : -comparison;
		});
	}

	async getContacts(): Promise<ContactWithCountdown[]> {
		const folder = this.plugin.settings.defaultFolder;
		const vault = this.app.vault;
		const folderPath = vault.getAbstractFileByPath(folder);

		if (!folderPath || !(folderPath instanceof TFolder)) {
			new Notice("Friend Tracker folder not found.");
			return [];
		}

		const files = folderPath.children.filter(
			(file) => file instanceof TFile
		);
		const contacts: ContactWithCountdown[] = [];

		for (const file of files) {
			if (!(file instanceof TFile)) continue;

			const content = await vault.read(file);
			const metadata = this.parseYaml(content);

			if (metadata) {
				const age = this.calculateAge(metadata.birthday);
				const formattedBirthday = this.formatBirthday(
					metadata.birthday
				);
				const daysUntilBirthday = this.calculateDaysUntilBirthday(
					metadata.birthday
				);

				contacts.push({
					name: metadata.name || "Unknown",
					birthday: metadata.birthday || "",
					formattedBirthday,
					relationship: metadata.relationship || "",
					age,
					daysUntilBirthday,
					file,
				});
			}
		}

		return contacts;
	}

	private calculateAge(birthday: string): number | null {
		if (!birthday) return null;

		const birthDate = new Date(birthday);
		if (isNaN(birthDate.getTime())) return null;

		const today = new Date();
		let age = today.getFullYear() - birthDate.getFullYear();
		const monthDiff = today.getMonth() - birthDate.getMonth();

		if (
			monthDiff < 0 ||
			(monthDiff === 0 && today.getDate() < birthDate.getDate())
		) {
			age--;
		}

		return age;
	}

	private formatBirthday(dateStr: string): string {
		if (!dateStr) return "";
		const date = new Date(dateStr);
		if (isNaN(date.getTime())) return dateStr;

		return date.toLocaleDateString("en-US", {
			month: "long",
			day: "numeric",
		});
	}

	private calculateDaysUntilBirthday(birthday: string): number | null {
		if (!birthday) return null;

		const today = new Date();
		const birthDate = new Date(birthday);
		if (isNaN(birthDate.getTime())) return null;

		// Create this year's birthday
		const thisYearBirthday = new Date(
			today.getFullYear(),
			birthDate.getMonth(),
			birthDate.getDate()
		);

		// If this year's birthday has passed, use next year's birthday
		if (thisYearBirthday < today) {
			thisYearBirthday.setFullYear(today.getFullYear() + 1);
		}

		// Calculate days difference
		const diffTime = thisYearBirthday.getTime() - today.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

		return diffDays;
	}

	parseYaml(content: string): Record<string, any> | null {
		const match = content.match(/^---\n([\s\S]+?)\n---/);
		return match ? parseYaml(match[1]) : null;
	}

	async openContact(file: TFile) {
		// Try to find an existing leaf with this contact
		const leaves = this.app.workspace.getLeavesOfType(
			VIEW_TYPE_CONTACT_PAGE
		);
		const existingLeaf = leaves.find(
			(leaf) =>
				(leaf.view as ContactPageView).getState().filePath === file.path
		);

		if (existingLeaf) {
			this.app.workspace.revealLeaf(existingLeaf);
			return;
		}

		// Open in new leaf
		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.setViewState({
			type: VIEW_TYPE_CONTACT_PAGE,
			state: { filePath: file.path },
		});
	}

	async onClose() {
		if (this.fileChangeHandler) {
			this.app.vault.offref(this.fileChangeHandler);
			this.fileChangeHandler = null;
		}
		this.isRefreshing = false;
	}

	async openAddContactModal() {
		const modal = new AddContactModal(
			this.app,
			this.plugin,
			async (name) => {
				try {
					await this.createNewContact(name);
					modal.close();
					// Wait a brief moment before refreshing to ensure file system events are settled
					setTimeout(() => this.refresh(), 100);
				} catch (error) {
					new Notice(`Error creating contact: ${error}`);
				}
			}
		);
		modal.open();
	}

	async createNewContact(name: string) {
		const folder = this.plugin.settings.defaultFolder;
		const fileName = `${name}.md`;
		const filePath = `${folder}/${fileName}`;

		const content = [
			"---",
			`name: ${name}`,
			"birthday:", // YYYY-MM-DD format
			"relationship:",
			"email:",
			"phone:",
			"address:",
			"---",
			"",
			`# ${name}`,
			"",
			"## Family",
			"- Spouse: [[]]",
			"- Children: ",
			"  - [[]]",
			"",
			"## Recent Interactions",
			"_Add recent interactions here_",
			"",
			"## Important Information",
			"_Add important information here_",
			"",
			"## Notes",
			"_Add general notes here_",
		].join("\n");

		try {
			await this.app.vault.create(filePath, content);
			new Notice(`Created contact: ${name}`);
		} catch (error) {
			new Notice(`Error creating contact: ${error}`);
		}
	}

	private async openDeleteModal(file: TFile) {
		const modal = new DeleteContactModal(this.app, file, async () => {
			try {
				await this.app.vault.trash(file, true);
				new Notice(`Deleted contact: ${file.basename}`);
				this.refresh();
			} catch (error) {
				new Notice(`Error deleting contact: ${error}`);
			}
		});
		modal.open();
	}
}

class AddContactModal extends Modal {
	plugin: FriendTracker;
	onSubmit: (name: string) => void;

	constructor(
		app: App,
		plugin: FriendTracker,
		onSubmit: (name: string) => void
	) {
		super(app);
		this.plugin = plugin;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Add New Contact" });

		const form = contentEl.createEl("form");
		form.addEventListener("submit", async (e) => {
			e.preventDefault();
			const nameInput = form.querySelector("input");
			if (nameInput?.value) {
				await this.onSubmit(nameInput.value);
				// Don't close here, let the caller handle it
			}
		});

		const nameInput = form.createEl("input", {
			attr: { type: "text", placeholder: "Contact name" },
		});
		nameInput.focus();

		form.createEl("button", {
			text: "Add Contact",
			attr: { type: "submit" },
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class DeleteContactModal extends Modal {
	constructor(
		app: App,
		private contact: TFile,
		private onConfirm: () => void
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Delete Contact" });
		contentEl.createEl("p", {
			text: `Are you sure you want to delete ${this.contact.basename}?`,
		});

		const buttonContainer = contentEl.createEl("div", {
			cls: "friend-tracker-delete-modal-buttons",
		});

		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
			cls: "friend-tracker-button-secondary",
		});
		cancelButton.addEventListener("click", () => this.close());

		const deleteButton = buttonContainer.createEl("button", {
			text: "Delete",
			cls: "friend-tracker-button-danger",
		});
		deleteButton.addEventListener("click", async () => {
			await this.onConfirm();
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ContactPageView extends ItemView {
	private file: TFile | null = null;
	private contactData: any = {};

	constructor(leaf: WorkspaceLeaf, private plugin: FriendTracker) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_CONTACT_PAGE;
	}

	getDisplayText(): string {
		return this.file?.basename || "Contact";
	}

	async onload() {
		super.onload();
	}

	async setState(state: any, result: any) {
		const file = this.app.vault.getAbstractFileByPath(state.filePath);
		if (file instanceof TFile) {
			await this.setFile(file);
		}
		await super.setState(state, result);
	}

	getState() {
		return {
			type: VIEW_TYPE_CONTACT_PAGE,
			filePath: this.file?.path,
		};
	}

	async setFile(file: TFile) {
		this.file = file;
		if (this.file) {
			const content = await this.app.vault.read(this.file);
			const match = content.match(/^---\n([\s\S]+?)\n---/);
			this.contactData = match ? parseYaml(match[1]) : {};
			this.render();
		}
	}

	render() {
		const container = this.containerEl.children[1];
		container.empty();

		if (!this.contactData || !this.contactData.name) {
			container.createEl("div", {
				text: "No contact data available",
				cls: "contact-empty-state",
			});
			return;
		}

		// Create a custom interface
		const header = container.createEl("div", {
			cls: "contact-page-header",
		});
		header.createEl("h1", { text: this.contactData.name });

		const infoSection = container.createEl("div", {
			cls: "contact-info-section",
		});

		// Basic Info
		const basicInfo = infoSection.createEl("div", {
			cls: "contact-basic-info",
		});
		this.createInfoField(basicInfo, "Birthday", this.contactData.birthday);
		this.createInfoField(basicInfo, "Email", this.contactData.email);
		this.createInfoField(basicInfo, "Phone", this.contactData.phone);

		// Interactions
		const interactions = container.createEl("div", {
			cls: "contact-interactions",
		});
		interactions.createEl("h2", { text: "Recent Interactions" });
		const addInteraction = interactions.createEl("button", {
			text: "Add Interaction",
			cls: "contact-add-interaction",
		});
	}

	private createInfoField(
		container: HTMLElement,
		label: string,
		value: string
	) {
		const field = container.createEl("div", { cls: "contact-field" });
		field.createEl("label", { text: label });

		// Special handling for birthday field
		if (label === "Birthday") {
			const input = field.createEl("input", {
				cls: "contact-field-input",
				attr: {
					type: "date", // Use HTML5 date input
					value: value || "",
					placeholder: "YYYY-MM-DD",
				},
			});

			// Handle input changes for birthday
			input.addEventListener("change", async () => {
				if (!this.file) return;

				// Format the date to YYYY-MM-DD
				const date = input.valueAsDate;
				const formattedDate = date
					? date.toISOString().split("T")[0]
					: input.value;

				// Update the contact data
				this.contactData[label.toLowerCase()] = formattedDate;
				await this.saveContactData();
			});
		} else {
			// Regular text input for other fields
			const input = field.createEl("input", {
				cls: "contact-field-input",
				attr: {
					type: "text",
					value: value || "",
					placeholder: "Not set",
				},
			});

			// Handle input changes for other fields
			input.addEventListener("change", async () => {
				if (!this.file) return;
				this.contactData[label.toLowerCase()] = input.value;
				await this.saveContactData();
			});
		}
	}

	// Add this helper method to handle file saving
	private async saveContactData() {
		if (!this.file) return;

		// Read the current file content
		const content = await this.app.vault.read(this.file);

		// Split the content into YAML front matter and the rest
		const parts = content.split(/---\n([\s\S]+?)\n---/);

		if (parts.length >= 3) {
			// Update the YAML front matter
			const newYaml = Object.entries(this.contactData)
				.map(([key, value]) => `${key}: ${value}`)
				.join("\n");

			// Reconstruct the file content
			const newContent = `---\n${newYaml}\n---${parts[2]}`;

			// Save the file
			await this.app.vault.modify(this.file, newContent);
			new Notice(`Updated contact`);
		}
	}
}
