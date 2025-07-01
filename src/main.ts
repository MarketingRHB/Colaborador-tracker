import { Plugin, Notice } from "obsidian";
import * as path from "path";
import { CollaboratorTrackerSettings, DEFAULT_SETTINGS } from "./types";
import { loadIni, getPluginDir } from "./i18n";
import {
	CollaboratorTrackerView,
	VIEW_TYPE_COLLABORATOR_TRACKER,
} from "./views/CollaboratorTrackerView";
import {
	ContactPageView,
	VIEW_TYPE_CONTACT_PAGE,
} from "@/views/ContactPageView";
import { CollaboratorTrackerSettingTab } from "./views/CollaboratorTrackerView/settings";
import { ContactOperations } from "@/services/ContactOperations";

export default class CollaboratorTracker extends Plugin {
        settings: CollaboratorTrackerSettings;
        public contactOperations: ContactOperations;
        private translations: Record<string, string> = {};
        private viewsRegistered = false;

        public t(key: string): string {
                return this.translations[key] || key;
        }

        async onload() {
                await this.loadSettings();
                await this.loadTranslations();
                this.contactOperations = new ContactOperations(this);

		// On mobile, we should wait for layout-ready
		this.app.workspace.onLayoutReady(() => {
			this.initialize();
		});
	}

       private async initialize() {
               if (this.viewsRegistered) {
                       return;
               }
               this.viewsRegistered = true;
               try {
                       // Register views
			this.registerView(
				VIEW_TYPE_COLLABORATOR_TRACKER,
				(leaf) => new CollaboratorTrackerView(leaf, this)
			);

			this.registerView(
				VIEW_TYPE_CONTACT_PAGE,
				(leaf) => new ContactPageView(leaf, this)
			);

                        // Add ribbon icon
                       this.addRibbonIcon("user", "Open Collaborator Tracker", async () => {
				const workspace = this.app.workspace;
				const leaves = workspace.getLeavesOfType(
					VIEW_TYPE_COLLABORATOR_TRACKER
				);

				// Check for existing view, handling deferred views
				for (const leaf of leaves) {
					const view = await leaf.view;
					if (view instanceof CollaboratorTrackerView) {
						workspace.revealLeaf(leaf);
						return;
					}
				}

				const leaf = workspace.getRightLeaf(false);
				if (leaf) {
					await leaf.setViewState({
						type: VIEW_TYPE_COLLABORATOR_TRACKER,
						active: true,
					});
					workspace.revealLeaf(leaf);
                                } else {
                                       new Notice("Could not create Collaborator Tracker view");
				}
			});

			// Add settings tab
			this.addSettingTab(new CollaboratorTrackerSettingTab(this.app, this));

			// Check for birthdays after everything is initialized
			await this.checkBirthdays();
		} catch (error) {
                       console.error("Collaborator Tracker failed to load:", error);
                       new Notice("Collaborator Tracker failed to load: " + error.message);
		}
	}

        private async checkBirthdays() {
		const contacts = await this.contactOperations.getContacts();
		const birthdayContacts = contacts.filter(
			(c) => c.daysUntilBirthday === 0
		);

		if (birthdayContacts.length > 0) {
			if (birthdayContacts.length === 1) {
				new Notice(
					`🎂 It's ${birthdayContacts[0].name}'s birthday today!`,
					8000 // Show for 8 seconds
				);
			} else {
				const names = birthdayContacts.map((c) => c.name);
				const lastPerson = names.pop();
                                const nameList = names.join(", ") + " and " + lastPerson;
                                new Notice(`🎂 It's ${nameList}'s birthday today!`, 8000);
                        }
                }

                // Optional: Also notify about tomorrow's birthdays
                const tomorrowBirthdays = contacts.filter(
                        (c) => c.daysUntilBirthday === 1
                );
                if (tomorrowBirthdays.length > 0) {
                        if (tomorrowBirthdays.length === 1) {
                                new Notice(
                                        `🎈 ${tomorrowBirthdays[0].name}'s birthday is tomorrow!`,
                                        6000 // Show for 6 seconds (slightly shorter for tomorrow's)
                                );
                        } else {
                                const names = tomorrowBirthdays.map((c) => c.name);
                                const lastPerson = names.pop();
                                const nameList = names.join(", ") + " and " + lastPerson;
                                new Notice(`🎈 ${nameList}'s birthdays are tomorrow!`, 6000);
                        }
                }
        }

        public async loadTranslations() {
                const dir = getPluginDir(this.app, this.manifest);
                const userFile = `${dir}/locales/${this.settings.language}.ini`;
                const bundledFile = path.join(
                        __dirname,
                        "locales",
                        `${this.settings.language}.ini`
                );

                try {
                        this.translations = await loadIni(userFile);
                        if (Object.keys(this.translations).length === 0) {
                                this.translations = await loadIni(bundledFile);
                        }
                } catch (e) {
                        console.error("Failed to load translations", e);
                        try {
                                this.translations = await loadIni(bundledFile);
                        } catch {
                                this.translations = {};
                        }
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

	async onunload() {
		// Remove the datalist from document.body if it exists
		const datalist = document.getElementById("relationship-types");
		if (datalist) {
			datalist.remove();
		}
	}
}
