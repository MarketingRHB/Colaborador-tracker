import { TFile } from "obsidian";

export interface FriendTrackerSettings {
        contactsFolder: string;
        defaultSortColumn: keyof Omit<ContactWithCountdown, "file">;
        defaultSortDirection: "asc" | "desc";
        relationshipTypes: string[];
        holidayDates: string[];
        defaultActiveTab: "notes" | "interactions" | "markdown";
        language: string;
}

export interface Contact {
	name: string;
	birthday: string;
	relationship: string;
	age: number | null;
	file: TFile;
}

export interface ContactWithCountdown extends Contact {
	formattedBirthday: string;
	daysUntilBirthday: number | null;
	lastInteraction: string | null;
}

export interface SortConfig {
	column: keyof Omit<ContactWithCountdown, "file">;
	direction: "asc" | "desc";
}

export interface Interaction {
	date: string;
	text: string;
}

export const DEFAULT_SETTINGS: FriendTrackerSettings = {
        contactsFolder: "FriendTracker",
        defaultSortColumn: "daysUntilBirthday",
        defaultSortDirection: "asc",
        relationshipTypes: ["family", "friend", "colleague", "pet"],
        holidayDates: ["01-01", "07-04", "12-25"],
        defaultActiveTab: "notes",
        language: "en",
};
