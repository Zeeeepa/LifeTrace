/**
 * Python runtime bootstrapper
 * Ensures Python 3.12 and backend dependencies are installed before starting the backend.
 */

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { app, dialog } from "electron";
import { emitLog, emitStatus } from "./bootstrap-status";
import { logger } from "./logger";

const REQUIRED_PYTHON_MAJOR = 3;
const REQUIRED_PYTHON_MINOR = 12;
const PYTHON_VERSION = "3.12.8";
const PYTHON_VERSION_SHORT = `${REQUIRED_PYTHON_MAJOR}.${REQUIRED_PYTHON_MINOR}`;
const PYTHON_DOWNLOAD_BASE = "https://www.python.org/ftp/python";
const DEP_MARKER_FILE = ".lifetrace-deps.json";

type CommandResult = {
	code: number | null;
	stdout: string;
	stderr: string;
};

type PythonInfo = {
	executable: string;
	version: string;
};

function getVenvPythonPath(venvDir: string): string {
	if (process.platform === "win32") {
		return path.join(venvDir, "Scripts", "python.exe");
	}
	return path.join(venvDir, "bin", "python3");
}

function readFileHash(filePath: string): string {
	const contents = fs.readFileSync(filePath);
	return crypto.createHash("sha256").update(contents).digest("hex");
}

function readDepsMarker(venvDir: string): { requirementsHash?: string } | null {
	const markerPath = path.join(venvDir, DEP_MARKER_FILE);
	if (!fs.existsSync(markerPath)) {
		return null;
	}
	try {
		const raw = fs.readFileSync(markerPath, "utf8");
		return JSON.parse(raw) as { requirementsHash?: string };
	} catch {
		return null;
	}
}

function writeDepsMarker(venvDir: string, requirementsHash: string): void {
	const markerPath = path.join(venvDir, DEP_MARKER_FILE);
	const payload = {
		requirementsHash,
		createdAt: new Date().toISOString(),
	};
	fs.writeFileSync(markerPath, JSON.stringify(payload, null, 2));
}

function buildVersionCheckArgs(extraArgs: string[] = []): string[] {
	return [
		...extraArgs,
		"-c",
		"import sys; print(f'{sys.version_info[0]}.{sys.version_info[1]}|{sys.executable}')",
	];
}

function isRequiredPython(version: string): boolean {
	return version.trim() === PYTHON_VERSION_SHORT;
}

function normalizeOutput(value: string): string {
	return value.replace(/\r/g, "").trim();
}

function getVersionFromOutput(output: string): PythonInfo | null {
	const line = normalizeOutput(output).split("\n")[0];
	if (!line) {
		return null;
	}
	const [version, executable] = line.split("|");
	if (!version || !executable) {
		return null;
	}
	return { version: version.trim(), executable: executable.trim() };
}

async function runCommand(
	command: string,
	args: string[],
	options: {
		cwd?: string;
		env?: NodeJS.ProcessEnv;
		windowsHide?: boolean;
		onStdout?: (chunk: string) => void;
		onStderr?: (chunk: string) => void;
	} = {},
): Promise<CommandResult> {
	return new Promise((resolve) => {
		const child = spawn(command, args, {
			cwd: options.cwd,
			env: options.env,
			windowsHide: options.windowsHide ?? true,
		});

		let stdout = "";
		let stderr = "";

		child.stdout?.on("data", (data) => {
			stdout += data.toString();
			options.onStdout?.(data.toString());
		});
		child.stderr?.on("data", (data) => {
			stderr += data.toString();
			options.onStderr?.(data.toString());
		});

		child.on("close", (code) => {
			resolve({ code, stdout, stderr });
		});

		child.on("error", (error) => {
			resolve({ code: 1, stdout: "", stderr: error.message });
		});
	});
}

