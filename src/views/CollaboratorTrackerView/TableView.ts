import { setIcon } from "obsidian";
import type { CollaboratorTrackerView } from "./index";
import type { ContactWithCountdown, SortConfig } from "@/types";

export class TableView {
	constructor(private view: CollaboratorTrackerView) {}

	async render(
		container: HTMLElement,
		contacts: ContactWithCountdown[],
		sort: SortConfig
	) {
		// Create header and add contact button container
                const headerContainer = container.createEl("div", {
                        cls: "collaborator-tracker-header",
                });
                headerContainer.createEl("h2", { text: this.view.plugin.t("collaborator_tracker") });

                const searchInput = headerContainer.createEl("input", {
                        type: "text",
                        cls: "collaborator-tracker-search-input",
                        placeholder: this.view.plugin.t("search_placeholder"),
                }) as HTMLInputElement;
                searchInput.value = this.view.searchQuery;
                searchInput.addEventListener("input", () =>
                        this.view.updateSearchQuery(searchInput.value)
                );
                searchInput.addEventListener("focus", () => {
                        this.view.searchFocused = true;
                });
                searchInput.addEventListener("blur", () => {
                        this.view.searchFocused = false;
                });
                this.view.searchInput = searchInput;
                if (this.view.searchFocused) {
                        const val = searchInput.value;
                        searchInput.focus({ preventScroll: true });
                        searchInput.setSelectionRange(val.length, val.length);
                }

                const addButton = headerContainer.createEl("button", {
                        text: this.view.plugin.t("add_contact"),
                        cls: "collaborator-tracker-button button-outlined",
                });
		addButton.addEventListener("click", () =>
			this.view.openAddContactModal()
		);

		const content = container.createEl("div", {
			cls: "collaborator-tracker-content",
		});

		if (contacts.length === 0) {
			const emptyState = content.createEl("div", {
				cls: "collaborator-tracker-empty-state",
			});
                        emptyState.createEl("p", {
                                text: this.view.plugin.t("no_contacts"),
                        });
			return;
		}

		// Create scrollable container for table
		const tableContainer = content.createEl("div", {
			cls: "collaborator-tracker-table-container",
		});

		// Create table for contacts
		const table = tableContainer.createEl("table", {
			cls: "collaborator-tracker-table",
		}) as HTMLTableElement;

		this.renderTableHeader(table, sort);
		this.renderTableRows(table, contacts);
	}

	private renderTableHeader(table: HTMLTableElement, sort: SortConfig) {
		const headerRow = table.createEl("tr") as HTMLTableRowElement;
                const columns: Array<{
                        key: keyof Omit<ContactWithCountdown, "file"> | "actions";
                        label: string;
                        sortable?: boolean;
                }> = [
                        { key: "name", label: this.view.plugin.t("name"), sortable: true },
                        { key: "age", label: this.view.plugin.t("age"), sortable: true },
                        { key: "birthday", label: this.view.plugin.t("birthday"), sortable: true },
                        { key: "daysUntilBirthday", label: this.view.plugin.t("days_left"), sortable: true },
                        { key: "relationship", label: this.view.plugin.t("type"), sortable: true },
                        {
                                key: "lastInteraction",
                                label: this.view.plugin.t("last_interaction"),
                                sortable: true,
                        },
                        { key: "actions", label: "", sortable: false },
                ];

		columns.forEach(({ key, label, sortable }) => {
			const th = headerRow.createEl("th");

			if (sortable) {
				const button = th.createEl("button", {
					cls: "collaborator-tracker-sort-button",
				});

				// Add text span
				button.createEl("span", { text: label });

				// Add sort indicator span
				button.createEl("span", {
					cls: "sort-indicator",
					text:
						sort.column === key
							? sort.direction === "asc"
								? "↑"
								: "↓"
							: "",
				});

				button.addEventListener("click", () => {
					if (key !== "actions") {
						this.view.handleSort(
							key as keyof Omit<ContactWithCountdown, "file">
						);
					}
				});
			} else {
				th.setText(label);
			}
		});
	}

