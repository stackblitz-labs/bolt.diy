#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';

const program = new Command();

program
    .command('make:controller <ControllerName>')
    .description('Create a new controller class')
    .action((controllerName: string) => {
        let normalizedName = controllerName.charAt(0).toUpperCase() + controllerName.slice(1);
        const controllerSuffix = 'Controller';

        if (normalizedName.toLowerCase().endsWith(controllerSuffix.toLowerCase())) {
            normalizedName = normalizedName.substring(0, normalizedName.length - controllerSuffix.length) + controllerSuffix;
        } else {
            normalizedName += controllerSuffix;
        }

        const controllerDir = path.resolve(process.cwd(), 'app', 'controllers');
        const controllerPath = path.resolve(controllerDir, `${normalizedName}.ts`);

        try {
            fs.ensureDirSync(controllerDir);

            if (fs.existsSync(controllerPath)) {
                console.error(`Error: Controller ${normalizedName} already exists at ${controllerPath}`);
                process.exit(1);
            }

            const boilerplate = `// app/controllers/${normalizedName}.ts

// TODO: Define or import Request and Response types suitable for the project if needed.

export class ${normalizedName} {
    constructor() {
        console.log('${normalizedName} initialized');
    }

    /**
     * Example index method.
     */
    public async index(): Promise<void> {
        console.log('Executing ${normalizedName} index method');
        // Your logic here
        // Example: return some data or render a view
    }

    /**
     * Example show method.
     * @param id The ID of the resource to show.
     */
    public async show(id: string): Promise<void> {
        console.log(\`Executing ${normalizedName} show method for ID: \${id}\`);
        // Your logic here
    }
}
`;
            fs.writeFileSync(controllerPath, boilerplate);
            console.log(`Controller ${normalizedName} created successfully at ${controllerPath}`);

        } catch (error) {
            if (error instanceof Error) {
                console.error(`Failed to create controller: ${error.message}`);
            } else {
                console.error('Failed to create controller (unknown error type):', error);
            }
            process.exit(1);
        }
    });

program
    .command('make:model <ModelName>')
    .description('Create a new model class')
    .action((modelName: string) => {
        let normalizedName = modelName.charAt(0).toUpperCase() + modelName.slice(1);
        // No strict suffix like "Model" is enforced, just PascalCase.

        const modelDir = path.resolve(process.cwd(), 'app', 'models');
        const modelPath = path.resolve(modelDir, `${normalizedName}.ts`);

        try {
            fs.ensureDirSync(modelDir);

            if (fs.existsSync(modelPath)) {
                console.error(`Error: Model ${normalizedName} already exists at ${modelPath}`);
                process.exit(1);
            }

            const boilerplate = `// app/models/${normalizedName}.ts

// TODO: Define database interaction logic or ORM setup if applicable.

export class ${normalizedName} {
    public id: string | number; // Example property

    constructor(id: string | number) {
        this.id = id;
        console.log('${normalizedName} initialized with id:', id);
    }

    public async save(): Promise<void> {
        console.log('Saving ${normalizedName} instance with id:', this.id);
        // Actual save logic here
    }

    public static async findById(id: string | number): Promise<${normalizedName} | null> {
        console.log('Finding ${normalizedName} instance with id:', id);
        // Actual find logic here
        return null;
    }
}
`;

            fs.writeFileSync(modelPath, boilerplate);
            console.log(`Model ${normalizedName} created successfully at ${modelPath}`);

        } catch (error) {
            if (error instanceof Error) {
                console.error(`Failed to create model: ${error.message}`);
            } else {
                console.error('Failed to create model (unknown error type):', error);
            }
            process.exit(1);
        }
    });

program.parse(process.argv);

// Commander handles help output by default if no command/args are given,
// or if an unknown command is used. So, no explicit help call needed here.