async function getPythonInfo(command: string, args: string[]): Promise<PythonInfo | null> {
	const result = await runCommand(command, buildVersionCheckArgs(args));
	if (result.code !== 0) {
		return null;
	}
	return getVersionFromOutput(result.stdout);
}

async function findInstalledPython312(): Promise<string | null> {
	const candidates: Array<{ command: string; args: string[] }> = [];

	if (process.platform === "win32") {
		candidates.push({ command: "py", args: ["-3.12"] });
		candidates.push({ command: "python3.12", args: [] });
		candidates.push({ command: "python", args: [] });
		candidates.push({ command: "python3", args: [] });
	} else {
		candidates.push({ command: "python3.12", args: [] });
		candidates.push({ command: "python3", args: [] });
		candidates.push({ command: "python", args: [] });
	}

	for (const candidate of candidates) {
		const info = await getPythonInfo(candidate.command, candidate.args);
		if (!info || !isRequiredPython(info.version)) {
			continue;
		}
		if (fs.existsSync(info.executable)) {
			return info.executable;
		}
	}

	const fallbackPaths: string[] = [];
	if (process.platform === "win32") {
		const localAppData = process.env.LOCALAPPDATA ?? "";
		const programFiles = process.env.ProgramFiles ?? "";
		const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "";
		fallbackPaths.push(
			path.join(localAppData, "Programs", "Python", "Python312", "python.exe"),
			path.join(programFiles, "Python312", "python.exe"),
			path.join(programFilesX86, "Python312", "python.exe"),
		);
	} else if (process.platform === "darwin") {
		fallbackPaths.push(
			"/usr/local/bin/python3.12",
			"/opt/homebrew/bin/python3.12",
			"/Library/Frameworks/Python.framework/Versions/3.12/bin/python3.12",
		);
	} else {
		fallbackPaths.push("/usr/bin/python3.12", "/usr/local/bin/python3.12");
	}

	for (const candidatePath of fallbackPaths) {
		if (!candidatePath || !fs.existsSync(candidatePath)) {
			continue;
		}
		const info = await getPythonInfo(candidatePath, []);
		if (info && isRequiredPython(info.version)) {
			return info.executable;
		}
	}

	return null;
}

async function downloadFile(
	url: string,
	destination: string,
	redirectsLeft = 5,
): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const request = https.get(url, (response) => {
			const status = response.statusCode ?? 0;
			const location = response.headers.location;
			if (status >= 300 && status < 400 && location && redirectsLeft > 0) {
				response.resume();
				const redirectUrl = new URL(location, url).toString();
				downloadFile(redirectUrl, destination, redirectsLeft - 1)
					.then(resolve)
					.catch(reject);
				return;
			}
			if (status !== 200) {
				reject(new Error(`Download failed (${status}) from ${url}`));
				return;
			}
			const fileStream = fs.createWriteStream(destination);
			pipeline(response, fileStream)
				.then(resolve)
				.catch(reject);
		});

		request.on("error", reject);
	});
}

async function installPythonWindows(): Promise<void> {
	emitStatus({ message: "安装 Python 3.12", progress: 20 });
	const wingetCheck = await runCommand("winget", ["--version"]);
	if (wingetCheck.code === 0) {
		logger.info("Installing Python via winget...");
		emitLog("Using winget to install Python 3.12...");
		const install = await runCommand("winget", [
			"install",
			"--id",
			"Python.Python.3.12",
			"--exact",
			"--silent",
			"--accept-source-agreements",
			"--accept-package-agreements",
			"--scope",
			"user",
		]);
		if (install.code === 0) {
			emitLog("Winget install completed.");
			return;
		}
		logger.warn(`Winget install failed: ${install.stderr || install.stdout}`);
		emitLog(`Winget install failed: ${install.stderr || install.stdout}`);
	}

	const arch = process.arch === "arm64" ? "arm64" : "amd64";
	const fileName = `python-${PYTHON_VERSION}-${arch}.exe`;
	const url = `${PYTHON_DOWNLOAD_BASE}/${PYTHON_VERSION}/${fileName}`;
	const tempDir = path.join(app.getPath("temp"), "lifetrace-python");
	fs.mkdirSync(tempDir, { recursive: true });
	const installerPath = path.join(tempDir, fileName);

	logger.info(`Downloading Python installer from ${url}`);
	emitStatus({ message: "下载 Python 安装包", progress: 25, detail: url });
	await downloadFile(url, installerPath);

	logger.info("Running Python installer...");
	emitStatus({ message: "运行 Python 安装程序", progress: 35 });
	const install = await runCommand(installerPath, [
		"/quiet",
		"InstallAllUsers=0",
		"PrependPath=1",
		"Include_test=0",
	]);

	if (install.code !== 0) {
		throw new Error(`Python installer failed: ${install.stderr || install.stdout}`);
	}
}

