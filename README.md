# Collaborator Tracker for Obsidian

A plugin for Obsidian that helps you keep track of collaborators, family, and your interactions with them. Never forget a birthday or important detail about someone you care about.

## Inspiration

This plugin was inspired by [Scott Stockdale's article on maintaining meaningful collaborations](https://web.archive.org/web/20250409205126/https://entrepreneurscanparty.com/posts/how-to-be-a-more-awesome-friend). The core idea is that maintaining strong relationships requires a system for:

-   Tracking important dates and milestones
-   Recording meaningful interactions
-   Remembering personal details
-   Making regular meaningful touchpoints

Collaborator Tracker helps implement these relationship-building practices in a simple, organized way within Obsidian.

![image](https://github.com/user-attachments/assets/0f8ef3de-6c18-4813-a87a-1a7d5d1a680f)

## Features

-   **Contact Management**: Easily create and manage contact profiles with essential information
-   **Birthday Tracking**: Keep track of birthdays and see upcoming celebrations
-   **Interaction Logging**: Record and date your interactions with people
-   **Custom Fields**: Add custom fields to track any information that matters to you
-   **Notes Section**: Keep detailed notes about family members, relationships, or any other important details
-   **Smart Organization**: Sort contacts by name, age, or upcoming birthdays
-   **Search Contacts**: Quickly filter contacts with the new search bar
-   **Holiday & Weekend Reminders**: Weekend birthdays show on Monday, and
    birthdays falling on your configured holidays remain visible until the day
    after. Edit the holiday list in the plugin settings.

## Usage

### Creating Contacts

1. Click the "Add Contact" button to create a new contact
2. Fill in their basic information (name, birthday, email, phone)
3. Add any custom fields you want to track
4. Use the notes section for additional details

### Tracking Interactions

1. Open a contact's profile
2. Click "Add Interaction" to log a new interaction
3. Enter the date and details of the interaction
4. View interaction history in chronological order

### Managing Birthdays

-   The main view shows upcoming birthdays
-   Sort by "Days Until Birthday" to see who's celebrating soon
-   Birthdays are automatically calculated and displayed in a friendly format
-   Weekend birthdays appear on Monday, and birthdays on your holiday list stay
    visible until the day after the holiday

### Custom Fields

-   Add custom fields to track specific information
-   Fields are saved in the contact's YAML frontmatter
-   Easily edit or update field values

## Installation

1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode
3. Click Browse and search for "Collaborator Tracker"
4. Install the plugin and enable it

## Storage

All contact information is stored in markdown files with YAML frontmatter, making it:

-   Portable
-   Future-proof
-   Easy to backup
-   Compatible with other markdown tools

## Support

If you encounter any issues or have feature requests, please visit the [GitHub repository](https://github.com/buzzguy/collaborator-tracker/issues).

## Building from source

1. Run `npm install` to install dependencies.
2. Run `npm run build` to compile the plugin.


## Author

Created by [Dan Au](https://dausign.com)

## License

MIT License - see LICENSE for details
