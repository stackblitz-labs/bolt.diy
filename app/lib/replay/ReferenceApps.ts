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
    appName: 'Telemetry Board',
    description: 'Listens to telemetry events and helps you monitor your systems',
    bulletPoints: ['Custom Metrics and Boards', 'Email Alerts'],
    categories: [ReferenceAppCategory.Technical],
  },
  {
    appName: 'Support CRM',
    description: 'Manage your support team and helping your customers',
    bulletPoints: ['Email Integration'],
    categories: [ReferenceAppCategory.Business],
  },
  {
    appName: 'Invoicerator',
    description: 'Track time and costs for you and your team and generate invoices',
    bulletPoints: ['PDF Invoicing'],
    categories: [ReferenceAppCategory.Business, ReferenceAppCategory.Personal],
  },
  {
    appName: 'StudyBuddy',
    description: 'Generate study materials for any topic',
    bulletPoints: ['PDF Imports', 'AI Generated Flash Cards'],
    categories: [ReferenceAppCategory.Personal],
  },
  {
    appName: 'MealMinder',
    description: 'Family meal planning and shared grocery lists',
    bulletPoints: ['Automatic Recipe Lookup'],
    categories: [ReferenceAppCategory.Personal],
  },
  {
    appName: 'ChangeLogger',
    description: 'Collect feedback and build a roadmap and change log for your users',
    bulletPoints: ['Voting System', 'Email Broadcast'],
    categories: [ReferenceAppCategory.Technical],
  },
];
