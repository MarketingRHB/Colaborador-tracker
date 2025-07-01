import { App, Modal } from "obsidian";

export class AddFieldModal extends Modal {
        private onSubmit: (fieldName: string) => void;
        private plugin: any;

        constructor(app: App, plugin: any, onSubmit: (fieldName: string) => void) {
                super(app);
                this.plugin = plugin;
                this.onSubmit = onSubmit;
        }

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
                contentEl.createEl("h2", { text: this.plugin.t("add_custom_field") });

		const form = contentEl.createEl("form");
		form.addEventListener("submit", (e) => {
			e.preventDefault();
			const input = form.querySelector("input");
			if (input?.value) {
				this.onSubmit(input.value.toLowerCase());
				this.close();
			}
		});

                const input = form.createEl("input", {
                        attr: {
                                type: "text",
                                placeholder: this.plugin.t("field_name_placeholder"),
                                pattern: "[a-zA-Z][a-zA-Z0-9]*",
                        },
			cls: "contact-field-input",
		});
		input.focus();

                form.createEl("button", {
                        text: this.plugin.t("add_field"),
                        attr: { type: "submit" },
                        cls: "friend-tracker-button button-primary button-full-width",
                });
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