async function installPythonMac(): Promise<void> {
	emitStatus({ message: "安装 Python 3.12", progress: 20 });
	const fileName = `python-${PYTHON_VERSION}-macos11.pkg`;
	const url = `${PYTHON_DOWNLOAD_BASE}/${PYTHON_VERSION}/${fileName}`;
	const tempDir = path.join(app.getPath("temp"), "lifetrace-python");
	fs.mkdirSync(tempDir, { recursive: true });
	const pkgPath = path.join(tempDir, fileName);

	logger.info(`Downloading Python installer from ${url}`);
	emitStatus({ message: "下载 Python 安装包", progress: 25, detail: url });
	await downloadFile(url, pkgPath);

	const installerCommand = `installer -pkg "${pkgPath}" -target /`;
	const script = `do shell script "${installerCommand.replace(/"/g, '\\"')}" with administrator privileges`;

	logger.info("Running Python installer with admin privileges...");
	emitStatus({ message: "运行 Python 安装程序", progress: 35 });
	const install = await runCommand("osascript", ["-e", script]);
	if (install.code !== 0) {
		throw new Error(`Python installer failed: ${install.stderr || install.stdout}`);
	}
}

async function installPythonLinux(): Promise<void> {
	emitStatus({ message: "安装 Python 3.12", progress: 20 });
	const installers: Array<{ command: string; args: string[] }> = [
		{ command: "apt-get", args: ["install", "-y", "python3.12", "python3.12-venv"] },
		{ command: "dnf", args: ["install", "-y", "python3.12"] },
		{ command: "zypper", args: ["--non-interactive", "install", "python312"] },
	];

	for (const installer of installers) {
		emitLog(`Attempting ${installer.command} install...`);
		const result = await runCommand("pkexec", [
			installer.command,
			...installer.args,
		]);
		if (result.code === 0) {
			emitLog(`${installer.command} install completed.`);
			return;
		}
		logger.warn(`Linux installer failed: ${result.stderr || result.stdout}`);
		emitLog(`Linux installer failed: ${result.stderr || result.stdout}`);
	}

	throw new Error("Automatic Python install failed on Linux.");
}

async function installPython312(): Promise<void> {
	if (process.platform === "win32") {
		await installPythonWindows();
		return;
	}
	if (process.platform === "darwin") {
		await installPythonMac();
		return;
	}
	if (process.platform === "linux") {
		await installPythonLinux();
		return;
	}
	throw new Error("Unsupported platform for Python install.");
}

async function ensurePython312Installed(): Promise<string> {
	emitStatus({ message: "检查 Python 3.12", progress: 10 });
	const existing = await findInstalledPython312();
	if (existing) {
		emitLog(`Found Python 3.12 at ${existing}`);
		return existing;
	}

	const response = await dialog.showMessageBox({
		type: "info",
		buttons: ["Install Python 3.12", "Cancel"],
		defaultId: 0,
		cancelId: 1,
		message: "LifeTrace needs Python 3.12 to run the local backend.",
		detail:
			"Python 3.12 will be installed automatically using official sources. This may take a few minutes and requires internet access.",
	});

	if (response.response !== 0) {
		throw new Error("Python 3.12 installation cancelled by user.");
	}

	await installPython312();

	const installed = await findInstalledPython312();
	if (!installed) {
		throw new Error("Python 3.12 installation completed but was not detected.");
	}

	return installed;
}