	private renderTableRows(
		table: HTMLTableElement,
		contacts: ContactWithCountdown[]
	) {
		// Sort contacts based on current sort configuration
		const sortedContacts = this.sortContacts(
			contacts,
			this.view.currentSort
		);

		sortedContacts.forEach((contact) => {
			const row = table.createEl("tr") as HTMLTableRowElement;

			// Create name cell with click handler
			const nameCell = this.renderNameCell(contact);
			row.appendChild(nameCell); // Add the name cell to the row
			nameCell.addEventListener("click", (e) => {
				e.stopPropagation(); // Stop event from bubbling
				this.view.openContact(contact.file);
			});

			// Rest of the cells (no click handlers)
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
			row.createEl("td", {
				text: contact.relationship || "N/A",
				cls: "collaborator-tracker-relationship-cell",
			});
			row.createEl("td", { text: contact.lastInteraction || "" });

			// Actions cell
			const actionsCell = row.createEl("td", {
				cls: "collaborator-tracker-actions",
			});

			// Delete button
                        const deleteButton = actionsCell.createEl("button", {
                                cls: "collaborator-tracker-delete-button",
                                attr: { "aria-label": this.view.plugin.t("remove_contact") },
                        });
			setIcon(deleteButton, "trash");

			deleteButton.addEventListener("click", (e) => {
				e.stopPropagation();
				this.view.openDeleteModal(contact.file);
			});
		});
	}

	private renderNameCell(contact: ContactWithCountdown): HTMLElement {
		const cell = document.createElement("td");
		cell.className = "collaborator-tracker-name-cell";

		if (contact.daysUntilBirthday !== null) {
			if (contact.daysUntilBirthday === 0) {
				// Birthday today - show cake
				const indicator = cell.createEl("div", {
					cls: "table-birthday-indicator birthday-today",
					text: "🎂",
				});
			} else if (contact.daysUntilBirthday <= 7) {
				// Within a week - show green dot
				const dotContainer = cell.createEl("div", {
					cls: "table-birthday-status-dot",
				});
				dotContainer.createEl("div", {
					cls: "table-birthday-status-dot-inner",
				});
			}
		}

		cell.createSpan({ text: contact.name });

		return cell;
	}

	private sortContacts(contacts: ContactWithCountdown[], sort: SortConfig) {
		return [...contacts].sort((a, b) => {
			if (sort.column === "birthday") {
				// Extract month and day from birthday strings
				const dateA = new Date(a.birthday);
				const dateB = new Date(b.birthday);

				const aValue = (dateA.getMonth() + 1) * 100 + dateA.getDate();
				const bValue = (dateB.getMonth() + 1) * 100 + dateB.getDate();

				return sort.direction === "asc"
					? aValue - bValue
					: bValue - aValue;
			}

			// Add special handling for daysUntilBirthday
			if (sort.column === "daysUntilBirthday") {
				// Handle null values
				if (
					a.daysUntilBirthday === null &&
					b.daysUntilBirthday === null
				)
					return 0;
				if (a.daysUntilBirthday === null) return 1;
				if (b.daysUntilBirthday === null) return -1;

				// Normal numeric comparison that respects sort direction
				return (
					(a.daysUntilBirthday - b.daysUntilBirthday) *
					(sort.direction === "asc" ? 1 : -1)
				);
			}

			const aValue = a[sort.column];
			const bValue = b[sort.column];

			// Handle null/empty values in sorting
			if (!aValue && !bValue) return 0;
			if (!aValue) return 1;
			if (!bValue) return -1;

			// Sort direction
			const direction = sort.direction === "asc" ? 1 : -1;

			// Handle different types of values
			if (sort.column === "relationship" || sort.column === "name") {
				// Case-insensitive string comparison for text columns
				const aStr = String(aValue).toLowerCase();
				const bStr = String(bValue).toLowerCase();
				return aStr < bStr ? -direction : aStr > bStr ? direction : 0;
			} else if (
				typeof aValue === "number" &&
				typeof bValue === "number"
			) {
				// Numeric comparison
				return (aValue - bValue) * direction;
			}

			// Default string comparison
			return aValue < bValue
				? -direction
				: aValue > bValue
				? direction
				: 0;
		});
	}
}
