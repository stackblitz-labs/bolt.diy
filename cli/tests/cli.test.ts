import { type ExecSyncOptionsWithStringEncoding, execSync } from 'child_process'; // Added 'type' keyword
import fs from 'fs-extra';
import path from 'path';
import assert from 'assert';
import { rimrafSync } from 'rimraf'; // Use rimrafSync

const cliCommand = 'pnpm run bolt --'; // Base command to run the CLI
const controllersDir = path.join(process.cwd(), 'app', 'controllers');
const modelsDir = path.join(process.cwd(), 'app', 'models');

const execOptions: ExecSyncOptionsWithStringEncoding = { encoding: 'utf-8', stdio: 'pipe' };

function runCli(args: string): { stdout: string; stderr: string; error: any } {
    try {
        const stdout = execSync(`${cliCommand} ${args}`, execOptions);
        return { stdout, stderr: '', error: null };
    } catch (e: any) {
        // If execSync throws, 'e' is the error object.
        // stdout and stderr are properties on it if the command produced output before failing.
        return {
            stdout: e.stdout?.toString() || '',
            stderr: e.stderr?.toString() || '',
            error: e
        };
    }
}

function cleanup() {
    console.log('Cleaning up test directories...');
    if (fs.existsSync(controllersDir)) {
        rimrafSync(controllersDir);
    }
    if (fs.existsSync(modelsDir)) {
        rimrafSync(modelsDir);
    }
}

function testMakeController() {
    console.log('Running make:controller tests...');
    let result;

    // Test 1: Successful creation
    console.log('  Test 1: Successful controller creation');
    result = runCli('make:controller TestUserController');
    assert.strictEqual(result.error, null, `make:controller TestUserController failed: STDERR: ${result.stderr} STDOUT: ${result.stdout}`);
    const controllerPath = path.join(controllersDir, 'TestUserController.ts');
    assert(fs.existsSync(controllerPath), `TestUserController.ts should be created. STDERR: ${result.stderr}`);
    const content = fs.readFileSync(controllerPath, 'utf-8');
    assert(content.includes('export class TestUserController'), 'File content is incorrect');
    console.log('  Test 1 PASSED');

    // Test 2: Already exists
    console.log('  Test 2: Controller already exists');
    result = runCli('make:controller TestUserController');
    assert.notStrictEqual(result.error, null, 'make:controller TestUserController should fail if controller exists');
    assert(result.stderr.includes('already exists'), `Error message for existing controller is incorrect. STDERR: ${result.stderr}`);
    console.log('  Test 2 PASSED');

    // Test 3: Naming convention (lowercase input)
    console.log('  Test 3: Controller naming convention');
    result = runCli('make:controller lowercaseuser');
    assert.strictEqual(result.error, null, `make:controller lowercaseuser failed: ${result.stderr}`);
    const normalizedControllerPath = path.join(controllersDir, 'LowercaseuserController.ts');
    assert(fs.existsSync(normalizedControllerPath), `LowercaseuserController.ts should be created. Actual path: ${normalizedControllerPath}`);
    console.log('  Test 3 PASSED');

    // Test 4: Missing argument
    console.log('  Test 4: Missing controller name');
    result = runCli('make:controller');
    assert.notStrictEqual(result.error, null, 'make:controller should fail without a name');
    assert(result.stderr.includes("error: missing required argument 'ControllerName'"), `Error message for missing argument is incorrect. STDERR: ${result.stderr}`);
    console.log('  Test 4 PASSED');
}

function testMakeModel() {
    console.log('Running make:model tests...');
    let result;

    // Test 1: Successful creation
    console.log('  Test 1: Successful model creation');
    result = runCli('make:model TestModel');
    assert.strictEqual(result.error, null, `make:model TestModel failed: ${result.stderr}`);
    const modelPath = path.join(modelsDir, 'TestModel.ts');
    assert(fs.existsSync(modelPath), 'TestModel.ts should be created');
    const content = fs.readFileSync(modelPath, 'utf-8');
    assert(content.includes('export class TestModel'), 'File content is incorrect');
    console.log('  Test 1 PASSED');

    // Test 2: Already exists
    console.log('  Test 2: Model already exists');
    result = runCli('make:model TestModel');
    assert.notStrictEqual(result.error, null, 'make:model TestModel should fail if model exists');
    assert(result.stderr.includes('already exists'), `Error message for existing model is incorrect. STDERR: ${result.stderr}`);
    console.log('  Test 2 PASSED');

    // Test 3: Naming convention (lowercase input)
    console.log('  Test 3: Model naming convention');
    result = runCli('make:model lowermodule');
    assert.strictEqual(result.error, null, `make:model lowermodule failed: ${result.stderr}`);
    const normalizedModelPath = path.join(modelsDir, 'Lowermodule.ts');
    assert(fs.existsSync(normalizedModelPath), `Lowermodule.ts should be created. Actual path: ${normalizedModelPath}`);
    console.log('  Test 3 PASSED');

    // Test 4: Missing argument
    console.log('  Test 4: Missing model name');
    result = runCli('make:model');
    assert.notStrictEqual(result.error, null, 'make:model should fail without a name');
    assert(result.stderr.includes("error: missing required argument 'ModelName'"), `Error message for missing argument is incorrect. STDERR: ${result.stderr}`);
    console.log('  Test 4 PASSED');
}

// Main test execution
try {
    cleanup();
    testMakeController();
    cleanup();
    testMakeModel();
    console.log('\nAll CLI tests PASSED!');
} catch (e: any) {
    console.error('\nCLI tests FAILED:', e.message); // Log specific error message
    if (e.stdout) console.error('STDOUT:', e.stdout.toString());
    if (e.stderr) console.error('STDERR:', e.stderr.toString());
    process.exit(1);
} finally {
    cleanup();
}
