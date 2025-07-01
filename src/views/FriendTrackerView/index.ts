import { ItemView, WorkspaceLeaf, EventRef, TFile, Platform } from "obsidian";
import type FriendTracker from "@/main";
import { TableView } from "./TableView";
import { ContactOperations } from "@/services/ContactOperations";
import { VIEW_TYPE_CONTACT_PAGE } from "@/views/ContactPageView";
import type { SortConfig, ContactWithCountdown } from "@/types";
import { AddContactModal } from "@/modals/AddContactModal";
import { DeleteContactModal } from "@/modals/DeleteContactModal";

export const VIEW_TYPE_FRIEND_TRACKER = "friend-tracker-view";

export class FriendTrackerView extends ItemView {
        currentSort: SortConfig;
        private tableView: TableView;
        private contactOps: ContactOperations;
        private fileChangeHandler: EventRef | null = null;
        private isRefreshing = false;
        private _contacts: ContactWithCountdown[] | null = null;
        public searchQuery = "";
        public searchFocused = false;
        public searchInput: HTMLInputElement | null = null;

        constructor(leaf: WorkspaceLeaf, public plugin: FriendTracker) {
		super(leaf);
		this.currentSort = {
			column: this.plugin.settings.defaultSortColumn,
			direction: this.plugin.settings.defaultSortDirection,
		};
		this.tableView = new TableView(this);
		this.contactOps = new ContactOperations(this.plugin);
	}

	// ... rest of the implementation from earlier

	public async openAddContactModal() {
		const modal = new AddContactModal(this.app, this.plugin);
		modal.open();
	}

	public handleSort(column: keyof Omit<ContactWithCountdown, "file">) {
		if (this.currentSort.column === column) {
			this.currentSort.direction =
				this.currentSort.direction === "asc" ? "desc" : "asc";
		} else {
			this.currentSort = { column, direction: "asc" };
		}
		this.refresh();
	}

	public async openContact(file: TFile) {
		// Try to find existing contact page view
		const leaves = this.app.workspace.getLeavesOfType(
			VIEW_TYPE_CONTACT_PAGE
		);
		const leaf =
			leaves.length > 0 ? leaves[0] : this.app.workspace.getLeaf("tab");

		await leaf.setViewState({
			type: VIEW_TYPE_CONTACT_PAGE,
			state: { filePath: file.path },
		});
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
		this.app.workspace.revealLeaf(leaf);

		// On mobile, collapse the main view after opening contact
		if (Platform.isMobile) {
			this.app.workspace.rightSplit.collapse();
		}
	}

        public async openDeleteModal(file: TFile) {
                const modal = new DeleteContactModal(this.app, file, async () => {
                        await this.app.fileManager.trashFile(file);
                        await this.refresh();
                });
                modal.open();
        }

        public updateSearchQuery(value: string) {
                this.searchQuery = value;
                this.refresh();
        }

	getViewType(): string {
		return VIEW_TYPE_FRIEND_TRACKER;
	}

	getDisplayText(): string {
		return "Friend tracker";
	}

	async onOpen() {
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file instanceof TFile && this.isContactFile(file)) {
					setTimeout(() => this.refresh(), 100);
				}
			})
		);

		// Add visibility change handler
		document.addEventListener(
			"visibilitychange",
			this.handleVisibilityChange
		);
		window.addEventListener("focus", this.handleWindowFocus);

		await this.refresh();
	}

	onunload() {
		document.removeEventListener(
			"visibilitychange",
			this.handleVisibilityChange
		);
		window.removeEventListener("focus", this.handleWindowFocus);
	}

	private handleVisibilityChange = () => {
		if (document.visibilityState === "visible") {
			this.refresh();
		}
	};

	private handleWindowFocus = () => {
		this.refresh();
	};

	async refresh() {
		if (this.isRefreshing) return;
		this.isRefreshing = true;

		try {
			// Clear any cached data
			this._contacts = null;

			// Get the container and completely clear it
			const container = this.containerEl.children[1] as HTMLElement;
			// Remove all child elements
			while (container.firstChild) {
				container.removeChild(container.firstChild);
			}

			// Get contacts and apply sort if needed
                        const contacts = await this.contactOps.getContacts();
                        const filtered = this.filterContacts(contacts);
                        const sortConfig: SortConfig =
                                this.currentSort.column && this.currentSort.direction
                                        ? this.currentSort
                                        : {
                                                        column: "name" as keyof Omit<
                                                                ContactWithCountdown,
                                                                "file"
                                                        >,
                                                        direction: "asc" as "asc" | "desc",
                                          };

                        const sortedContacts = filtered.sort((a, b) => {
				const valueA = a[sortConfig.column];
				const valueB = b[sortConfig.column];

				// Handle null values in sorting
				if (valueA === null && valueB === null) return 0;
				if (valueA === null)
					return sortConfig.direction === "asc" ? -1 : 1;
				if (valueB === null)
					return sortConfig.direction === "asc" ? 1 : -1;

				if (valueA < valueB)
					return sortConfig.direction === "asc" ? -1 : 1;
				if (valueA > valueB)
					return sortConfig.direction === "asc" ? 1 : -1;
				return 0;
			});

			// Create a fresh container for the table
                        const tableContainer = container.createDiv();
                        await this.tableView.render(
                                tableContainer,
                                sortedContacts,
                                sortConfig
                        );
                        if (this.searchFocused && this.searchInput) {
                                const val = this.searchInput.value;
                                this.searchInput.focus({ preventScroll: true });
                                this.searchInput.setSelectionRange(val.length, val.length);
                        }
                } finally {
                        this.isRefreshing = false;
                }
        }

	private isContactFile(file: TFile): boolean {
		const contactFolder = this.plugin.settings.contactsFolder;
		return file.path.startsWith(contactFolder + "/");
	}

        private async sortContacts(
                column: keyof Omit<ContactWithCountdown, "file">,
                direction: "asc" | "desc"
        ) {
                this.currentSort = { column, direction };
                await this.refresh();
        }

        private filterContacts(
                contacts: ContactWithCountdown[]
        ): ContactWithCountdown[] {
                if (!this.searchQuery) return contacts;
                const q = this.searchQuery.toLowerCase();
                return contacts.filter((c) =>
                        c.name.toLowerCase().includes(q)
                );
        }
}