async function ensureVenv(
	systemPythonPath: string,
	venvDir: string,
): Promise<void> {
	if (fs.existsSync(getVenvPythonPath(venvDir))) {
		return;
	}
	emitStatus({ message: "创建 Python 虚拟环境", progress: 45 });
	fs.mkdirSync(venvDir, { recursive: true });
	const result = await runCommand(systemPythonPath, ["-m", "venv", venvDir]);
	if (result.code !== 0) {
		throw new Error(`Failed to create venv: ${result.stderr || result.stdout}`);
	}
}

async function ensureDependencies(
	venvPython: string,
	venvDir: string,
	requirementsPath: string,
): Promise<void> {
	if (!fs.existsSync(requirementsPath)) {
		throw new Error(`Requirements file not found: ${requirementsPath}`);
	}

	const requirementsHash = readFileHash(requirementsPath);
	const marker = readDepsMarker(venvDir);
	if (marker?.requirementsHash === requirementsHash) {
		return;
	}

	await dialog.showMessageBox({
		type: "info",
		buttons: ["Continue"],
		message: "Installing backend dependencies",
		detail:
			"This is the first launch. LifeTrace will now download and install Python dependencies. It may take several minutes depending on your network.",
	});

	emitStatus({ message: "升级 pip", progress: 50 });
	const env = {
		...process.env,
		PIP_DISABLE_PIP_VERSION_CHECK: "1",
		PIP_NO_INPUT: "1",
	};

	const upgrade = await runCommand(venvPython, ["-m", "pip", "install", "--upgrade", "pip"], {
		env,
		onStdout: emitLog,
		onStderr: emitLog,
	});
	if (upgrade.code !== 0) {
		throw new Error(`Failed to upgrade pip: ${upgrade.stderr || upgrade.stdout}`);
	}

	emitStatus({ message: "安装后端依赖", progress: 60 });
	const install = await runCommand(
		venvPython,
		["-m", "pip", "install", "-r", requirementsPath],
		{ env, onStdout: emitLog, onStderr: emitLog },
	);
	if (install.code !== 0) {
		throw new Error(`Failed to install dependencies: ${install.stderr || install.stdout}`);
	}

	writeDepsMarker(venvDir, requirementsHash);
}

async function ensureVenvPythonVersion(venvPython: string): Promise<boolean> {
	const info = await getPythonInfo(venvPython, []);
	return !!info && isRequiredPython(info.version);
}

export async function ensurePythonRuntime(
	venvDir: string,
	requirementsPath: string,
): Promise<string> {
	emitStatus({ message: "准备 Python 运行时", progress: 5 });
	const venvPython = getVenvPythonPath(venvDir);

	if (fs.existsSync(venvPython)) {
		const versionOk = await ensureVenvPythonVersion(venvPython);
		if (versionOk) {
			emitStatus({ message: "检查后端依赖", progress: 55 });
			await ensureDependencies(venvPython, venvDir, requirementsPath);
			emitStatus({ message: "Python 运行时就绪", progress: 70 });
			return venvPython;
		}
		logger.warn("Existing venv does not match Python 3.12, recreating.");
		emitLog("Existing venv does not match Python 3.12, recreating.");
	}

	const systemPython = await ensurePython312Installed();
	await ensureVenv(systemPython, venvDir);

	if (!fs.existsSync(venvPython)) {
		throw new Error("Virtual environment was created but python executable is missing.");
	}

	await ensureDependencies(venvPython, venvDir, requirementsPath);
	emitStatus({ message: "Python 运行时就绪", progress: 70 });
	return venvPython;
}

export { getVenvPythonPath };
