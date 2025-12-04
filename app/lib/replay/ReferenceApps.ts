// Describes all the reference apps that can be used for customization
// during app building.

enum ReferenceAppCategory {
  Business = 'Business',
  Technical = 'Technical',
  Personal = 'Personal',
}

interface ReferenceApp {
  appPath?: string;
  appName: string;
  description: string;
  bulletPoints?: string[];
  photo?: string;
  categories: ReferenceAppCategory[];
}

export const referenceApps: ReferenceApp[] = [
  {
    appPath: 'management/IssueTracker',
    appName: 'Issue Tracker',
    description: 'Track and manage issues across your projects',
    bulletPoints: ['Triage System', 'Personal Inboxes', 'Email Notifications'],
    photo: 'https://utfs.io/f/g4w5SXU7E8KdqUWQBDviRZOVD8n3oL79Tegv1adIFGkcmQ6H',
    categories: [ReferenceAppCategory.Business, ReferenceAppCategory.Technical],
  },
  {
    appPath: 'management/DocumentManager',
    appName: 'Team Wiki',
    description: 'A shared knowledge base for your team',
    bulletPoints: ['Rich Text Documents', 'Kanban Boards and Tables', 'Comment System'],
    photo: 'https://utfs.io/f/g4w5SXU7E8Kd65diTnZrn27SvXDfJANF0dzKcZECW1mhuabT',
    categories: [ReferenceAppCategory.Business],
  },
  {
    appPath: 'observe/TelemetryBoard',
    appName: 'Telemetry Board',
    description: 'Listens to OpenTelemetry events and helps you monitor your systems',
    bulletPoints: ['Custom Boards', 'Saved Views', 'Editable Log Rendering'],
    photo: 'https://utfs.io/f/g4w5SXU7E8KdjK4IdOUektSnylW57BEZobPcKpDY4LHifIMz',
    categories: [ReferenceAppCategory.Technical],
  },
  {
    appPath: 'social/ScoreKeeper',
    appName: 'ScoreKeeper',
    description: "Keep track of everyone's scores when playing card and board games",
    bulletPoints: ['Round History', 'Game History'],
    photo: 'https://utfs.io/f/g4w5SXU7E8KdLdVubLoPsxJKqg3tOm8U6XBkfWzF1NvylbMC',
    categories: [ReferenceAppCategory.Personal],
  },
  {
    appPath: 'personal/Paperlane',
    appName: 'Paperlane',
    description: 'Clean and simple note taking app',
    bulletPoints: ['Rich Text'],
    photo: 'https://utfs.io/f/g4w5SXU7E8KdYlDrUI5pOy8T4MGez0Njgs2FS9nmWfxvoXib',
    categories: [ReferenceAppCategory.Personal],
  },
  {
    appPath: 'social/FamilyCarts',
    appName: 'Family Carts',
    description: 'Shared grocery lists for you and your family',
    bulletPoints: ['Per Store Lists'],
    photo: 'https://utfs.io/f/g4w5SXU7E8KdeWtx5KE1nQ39PNmwcYLluUfE5oeBy6F2pkSM',
    categories: [ReferenceAppCategory.Personal],
  },
  {
    appPath: 'management/SupportCRM',
    appName: 'Support CRM',
    description: 'Manage support tickets from your customers',
    bulletPoints: ['Email Notifications'],
    photo: 'https://utfs.io/f/g4w5SXU7E8KdfbHk8O1ureDlVQJGmHCq126KNU7B3RpWcTtE',
    categories: [ReferenceAppCategory.Business],
  },
  {
    appPath: 'social/CommunityIdeas',
    appName: 'Community Ideas',
    description: 'Collect ideas from your users on upcoming features',
    bulletPoints: ['Voting System', 'User Comments'],
    photo: 'https://utfs.io/f/g4w5SXU7E8Kd4gd56oTwYcWkB0HDfQ6qhVKvEnaUGMbL8owF',
    categories: [ReferenceAppCategory.Business],
  },
  {
    appPath: 'management/Invoicerator',
    appName: 'Invoicerator',
    description: 'Track time on different projects and generate invoices',
    bulletPoints: ['PDF Invoicing'],
    photo: 'https://utfs.io/f/g4w5SXU7E8Kdjs887pUektSnylW57BEZobPcKpDY4LHifIMz',
    categories: [ReferenceAppCategory.Business, ReferenceAppCategory.Personal],
  },
  /*
  {
    appName: 'StudyBuddy',
    description: 'Generate study materials for any topic',
    bulletPoints: ['PDF Imports', 'AI Generated Flash Cards'],
    categories: [ReferenceAppCategory.Personal],
  },
  */
];
